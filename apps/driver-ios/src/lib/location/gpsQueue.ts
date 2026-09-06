import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

const QUEUE_KEY = 'gps_sync_queue';
// A point captured more than this long before it's actually synced is
// flagged is_offline_backfill — i.e. it was queued during a connectivity gap.
const OFFLINE_BACKFILL_THRESHOLD_MS = 60_000;

export interface QueuedPoint {
  daily_route_id: string;
  bus_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  accuracy_meters: number | null;
  recorded_at: string; // ISO
}

async function readQueue(): Promise<QueuedPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedPoint[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(points: QueuedPoint[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(points));
}

/** Every captured point is written here FIRST, before any network attempt — this is what makes offline operation safe. */
export async function enqueuePoint(point: QueuedPoint) {
  const queue = await readQueue();
  queue.push(point);
  await writeQueue(queue);
}

export async function queueLength(): Promise<number> {
  return (await readQueue()).length;
}

export interface FlushResult {
  synced: number;
  remaining: number;
  succeeded: boolean;
}

/**
 * Attempts to push every queued point to Supabase in one batch insert.
 * On any failure (offline, server error) the queue is left untouched — safe
 * to retry later, no data loss. On success the queue is cleared.
 */
export async function flushQueue(): Promise<FlushResult> {
  const queue = await readQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0, succeeded: true };

  const now = Date.now();
  const rows = queue.map((p) => ({
    ...p,
    is_offline_backfill: now - new Date(p.recorded_at).getTime() > OFFLINE_BACKFILL_THRESHOLD_MS,
  }));

  const { error } = await supabase.from('gps_locations').insert(rows);
  if (error) {
    return { synced: 0, remaining: queue.length, succeeded: false };
  }
  await writeQueue([]);
  return { synced: rows.length, remaining: 0, succeeded: true };
}
