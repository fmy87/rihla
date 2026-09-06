import { supabase } from '../supabaseClient';
import { localDateOnly } from '../date';

function todayDateOnly() {
  return localDateOnly();
}

export interface DailyOperationRow {
  dailyRouteId: string;
  routeName: string;
  busNumber: string;
  driverName: string;
  driverPhone: string | null;
  status: string;
  startedAt: string | null;
  progressPercent: number;
  currentStopName: string | null;
}

export async function fetchDailyOperations(schoolId: string): Promise<DailyOperationRow[]> {
  const { data: dailyRoutes, error } = await supabase
    .from('daily_routes')
    .select('id, status, started_at, routes(name_en), buses(bus_number), drivers(full_name, phone)')
    .eq('school_id', schoolId)
    .eq('service_date', todayDateOnly())
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
    const currentStop = routeStops.find((s) => s.arrived_at === null && !s.is_skipped) ?? null;

    return {
      dailyRouteId: route.id,
      // @ts-expect-error -- joined field
      routeName: route.routes?.name_en ?? '—',
      // @ts-expect-error -- joined field
      busNumber: route.buses?.bus_number ?? '—',
      // @ts-expect-error -- joined field
      driverName: route.drivers?.full_name ?? '—',
      // @ts-expect-error -- joined field
      driverPhone: route.drivers?.phone ?? null,
      status: route.status,
      startedAt: route.started_at,
      progressPercent: total > 0 ? Math.round((arrivedCount / total) * 100) : 0,
      currentStopName: currentStop?.name_en ?? null,
    };
  });
}

export interface DailyOperationStop {
  id: string;
  sequence: number;
  nameEn: string;
  arrivedAt: string | null;
  isSkipped: boolean;
  students: { name: string; status: string }[];
}

export async function fetchDailyRouteDetail(dailyRouteId: string): Promise<DailyOperationStop[]> {
  const { data: stops } = await supabase
    .from('daily_route_stops')
    .select('id, sequence, name_en, arrived_at, is_skipped')
    .eq('daily_route_id', dailyRouteId)
    .order('sequence', { ascending: true });

  if (!stops || stops.length === 0) return [];

  const { data: assignments } = await supabase
    .from('daily_student_assignments')
    .select('daily_route_stop_id, status, students(name_en)')
    .in(
      'daily_route_stop_id',
      stops.map((s) => s.id)
    );

  return stops.map((stop) => ({
    id: stop.id,
    sequence: stop.sequence,
    nameEn: stop.name_en,
    arrivedAt: stop.arrived_at,
    isSkipped: stop.is_skipped,
    students: (assignments ?? [])
      .filter((a) => a.daily_route_stop_id === stop.id)
      // @ts-expect-error -- joined field
      .map((a) => ({ name: a.students?.name_en ?? '—', status: a.status })),
  }));
}
