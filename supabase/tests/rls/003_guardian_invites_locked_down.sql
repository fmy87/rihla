-- supabase/tests/rls/003_guardian_invites_locked_down.sql
-- guardian_invites (migration 0018) is designed to be readable by NOBODY
-- except an admin of the invite's own school — not even the parent it was
-- created for, and not anon (who has no session at all when they first
-- open an invite link). Everything else goes through the
-- accept-guardian-invite Edge Function's service role. This test is the
-- one most worth having: a single missing "using (false)" default here
-- would leak invite tokens (and therefore let anyone claim any student)
-- to whichever role got left open by accident.

begin;
select plan(5);

-- Admin A can see the one invite that belongs to their school.
select set_config('request.jwt.claim.sub', 'a0a00000-0000-0000-0000-0000000000a1', true);
set local role authenticated;

select is(
  (select count(*)::int from guardian_invites),
  1,
  'Admin A sees school A''s one guardian invite'
);

reset role;

-- Admin B (different school) sees none of it.
select set_config('request.jwt.claim.sub', 'a0a00000-0000-0000-0000-0000000000a2', true);
set local role authenticated;

select is(
  (select count(*)::int from guardian_invites),
  0,
  'Admin B sees zero guardian invites — it belongs to school A, not school B'
);

reset role;

-- Parent One (an authenticated, but non-admin, user of the SAME school)
-- sees none of it either — there is no parent-facing read path for this
-- table at all, by design.
select set_config('request.jwt.claim.sub', 'a0a00000-0000-0000-0000-0000000000e1', true);
set local role authenticated;

select is(
  (select count(*)::int from guardian_invites),
  0,
  'Parent One sees zero guardian invites, even for their own school — no parent-facing policy exists on this table'
);

reset role;

-- A driver (also authenticated, also same school) — same story.
select set_config('request.jwt.claim.sub', 'a0a00000-0000-0000-0000-0000000000d1', true);
set local role authenticated;

select is(
  (select count(*)::int from guardian_invites),
  0,
  'Driver A1 sees zero guardian invites'
);

reset role;

-- anon (no session at all — the actual state of a parent who just clicked
-- an invite link and hasn't signed in yet) sees nothing, confirming the
-- table has no anon-facing policy either.
set local role anon;

select is(
  (select count(*)::int from guardian_invites),
  0,
  'An anonymous (unauthenticated) session sees zero guardian invites'
);

reset role;

select * from finish();
rollback;
