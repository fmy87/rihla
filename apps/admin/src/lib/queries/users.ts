import { supabase } from '../supabaseClient';

export interface AdminUserRow {
  id: string;
  full_name: string;
  email: string | null;
  role: 'super_admin' | 'transport_admin';
  is_active: boolean;
}

export interface AdminAccountInput {
  full_name: string;
  email: string;
  role: 'super_admin' | 'transport_admin';
  phone?: string;
}

export async function fetchAdminUsers(schoolId: string): Promise<AdminUserRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, is_active')
    .eq('school_id', schoolId)
    .in('role', ['super_admin', 'transport_admin'])
    .order('full_name', { ascending: true });

  if (error || !data) return [];
  return data as AdminUserRow[];
}

/** Creates the auth user + `users` row via the Edge Function and returns a
 * one-time password-set link to hand to the new admin. */
export async function createAdminAccount(schoolId: string, input: AdminAccountInput) {
  return supabase.functions.invoke<{ password_set_link: string | null }>('create-staff-account', {
    body: { school_id: schoolId, ...input },
  });
}

export async function setUserActive(userId: string, isActive: boolean) {
  return supabase.from('users').update({ is_active: isActive }).eq('id', userId);
}
