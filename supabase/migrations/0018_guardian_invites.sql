-- 0018_guardian_invites.sql
-- Lets an admin generate a one-time link a parent uses to create their own
-- parent-portal account and get linked to their child, instead of an admin
-- having to set students.guardian_user_id by hand for every family.
--
-- The table itself has no policy allowing anon/parent access at all — token
-- verification and redemption both happen through the
-- `accept-guardian-invite` Edge Function using the service role, the same
-- pattern create-staff-account already uses for account creation. That
-- function re-validates the token, expiry, and used_at itself; RLS here
-- only needs to cover the admin side (create/list/revoke).

create table guardian_invites (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_by uuid references users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz,
  used_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_guardian_invites_student on guardian_invites(student_id);
create index idx_guardian_invites_school on guardian_invites(school_id);

comment on table guardian_invites is
  'One-time signup links for the parent portal. token is looked up only by '
  'the accept-guardian-invite Edge Function (service role) — never exposed '
  'to RLS for anon/parent roles.';

alter table guardian_invites enable row level security;

create policy guardian_invites_admin_all on guardian_invites for all
  using (school_id = current_user_school_id() and is_admin())
  with check (school_id = current_user_school_id() and is_admin());
