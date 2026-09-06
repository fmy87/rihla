// supabase/functions/accept-guardian-invite/index.ts
//
// Two actions, one function (same shape as create-staff-account):
//   { action: 'verify', token }                       — public, no auth required
//   { action: 'accept', token, email, password, full_name } — public, no auth required
//
// This is the ONLY way a guardian_invites row is ever read or redeemed —
// there is no RLS policy granting anon/parent access to that table at all
// (see migration 0018). A parent has no account yet when they open the
// invite link, so this has to run before any session exists, same reason
// create-staff-account can't run client-side: creating/linking an
// auth.users row needs the service role key.
//
// Deploy: supabase functions deploy accept-guardian-invite --no-verify-jwt
// (--no-verify-jwt because this must be callable with no session at all)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { checkInviteUsable, hasExceededInviteAttempts, isEmailPresent, isFullNamePresent, isPasswordValid } from '../_shared/validation.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface VerifyBody {
  action: 'verify';
  token: string;
}
interface AcceptBody {
  action: 'accept';
  token: string;
  email: string;
  password: string; // used to create a NEW account, or to verify an EXISTING one being linked to a second child
  full_name: string; // ignored if linking to an existing account
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const body = (await req.json()) as VerifyBody | AcceptBody;

  const { data: invite, error: inviteError } = await admin
    .from('guardian_invites')
    .select(
      'id, school_id, student_id, expires_at, used_at, failed_attempts, students(name_en, name_ar), schools(name_en, name_ar)'
    )
    .eq('token', body.token)
    .maybeSingle();

  if (inviteError || !invite) return jsonResponse({ error: 'invite_not_found' }, 404);
  const usable = checkInviteUsable({ usedAt: invite.used_at, expiresAt: invite.expires_at });
  if (!usable.ok) return jsonResponse({ error: usable.error }, 410);

  if (body.action === 'verify') {
    return jsonResponse(
      {
        valid: true,
        // @ts-expect-error -- joined fields
        student_name: invite.students?.name_en,
        // @ts-expect-error -- joined fields
        school_name: invite.schools?.name_en,
      },
      200
    );
  }

  if (body.action !== 'accept') return jsonResponse({ error: 'unknown_action' }, 400);

  const accept = body as AcceptBody;
  if (!isEmailPresent(accept.email) || !isPasswordValid(accept.password)) {
    return jsonResponse({ error: 'invalid_input' }, 400);
  }

  // A parent may already have a portal account from a previous invite (an
  // earlier child) — link this student to that account instead of creating
  // a duplicate. Matched by email + school, and the given password must
  // actually authenticate that account (proves the caller owns it). That
  // signInWithPassword call is the one guessable secret in this whole
  // flow — the token itself is 192 bits of randomness, but a password is
  // not — so it's the one path that gets rate-limited per invite.
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('school_id', invite.school_id)
    .eq('role', 'parent')
    .eq('email', accept.email)
    .maybeSingle();

  let guardianUserId: string;

  if (existingUser) {
    if (hasExceededInviteAttempts(invite.failed_attempts)) {
      return jsonResponse({ error: 'too_many_attempts' }, 429);
    }

    const { data: signInData, error: signInError } = await admin.auth.signInWithPassword({
      email: accept.email,
      password: accept.password,
    });
    if (signInError || !signInData.user || signInData.user.id !== existingUser.id) {
      await admin
        .from('guardian_invites')
        .update({ failed_attempts: invite.failed_attempts + 1 })
        .eq('id', invite.id);
      return jsonResponse({ error: 'existing_account_wrong_password' }, 401);
    }
    guardianUserId = existingUser.id;
  } else {
    if (!isFullNamePresent(accept.full_name)) return jsonResponse({ error: 'full_name_required' }, 400);

    const { data: authUser, error: createError } = await admin.auth.admin.createUser({
      email: accept.email,
      password: accept.password,
      email_confirm: true,
    });
    if (createError || !authUser.user) {
      return jsonResponse({ error: 'auth_create_failed', detail: createError?.message }, 400);
    }

    const { error: profileError } = await admin.from('users').insert({
      id: authUser.user.id,
      school_id: invite.school_id,
      role: 'parent',
      full_name: accept.full_name.trim(),
      email: accept.email,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(authUser.user.id); // roll back the orphaned auth user
      return jsonResponse({ error: 'profile_create_failed', detail: profileError.message }, 400);
    }
    guardianUserId = authUser.user.id;
  }

  const { error: linkError } = await admin
    .from('students')
    .update({ guardian_user_id: guardianUserId })
    .eq('id', invite.student_id);
  if (linkError) return jsonResponse({ error: 'link_failed', detail: linkError.message }, 400);

  await admin
    .from('guardian_invites')
    .update({ used_at: new Date().toISOString(), used_by_user_id: guardianUserId })
    .eq('id', invite.id);

  await admin.from('audit_logs').insert({
    school_id: invite.school_id,
    actor_user_id: guardianUserId,
    action: 'guardian_invite.accepted',
    entity_type: 'students',
    entity_id: invite.student_id,
    metadata: { email: accept.email, linked_existing_account: !!existingUser },
  });

  return jsonResponse({ user_id: guardianUserId, student_id: invite.student_id }, 200);
});
