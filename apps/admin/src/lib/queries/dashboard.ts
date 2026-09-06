import { supabase } from '../supabaseClient';
import { localDateOnly, localDayBoundsISO } from '../date';

export interface TodayOverview {
  activeBuses: number;
  onRoute: number;
  completed: number;
  notStarted: number;
  delayed: number;
  studentsTransported: number;
  pendingPickup: number;
  absentees: number;
  routeDeviations: number;
}

function todayBounds() {
  // NOTE: dateOnly must come from the LOCAL calendar date directly, not by
  // formatting `start` (a Date at local midnight) through toISOString() —
  // that converts to UTC first and silently returns the wrong date for any
  // timezone ahead of UTC (this was a real bug, fixed during audit).
  const { startISO, endISO } = localDayBoundsISO();
  return {
    dateOnly: localDateOnly(), // YYYY-MM-DD for daily_routes.service_date
    startISO,
    endISO,
  };
}

export async function fetchTodayOverview(schoolId: string): Promise<TodayOverview> {
  const { dateOnly, startISO, endISO } = todayBounds();

  const [routesResult, assignmentsResult, deviationsResult] = await Promise.all([
    supabase
      .from('daily_routes')
      .select('status')
      .eq('school_id', schoolId)
      .eq('service_date', dateOnly),

    supabase
      .from('daily_student_assignments')
      .select('status, daily_route_stops!inner(stop_type, daily_routes!inner(school_id, service_date))')
      .eq('daily_route_stops.daily_routes.school_id', schoolId)
      .eq('daily_route_stops.daily_routes.service_date', dateOnly),

    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .eq('type', 'route_deviation')
      .gte('created_at', startISO)
      .lt('created_at', endISO),
  ]);

  const routes = routesResult.data ?? [];
  const assignments = (assignmentsResult.data ?? []) as unknown as Array<{
    status: string;
    daily_route_stops: { stop_type: string };
  }>;

  return {
    activeBuses: routes.filter((r) => r.status !== 'cancelled').length,
    onRoute: routes.filter((r) => r.status === 'on_route').length,
    completed: routes.filter((r) => r.status === 'completed').length,
    notStarted: routes.filter((r) => r.status === 'not_started').length,
    delayed: routes.filter((r) => r.status === 'delayed').length,
    studentsTransported: assignments.filter((a) => ['picked_up', 'dropped_off'].includes(a.status)).length,
    pendingPickup: assignments.filter((a) => a.status === 'pending' && a.daily_route_stops?.stop_type === 'pickup')
      .length,
    absentees: assignments.filter((a) => a.status === 'absent').length,
    routeDeviations: deviationsResult.count ?? 0,
  };
}

export interface ActiveRouteRow {
  dailyRouteId: string;
  routeName: string;
  busId: string;
  busNumber: string;
  driverName: string;
  status: string;
  progressPercent: number;
  currentStopName: string | null;
  nextStopName: string | null;
}

export async function fetchActiveDailyRoutes(schoolId: string): Promise<ActiveRouteRow[]> {
  const { dateOnly } = todayBounds();

  const { data: dailyRoutes, error } = await supabase
    .from('daily_routes')
    .select('id, status, bus_id, routes(name_en), buses(bus_number), drivers(full_name)')
    .eq('school_id', schoolId)
    .eq('service_date', dateOnly)
    .neq('status', 'cancelled');

  if (error || !dailyRoutes || dailyRoutes.length === 0) return [];

  const dailyRouteIds = dailyRoutes.map((r) => r.id);

  const { data: stops } = await supabase
    .from('daily_route_stops')
    .select('id, daily_route_id, sequence, name_en, arrived_at, is_skipped')
    .in('daily_route_id', dailyRouteIds)
    .order('sequence', { ascending: true });

  return dailyRoutes.map((route) => {
    const routeStops = (stops ?? []).filter((s) => s.daily_route_id === route.id);
    const total = routeStops.length;
    const arrivedCount = routeStops.filter((s) => s.arrived_at !== null).length;
    const currentStop = [...routeStops].reverse().find((s) => s.arrived_at !== null) ?? null;
    const nextStop = routeStops.find((s) => s.arrived_at === null && !s.is_skipped) ?? null;

    return {
      dailyRouteId: route.id,
      busId: route.bus_id,
      // @ts-expect-error -- Supabase's generated join types aren't wired up until `supabase gen types` is run
      routeName: route.routes?.name_en ?? '—',
      // @ts-expect-error -- see above
      busNumber: route.buses?.bus_number ?? '—',
      // @ts-expect-error -- see above
      driverName: route.drivers?.full_name ?? '—',
      status: route.status,
      progressPercent: total > 0 ? Math.round((arrivedCount / total) * 100) : 0,
      currentStopName: currentStop?.name_en ?? null,
      nextStopName: nextStop?.name_en ?? null,
    };
  });
}

export interface LiveBusPosition {
  busId: string;
  latitude: number;
  longitude: number;
  speedKmh: number | null;
  recordedAt: string;
}

/** Backed by the `latest_gps_locations` view — empty until Phase 8 ships GPS writes. */
export async function fetchLatestBusPositions(dailyRouteIds: string[]): Promise<LiveBusPosition[]> {
  if (dailyRouteIds.length === 0) return [];
  const { data, error } = await supabase
    .from('latest_gps_locations')
    .select('bus_id, latitude, longitude, speed_kmh, recorded_at')
    .in('daily_route_id', dailyRouteIds);
  if (error || !data) return [];
  return data.map((row) => ({
    busId: row.bus_id,
    latitude: row.latitude,
    longitude: row.longitude,
    speedKmh: row.speed_kmh,
    recordedAt: row.recorded_at,
  }));
}
