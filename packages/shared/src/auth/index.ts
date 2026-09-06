import type { UserRole } from '../types/database';

/** Row shape returned by `select * from users where id = auth.uid()`. */
export interface AppUserProfile {
  id: string;
  school_id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  phone: string | null;
  preferred_language: 'en' | 'ar';
  is_active: boolean;
}

export interface AuthState {
  status: 'loading' | 'signed_out' | 'signed_in';
  profile: AppUserProfile | null;
}

/**
 * Drivers log in with (School + Employee ID + PIN), not an email/password.
 * Supabase Auth still needs an email/password pair under the hood, so we
 * resolve the driver's synthetic login email via the `resolve_driver_login_email`
 * RPC (see supabase/migrations/0008_driver_login_lookup.sql) before calling
 * supabase.auth.signInWithPassword. The PIN itself IS the Supabase Auth
 * password — this keeps one auth system for both admin and driver logins
 * instead of a second bespoke mechanism.
 */
export async function resolveDriverLoginEmail(
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  schoolId: string,
  employeeId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_driver_login_email', {
    p_school_id: schoolId,
    p_employee_id: employeeId,
  });
  if (error) return null;
  return (data as string) ?? null;
}

/** Role → allowed nav sections, used to drive both routing guards and menu rendering. */
export const ROLE_HOME_ROUTE: Record<UserRole, string> = {
  super_admin: '/dashboard',
  transport_admin: '/dashboard',
  driver: '/today', // driver app only, admin web never issues this role a session
};

export function isAdminRole(role: UserRole): boolean {
  return role === 'super_admin' || role === 'transport_admin';
}
