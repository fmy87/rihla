import { supabase } from '../supabaseClient';

const DEFAULT_INTERVAL_SECONDS = 15;

export async function fetchGpsIntervalSeconds(schoolId: string): Promise<number> {
  const { data } = await supabase
    .from('system_settings')
    .select('gps_update_interval_seconds')
    .eq('school_id', schoolId)
    .maybeSingle();
  return data?.gps_update_interval_seconds ?? DEFAULT_INTERVAL_SECONDS;
}
