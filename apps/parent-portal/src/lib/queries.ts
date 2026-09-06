import { supabase } from '../supabaseClient';

export interface ChildToday {
  studentId: string;
  studentName: string;
  grade: string | null;
  className: string | null;
  status: string | null; // daily_student_assignments.status, or null if not scheduled today
  stopName: string | null;
  scheduledTime: string | null;
  dailyRouteStatus: string | null;
  busNumber: string | null;
  driverName: string | null;
  driverPhone: string | null;
  lastSeenAt: string | null; // latest GPS ping for the bus, if any
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * One row per child, each carrying today's assignment/route/bus/driver if
 * one exists — RLS (migration 0017) already guarantees every row returned
 * belongs to a child of the signed-in parent, so no extra filtering is
 * needed here beyond "today".
 */
export async function fetchChildrenToday(): Promise<ChildToday[]> {
  const today = todayISO();

  const { data: students, error } = await supabase
    .from('students')
    .select('id, name_en, name_ar, grade, class_name')
    .order('name_en', { ascending: true });
  if (error || !students) return [];

  const results: ChildToday[] = [];

  for (const student of students) {
    const { data: assignment } = await supabase
      .from('daily_student_assignments')
      .select(
        `status,
         daily_route_stops!inner(
           name_en, estimated_arrival_time,
           daily_routes!inner(id, status, service_date, bus_id, driver_id,
             buses(bus_number), drivers(full_name, phone))
         )`
      )
      .eq('student_id', student.id)
      .eq('daily_route_stops.daily_routes.service_date', today)
      .maybeSingle();

    // @ts-expect-error -- joined fields, typed loosely on purpose (see reports.ts/routes.ts elsewhere for the same pattern)
    const dr = assignment?.daily_route_stops?.daily_routes ?? null;
    let lastSeenAt: string | null = null;
    if (dr?.bus_id) {
      const { data: pos } = await supabase
        .from('latest_gps_locations')
        .select('recorded_at')
        .eq('bus_id', dr.bus_id)
        .maybeSingle();
      lastSeenAt = pos?.recorded_at ?? null;
    }

    results.push({
      studentId: student.id,
      studentName: student.name_en,
      grade: student.grade,
      className: student.class_name,
      status: assignment?.status ?? null,
      // @ts-expect-error -- joined field
      stopName: assignment?.daily_route_stops?.name_en ?? null,
      // @ts-expect-error -- joined field
      scheduledTime: assignment?.daily_route_stops?.estimated_arrival_time ?? null,
      dailyRouteStatus: dr?.status ?? null,
      busNumber: dr?.buses?.bus_number ?? null,
      driverName: dr?.drivers?.full_name ?? null,
      driverPhone: dr?.drivers?.phone ?? null,
      lastSeenAt,
    });
  }

  return results;
}
