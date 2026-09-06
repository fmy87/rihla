import { supabase } from '../supabaseClient';

// ---------- Daily Attendance ----------

export interface AttendanceReportRow {
  date: string;
  studentName: string;
  routeName: string;
  stopName: string;
  status: string;
}

export interface AttendanceSummary {
  scheduled: number;
  pickedUp: number;
  droppedOff: number;
  absent: number;
  notConfirmed: number;
}

export async function fetchDailyAttendanceReport(
  schoolId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ rows: AttendanceReportRow[]; summary: AttendanceSummary }> {
  const { data, error } = await supabase
    .from('daily_student_assignments')
    .select(
      `status,
       students(name_en),
       daily_route_stops!inner(name_en,
         daily_routes!inner(school_id, service_date, routes(name_en)))`
    )
    .eq('daily_route_stops.daily_routes.school_id', schoolId)
    .gte('daily_route_stops.daily_routes.service_date', dateFrom)
    .lte('daily_route_stops.daily_routes.service_date', dateTo);

  if (error || !data) return { rows: [], summary: { scheduled: 0, pickedUp: 0, droppedOff: 0, absent: 0, notConfirmed: 0 } };

  const rows = data.map((row) => ({
    // @ts-expect-error -- joined field
    date: row.daily_route_stops?.daily_routes?.service_date ?? '',
    // @ts-expect-error -- joined field
    studentName: row.students?.name_en ?? '—',
    // @ts-expect-error -- joined field
    routeName: row.daily_route_stops?.daily_routes?.routes?.name_en ?? '—',
    // @ts-expect-error -- joined field
    stopName: row.daily_route_stops?.name_en ?? '—',
    status: row.status,
  }));

  const summary: AttendanceSummary = {
    scheduled: rows.length,
    pickedUp: rows.filter((r) => r.status === 'picked_up').length,
    droppedOff: rows.filter((r) => r.status === 'dropped_off').length,
    absent: rows.filter((r) => r.status === 'absent').length,
    notConfirmed: rows.filter((r) => r.status === 'not_confirmed' || r.status === 'pending').length,
  };

  return { rows, summary };
}

// ---------- Route Performance ----------

export interface RoutePerformanceRow {
  date: string;
  routeName: string;
  busNumber: string;
  plannedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  stopsTotal: number;
  stopsSkipped: number;
  deviationCount: number;
  status: string;
}

export async function fetchRoutePerformanceReport(
  schoolId: string,
  dateFrom: string,
  dateTo: string
): Promise<RoutePerformanceRow[]> {
  const { data: dailyRoutes } = await supabase
    .from('daily_routes')
    .select('id, service_date, status, started_at, completed_at, routes(name_en), buses(bus_number)')
    .eq('school_id', schoolId)
    .gte('service_date', dateFrom)
    .lte('service_date', dateTo);

  if (!dailyRoutes || dailyRoutes.length === 0) return [];

  const dailyRouteIds = dailyRoutes.map((r) => r.id);
  const { data: stops } = await supabase
    .from('daily_route_stops')
    .select('daily_route_id, sequence, estimated_arrival_time, is_skipped')
    .in('daily_route_id', dailyRouteIds);

  const { data: deviationAlerts } = await supabase
    .from('alerts')
    .select('daily_route_id')
    .in('daily_route_id', dailyRouteIds)
    .eq('type', 'route_deviation');

  return dailyRoutes.map((route) => {
    const routeStops = (stops ?? []).filter((s) => s.daily_route_id === route.id).sort((a, b) => a.sequence - b.sequence);
    const withTimes = routeStops.filter((s) => s.estimated_arrival_time);
    let plannedDurationMinutes: number | null = null;
    if (withTimes.length >= 2) {
      const [h1, m1] = withTimes[0].estimated_arrival_time!.split(':').map(Number);
      const [h2, m2] = withTimes[withTimes.length - 1].estimated_arrival_time!.split(':').map(Number);
      plannedDurationMinutes = h2 * 60 + m2 - (h1 * 60 + m1);
    }
    const actualDurationMinutes =
      route.started_at && route.completed_at
        ? Math.round((new Date(route.completed_at).getTime() - new Date(route.started_at).getTime()) / 60000)
        : null;

    return {
      date: route.service_date,
      // @ts-expect-error -- joined field
      routeName: route.routes?.name_en ?? '—',
      // @ts-expect-error -- joined field
      busNumber: route.buses?.bus_number ?? '—',
      plannedDurationMinutes,
      actualDurationMinutes,
      stopsTotal: routeStops.length,
      stopsSkipped: routeStops.filter((s) => s.is_skipped).length,
      deviationCount: (deviationAlerts ?? []).filter((a) => a.daily_route_id === route.id).length,
      status: route.status,
    };
  });
}

// ---------- Driver Performance ----------

export interface DriverPerformanceRow {
  driverName: string;
  routesCompleted: number;
  routesTotal: number;
  onTimePercent: number;
  deviationCount: number;
  exceptionCount: number;
}

export async function fetchDriverPerformanceReport(
  schoolId: string,
  dateFrom: string,
  dateTo: string
): Promise<DriverPerformanceRow[]> {
  const { data: dailyRoutes } = await supabase
    .from('daily_routes')
    .select('id, status, drivers(full_name)')
    .eq('school_id', schoolId)
    .gte('service_date', dateFrom)
    .lte('service_date', dateTo);

  if (!dailyRoutes || dailyRoutes.length === 0) return [];

  const dailyRouteIds = dailyRoutes.map((r) => r.id);
  const { data: deviationAlerts } = await supabase
    .from('alerts')
    .select('daily_route_id')
    .in('daily_route_id', dailyRouteIds)
    .eq('type', 'route_deviation');
  const { data: exceptionAssignments } = await supabase
    .from('daily_student_assignments')
    .select('status, daily_route_stops!inner(daily_route_id)')
    .eq('status', 'exception');

  const byDriver = new Map<string, DriverPerformanceRow>();
  for (const route of dailyRoutes) {
    // @ts-expect-error -- joined field
    const name: string = route.drivers?.full_name ?? '—';
    const existing = byDriver.get(name) ?? {
      driverName: name,
      routesCompleted: 0,
      routesTotal: 0,
      onTimePercent: 0,
      deviationCount: 0,
      exceptionCount: 0,
    };
    existing.routesTotal += 1;
    if (route.status === 'completed') existing.routesCompleted += 1;
    existing.deviationCount += (deviationAlerts ?? []).filter((a) => a.daily_route_id === route.id).length;
    byDriver.set(name, existing);
  }

  // "On time" here means completed with zero route-deviation alerts — a
  // simplification noted in the Reports UI; a true on-time metric needs a
  // scheduled start time field, which isn't part of the v1 schema.
  for (const row of byDriver.values()) {
    row.onTimePercent = row.routesTotal > 0 ? Math.round(((row.routesTotal - row.deviationCount) / row.routesTotal) * 100) : 0;
  }
  for (const a of exceptionAssignments ?? []) {
    // @ts-expect-error -- joined field
    const dailyRouteId = a.daily_route_stops?.daily_route_id;
    const route = dailyRoutes.find((r) => r.id === dailyRouteId);
    // @ts-expect-error -- joined field
    const name = route?.drivers?.full_name ?? '—';
    const row = byDriver.get(name);
    if (row) row.exceptionCount += 1;
  }

  return Array.from(byDriver.values());
}

// ---------- Bus Performance ----------

export interface BusPerformanceRow {
  busNumber: string;
  trips: number;
  delayedTrips: number;
  gpsPings: number;
  deviationCount: number;
}

export async function fetchBusPerformanceReport(
  schoolId: string,
  dateFrom: string,
  dateTo: string
): Promise<BusPerformanceRow[]> {
  const { data: dailyRoutes } = await supabase
    .from('daily_routes')
    .select('id, status, buses(bus_number)')
    .eq('school_id', schoolId)
    .gte('service_date', dateFrom)
    .lte('service_date', dateTo);

  if (!dailyRoutes || dailyRoutes.length === 0) return [];

  const dailyRouteIds = dailyRoutes.map((r) => r.id);
  const { data: deviationAlerts } = await supabase
    .from('alerts')
    .select('daily_route_id')
    .in('daily_route_id', dailyRouteIds)
    .eq('type', 'route_deviation');
  const { data: gpsCounts } = await supabase.from('gps_locations').select('daily_route_id').in('daily_route_id', dailyRouteIds);

  const byBus = new Map<string, BusPerformanceRow>();
  for (const route of dailyRoutes) {
    // @ts-expect-error -- joined field
    const busNumber: string = route.buses?.bus_number ?? '—';
    const existing = byBus.get(busNumber) ?? { busNumber, trips: 0, delayedTrips: 0, gpsPings: 0, deviationCount: 0 };
    existing.trips += 1;
    if (route.status === 'delayed') existing.delayedTrips += 1;
    existing.deviationCount += (deviationAlerts ?? []).filter((a) => a.daily_route_id === route.id).length;
    existing.gpsPings += (gpsCounts ?? []).filter((g) => g.daily_route_id === route.id).length;
    byBus.set(busNumber, existing);
  }

  return Array.from(byBus.values());
}
