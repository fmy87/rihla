import { supabase } from '../supabaseClient';
import { localDateOnly } from '../date';

function todayDateOnly() {
  return localDateOnly();
}

export interface AttendanceRow {
  assignmentId: string;
  studentName: string;
  routeName: string;
  stopName: string;
  scheduledTime: string | null;
  status: string;
}

export async function fetchTodayAttendance(schoolId: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase
    .from('daily_student_assignments')
    .select(
      `id, status,
       students(name_en),
       daily_route_stops!inner(name_en, estimated_arrival_time,
         daily_routes!inner(school_id, service_date, routes(name_en)))`
    )
    .eq('daily_route_stops.daily_routes.school_id', schoolId)
    .eq('daily_route_stops.daily_routes.service_date', todayDateOnly());

  if (error || !data) return [];

  return data.map((row) => ({
    assignmentId: row.id,
    // @ts-expect-error -- joined field
    studentName: row.students?.name_en ?? '—',
    // @ts-expect-error -- joined field
    routeName: row.daily_route_stops?.daily_routes?.routes?.name_en ?? '—',
    // @ts-expect-error -- joined field
    stopName: row.daily_route_stops?.name_en ?? '—',
    // @ts-expect-error -- joined field
    scheduledTime: row.daily_route_stops?.estimated_arrival_time ?? null,
    status: row.status,
  }));
}
