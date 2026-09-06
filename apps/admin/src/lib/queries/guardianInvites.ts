import { supabase } from '../supabaseClient';
export { buildInviteUrl } from '../inviteUrl';

export interface GuardianInvite {
  id: string;
  token: string;
  studentId: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}


/** Creates a fresh 7-day invite link for a student. RLS (migration 0018)
 *  restricts this to admins of the student's own school. */
export async function createGuardianInvite(
  schoolId: string,
  studentId: string,
  createdByUserId: string
): Promise<{ token: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('guardian_invites')
    .insert({ school_id: schoolId, student_id: studentId, created_by: createdByUserId })
    .select('token')
    .single();

  if (error || !data) return { token: null, error: error?.message ?? 'unknown_error' };
  return { token: data.token, error: null };
}

export async function fetchActiveInvite(studentId: string): Promise<GuardianInvite | null> {
  const { data, error } = await supabase
    .from('guardian_invites')
    .select('id, token, student_id, expires_at, used_at, created_at')
    .eq('student_id', studentId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: data.id,
    token: data.token,
    studentId: data.student_id,
    expiresAt: data.expires_at,
    usedAt: data.used_at,
    createdAt: data.created_at,
  };
}
