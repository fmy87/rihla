// supabase/functions/create-staff-account/index.ts
//
// Creates a login-capable account for an admin (super_admin/transport_admin,
// email + temporary password) or a driver (Employee ID + PIN). This must run
// server-side because creating an auth.users row requires the service role
// key, which is never shipped to the admin web bundle.
//
// Deploy: supabase functions deploy create-staff-account
// Invoke (from the admin app, while signed in as an admin): 
//   supabase.functions.invoke('create-staff-account', { body: {...} })
// The function itself re-checks the caller's role server-side before doing
// anything — a valid admin session is required, RLS-style, even though this
// runs with the service role internally.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { isPinValid } from '../_shared/validation.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Edge Functions don't get CORS headers for free — without these, every
// call from the admin web app (a browser, on a different origin from the
// function's own URL) fails with a CORS error before the request body is
// even sent. This is a required, not optional, part of any browser-invoked
// Edge Function.
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

interface AdminAccountInput {
  role: 'super_admin' | 'transport_admin';
  full_name: string;
  email: string;
  phone?: string;
}

interface DriverAccountInput {
  role: 'driver';
  full_name: string;
  employee_id: string;
  pin: string; // becomes the Supabase Auth password — validate length client-side (>= 6)
  phone?: string;
  license_number?: string;
  license_expiry?: string; // YYYY-MM-DD
}

type RequestBody = (AdminAccountInput | DriverAccountInput) & { school_id: string };

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'missing_auth' }, 401);
  }

  // Client bound to the CALLER's JWT — used only to verify who is asking.
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: callerAuthUser },
  } = await callerClient.auth.getUser();
  if (!callerAuthUser) {
    return jsonResponse({ error: 'invalid_session' }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: callerProfile } = await admin
    .from('users')
    .select('role, school_id, is_active')
    .eq('id', callerAuthUser.id)
    .single();

  if (!callerProfile || !callerProfile.is_active || !['super_admin', 'transport_admin'].includes(callerProfile.role)) {
    return jsonResponse({ error: 'forbidden' }, 403);
  }

  const body = (await req.json()) as RequestBody;

  // A driver can only be created for the caller's own school.
  if (body.school_id !== callerProfile.school_id) {
    return jsonResponse({ error: 'school_mismatch' }, 403);
  }
  // Only super_admin may create another admin account.
  if (body.role !== 'driver' && callerProfile.role !== 'super_admin') {
    return jsonResponse({ error: 'forbidden' }, 403);
  }

  try {
    if (body.role === 'driver') {
      return await createDriverAccount(admin, body as DriverAccountInput & { school_id: string }, callerAuthUser.id);
    }
    return await createAdminAccount(admin, body as AdminAccountInput & { school_id: string }, callerAuthUser.id);
  } catch (err) {
    return jsonResponse({ error: 'unexpected', detail: String(err) }, 500);
  }
});

async function createAdminAccount(
  admin: ReturnType<typeof createClient>,
  input: AdminAccountInput & { school_id: string },
  actorUserId: string
) {
  const tempPassword = crypto.randomUUID();

  const { data: authUser, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
    email_confirm: true,
  });
  if (createError || !authUser.user) {
    return jsonResponse({ error: 'auth_create_failed', detail: createError?.message }, 400);
  }

  const { error: profileError } = await admin.from('users').insert({
    id: authUser.user.id,
    school_id: input.school_id,
    role: input.role,
    full_name: input.full_name,
    email: input.email,
    phone: input.phone ?? null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id); // roll back the orphaned auth user
    return jsonResponse({ error: 'profile_create_failed', detail: profileError.message }, 400);
  }

  // Send a real password-set link rather than emailing a temp password.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: input.email,
  });

  await admin.from('audit_logs').insert({
    school_id: input.school_id,
    actor_user_id: actorUserId,
    action: 'user.created',
    entity_type: 'users',
    entity_id: authUser.user.id,
    metadata: { role: input.role, email: input.email },
  });

  return jsonResponse(
    {
      user_id: authUser.user.id,
      password_set_link: linkError ? null : link?.properties?.action_link ?? null,
    },
    200
  );
}

async function createDriverAccount(
  admin: ReturnType<typeof createClient>,
  input: DriverAccountInput & { school_id: string },
  actorUserId: string
) {
  if (!isPinValid(input.pin)) {
    return jsonResponse({ error: 'pin_too_short' }, 400);
  }

  // Insert the driver row first so the `generate_driver_login_email` trigger
  // (migration 0008) assigns login_email deterministically.
  const { data: driverRow, error: driverInsertError } = await admin
    .from('drivers')
    .insert({
      school_id: input.school_id,
      employee_id: input.employee_id,
      full_name: input.full_name,
      phone: input.phone ?? null,
      license_number: input.license_number ?? null,
      license_expiry: input.license_expiry ?? null,
    })
    .select('id, login_email')
    .single();

  if (driverInsertError || !driverRow) {
    return jsonResponse({ error: 'driver_create_failed', detail: driverInsertError?.message }, 400);
  }

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: driverRow.login_email,
    password: input.pin,
    email_confirm: true,
  });
  if (authError || !authUser.user) {
    await admin.from('drivers').delete().eq('id', driverRow.id); // roll back
    return jsonResponse({ error: 'auth_create_failed', detail: authError?.message }, 400);
  }

  const { error: profileError } = await admin.from('users').insert({
    id: authUser.user.id,
    school_id: input.school_id,
    role: 'driver',
    full_name: input.full_name,
    phone: input.phone ?? null,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(authUser.user.id);
    await admin.from('drivers').delete().eq('id', driverRow.id);
    return jsonResponse({ error: 'profile_create_failed', detail: profileError.message }, 400);
  }

  await admin.from('drivers').update({ user_id: authUser.user.id }).eq('id', driverRow.id);

  await admin.from('audit_logs').insert({
    school_id: input.school_id,
    actor_user_id: actorUserId,
    action: 'driver.created',
    entity_type: 'drivers',
    entity_id: driverRow.id,
    metadata: { employee_id: input.employee_id, full_name: input.full_name },
  });

  return jsonResponse({ driver_id: driverRow.id, user_id: authUser.user.id }, 200);
}
