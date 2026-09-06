import { supabase } from '../supabaseClient';

export interface ReplayPoint {
  latitude: number;
  longitude: number;
  recordedAt: string;
  speedKmh: number | null;
}

export interface ReplayMeta {
  dailyRouteId: string;
  routeName: string;
  busNumber: string;
  driverName: string;
  serviceDate: string;
  status: string;
}

export async function fetchGpsHistory(dailyRouteId: string): Promise<ReplayPoint[]> {
  const { data, error } = await supabase
    .from('gps_locations_with_coords')
    .select('recorded_at, speed_kmh, latitude, longitude')
    .eq('daily_route_id', dailyRouteId)
    .order('recorded_at', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    latitude: row.latitude,
    longitude: row.longitude,
    recordedAt: row.recorded_at,
    speedKmh: row.speed_kmh,
  }));
}

export async function fetchReplayMeta(dailyRouteId: string): Promise<ReplayMeta | null> {
  const { data, error } = await supabase
    .from('daily_routes')
    .select('id, service_date, status, routes(name_en), buses(bus_number), drivers(full_name)')
    .eq('id', dailyRouteId)
    .single();
  if (error || !data) return null;
  return {
    dailyRouteId: data.id,
    // @ts-expect-error -- joined field
    routeName: data.routes?.name_en ?? '—',
    // @ts-expect-error -- joined field
    busNumber: data.buses?.bus_number ?? '—',
    // @ts-expect-error -- joined field
    driverName: data.drivers?.full_name ?? '—',
    serviceDate: data.service_date,
    status: data.status,
  };
}

export interface ReplayStop {
  sequence: number;
  nameEn: string;
  latitude: number;
  longitude: number;
  isSkipped: boolean;
  arrivedAt: string | null;
}

export async function fetchReplayStops(dailyRouteId: string): Promise<ReplayStop[]> {
  const { data, error } = await supabase
    .from('daily_route_stops_with_coords')
    .select('sequence, name_en, latitude, longitude, is_skipped, arrived_at')
    .eq('daily_route_id', dailyRouteId)
    .order('sequence', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => ({
    sequence: r.sequence,
    nameEn: r.name_en,
    latitude: r.latitude,
    longitude: r.longitude,
    isSkipped: r.is_skipped,
    arrivedAt: r.arrived_at,
  }));
}
