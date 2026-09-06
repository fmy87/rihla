import AsyncStorage from '@react-native-async-storage/async-storage';
import { confirmEvent, markNotConfirmed, markStopArrivedIfResolved, type NotConfirmedReason } from '../queries/pickup';

const QUEUE_KEY = 'action_sync_queue';

export type QueuedAction =
  | {
      id: string;
      kind: 'confirm_event';
      assignmentId: string;
      driverId: string;
      eventType: 'pickup' | 'dropoff';
      dailyRouteStopId: string;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'not_confirmed';
      assignmentId: string;
      reason: NotConfirmedReason;
      dailyRouteStopId: string;
      createdAt: string;
    };

async function readQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(actions: QueuedAction[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(actions));
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function enqueueConfirmEvent(
  assignmentId: string,
  driverId: string,
  eventType: 'pickup' | 'dropoff',
  dailyRouteStopId: string
) {
  const queue = await readQueue();
  queue.push({
    id: genId(),
    kind: 'confirm_event',
    assignmentId,
    driverId,
    eventType,
    dailyRouteStopId,
    createdAt: new Date().toISOString(),
  });
  await writeQueue(queue);
}

export async function enqueueNotConfirmed(assignmentId: string, reason: NotConfirmedReason, dailyRouteStopId: string) {
  const queue = await readQueue();
  queue.push({ id: genId(), kind: 'not_confirmed', assignmentId, reason, dailyRouteStopId, createdAt: new Date().toISOString() });
  await writeQueue(queue);
}

/** Returns the set of assignment IDs with a not-yet-synced action, so the UI can show "Pending sync" instead of pretending it's confirmed server-side. */
export async function pendingAssignmentIds(): Promise<Set<string>> {
  const queue = await readQueue();
  return new Set(queue.map((a) => a.assignmentId));
}

export async function actionQueueLength(): Promise<number> {
  return (await readQueue()).length;
}

/**
 * Replays queued actions in order. Stops at the first failure (assumed to be
 * connectivity) and leaves the remainder queued — never drops an action, and
 * never reorders it ahead of an earlier one for the same assignment.
 */
export async function flushActionQueue(): Promise<{ synced: number; remaining: number }> {
  const queue = await readQueue();
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const touchedStops = new Set<string>();
  let synced = 0;

  for (let i = 0; i < queue.length; i++) {
    const action = queue[i];
    let error: string | null = null;

    if (action.kind === 'confirm_event') {
      const result = await confirmEvent(action.assignmentId, action.driverId, action.eventType);
      error = result.error;
    } else {
      const result = await markNotConfirmed(action.assignmentId, action.reason);
      error = result.error?.message ?? null;
    }

    if (error) {
      // Leave this and everything after it queued; retry on the next flush.
      const remaining = queue.slice(i);
      await writeQueue(remaining);
      for (const stopId of touchedStops) await markStopArrivedIfResolved(stopId);
      return { synced, remaining: remaining.length };
    }

    touchedStops.add(action.dailyRouteStopId);
    synced++;
  }

  await writeQueue([]);
  for (const stopId of touchedStops) await markStopArrivedIfResolved(stopId);
  return { synced, remaining: 0 };
}
