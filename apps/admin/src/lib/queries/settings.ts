import { supabase } from '../supabaseClient';

export interface SystemSettingsRow {
  school_id: string;
  gps_update_interval_seconds: number;
  stop_geofence_radius_meters: number;
  route_deviation_threshold_meters: number;
  pickup_grace_period_minutes: number;
  bus_offline_threshold_minutes: number;
  updated_at: string;
}

export type SystemSettingsInput = Omit<SystemSettingsRow, 'school_id' | 'updated_at'>;

export async function fetchSystemSettings(schoolId: string): Promise<SystemSettingsRow | null> {
  const { data, error } = await supabase
    .from('system_settings')
    .select(
      'school_id, gps_update_interval_seconds, stop_geofence_radius_meters, route_deviation_threshold_meters, pickup_grace_period_minutes, bus_offline_threshold_minutes, updated_at'
    )
    .eq('school_id', schoolId)
    .single();

  if (error || !data) return null;
  return data;
}

export async function updateSystemSettings(schoolId: string, input: SystemSettingsInput) {
  return supabase.from('system_settings').update(input).eq('school_id', schoolId);
}
