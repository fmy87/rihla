import { supabase } from '../supabaseClient';

export interface AlertRow {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  messageEn: string;
  messageAr: string | null;
  busNumber: string | null;
  routeName: string | null;
  studentName: string | null;
  deviationDistanceMeters: number | null;
  isResolved: boolean;
  createdAt: string;
}

export async function fetchAlerts(schoolId: string, includeResolved: boolean): Promise<AlertRow[]> {
  let query = supabase
    .from('alerts')
    .select(
      'id, type, severity, message_en, message_ar, deviation_distance_meters, is_resolved, created_at, buses(bus_number), daily_routes(routes(name_en)), students(name_en)'
    )
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!includeResolved) query = query.eq('is_resolved', false);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    type: row.type,
    severity: row.severity,
    messageEn: row.message_en,
    messageAr: row.message_ar,
    // @ts-expect-error -- joined field
    busNumber: row.buses?.bus_number ?? null,
    // @ts-expect-error -- joined field
    routeName: row.daily_routes?.routes?.name_en ?? null,
    // @ts-expect-error -- joined field
    studentName: row.students?.name_en ?? null,
    deviationDistanceMeters: row.deviation_distance_meters,
    isResolved: row.is_resolved,
    createdAt: row.created_at,
  }));
}

export async function resolveAlert(alertId: string, resolvedByUserId: string, notes?: string) {
  return supabase
    .from('alerts')
    .update({ is_resolved: true, resolved_by: resolvedByUserId, resolved_at: new Date().toISOString(), resolution_notes: notes ?? null })
    .eq('id', alertId);
}
