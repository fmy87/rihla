import { supabase } from '../supabaseClient';
import { localDateOnly } from '../date';

export type DailyRouteStatus = 'not_started' | 'on_route' | 'delayed' | 'completed' | 'cancelled';

export interface TodayRoute {
  dailyRouteId: string;
  routeId: string;
  routeNameEn: string;
  routeNameAr: string | null;
  busId: string;
  busNumber: string;
  status: DailyRouteStatus;
  startedAt: string | null;
  completedAt: string | null;
}

function todayDateOnly() {
  return localDateOnly();
}

export async function fetchTodayRoute(driverId: string): Promise<TodayRoute | null> {
  const { data, error } = await supabase
    .from('daily_routes')
    .select('id, route_id, bus_id, status, started_at, completed_at, routes(name_en, name_ar), buses(bus_number)')
    .eq('driver_id', driverId)
    .eq('service_date', todayDateOnly())
    .maybeSingle();

  if (error || !data) return null;

  return {
    dailyRouteId: data.id,
    routeId: data.route_id,
    // @ts-expect-error -- joined field, typed properly once `supabase gen types` runs
    routeNameEn: data.routes?.name_en ?? '—',
    // @ts-expect-error -- see above
    routeNameAr: data.routes?.name_ar ?? null,
    busId: data.bus_id,
    // @ts-expect-error -- see above
    busNumber: data.buses?.bus_number ?? '—',
    status: data.status,
    startedAt: data.started_at,
    completedAt: data.completed_at,
  };
}

/**
 * Marks the route as started. GPS location capture (started_location) is
 * wired up in Phase 8 (Live GPS Tracking) — this records the timestamp/status
 * transition now so the rest of the driver flow (Route/Students screens,
 * and Phase 7's pickup confirmations) has something real to key off.
 */
export async function startDailyRoute(dailyRouteId: string) {
  return supabase
    .from('daily_routes')
    .update({ status: 'on_route', started_at: new Date().toISOString() })
    .eq('id', dailyRouteId);
}

export interface TodayStop {
  id: string;
  sequence: number;
  nameEn: string;
  nameAr: string | null;
  latitude: number;
  longitude: number;
  estimatedArrivalTime: string | null;
  stopType: 'pickup' | 'dropoff';
  isSkipped: boolean;
  arrivedAt: string | null;
}

export async function fetchTodayStops(dailyRouteId: string): Promise<TodayStop[]> {
  const { data, error } = await supabase
    .from('daily_route_stops_with_coords')
    .select('id, sequence, name_en, name_ar, latitude, longitude, estimated_arrival_time, stop_type, is_skipped, arrived_at')
    .eq('daily_route_id', dailyRouteId)
    .order('sequence', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    sequence: row.sequence,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    latitude: row.latitude,
    longitude: row.longitude,
    estimatedArrivalTime: row.estimated_arrival_time,
    stopType: row.stop_type,
    isSkipped: row.is_skipped,
    arrivedAt: row.arrived_at,
  }));
}
