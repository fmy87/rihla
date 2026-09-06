import { supabase } from '../supabaseClient';

export interface DriverRow {
  id: string;
  employee_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  license_number: string | null;
  license_expiry: string | null;
  is_active: boolean;
  has_login: boolean;
}

export interface DriverAccountInput {
  full_name: string;
  employee_id: string;
  pin: string;
  phone?: string;
  license_number?: string;
  license_expiry?: string;
}

export async function fetchDrivers(schoolId: string): Promise<DriverRow[]> {
  const { data, error } = await supabase
    .from('drivers')
    .select('id, employee_id, full_name, phone, email, license_number, license_expiry, is_active, user_id')
    .eq('school_id', schoolId)
    .order('full_name', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    employee_id: row.employee_id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    license_number: row.license_number,
    license_expiry: row.license_expiry,
    is_active: row.is_active,
    has_login: !!row.user_id,
  }));
}

/**
 * Creates BOTH the login (Supabase Auth user + `users` row) and the
 * `drivers` row in one call, via the `create-staff-account` Edge Function —
 * this can't be done from the client directly because it requires the
 * service role key. See supabase/functions/create-staff-account.
 */
export async function createDriverAccount(schoolId: string, input: DriverAccountInput) {
  return supabase.functions.invoke('create-staff-account', {
    body: { role: 'driver', school_id: schoolId, ...input },
  });
}

export async function updateDriverProfile(
  driverId: string,
  input: Partial<{
    full_name: string;
    phone: string | null;
    license_number: string | null;
    license_expiry: string | null;
    is_active: boolean;
  }>
) {
  return supabase.from('drivers').update(input).eq('id', driverId);
}
