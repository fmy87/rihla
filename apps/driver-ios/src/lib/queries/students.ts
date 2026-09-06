import { supabase } from '../supabaseClient';

export interface StopStudent {
  assignmentId: string;
  studentId: string;
  nameEn: string;
  nameAr: string | null;
  status: 'pending' | 'picked_up' | 'dropped_off' | 'absent' | 'cancelled' | 'not_confirmed' | 'exception';
}

export async function fetchStopStudents(dailyRouteStopId: string): Promise<StopStudent[]> {
  const { data, error } = await supabase
    .from('daily_student_assignments')
    .select('id, status, students(id, name_en, name_ar)')
    .eq('daily_route_stop_id', dailyRouteStopId);

  if (error || !data) return [];

  return data.map((row) => ({
    assignmentId: row.id,
    // @ts-expect-error -- joined field
    studentId: row.students?.id ?? '',
    // @ts-expect-error -- joined field
    nameEn: row.students?.name_en ?? '—',
    // @ts-expect-error -- joined field
    nameAr: row.students?.name_ar ?? null,
    status: row.status,
  }));
}
