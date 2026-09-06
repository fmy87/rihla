-- supabase/tests/rls/001_multi_tenant_isolation.sql
-- The foundational guarantee everything else in this app depends on: an
-- admin can only ever see their own school's rows. If this breaks, every
-- other RLS test in this suite is testing on top of a cracked foundation.
-- Run after migrations + _fixtures.sql are loaded — see
-- docs/testing-rls.md for how.

begin;
select plan(6);

-- Admin A (school A) sees exactly school A's one fixture bus.
select set_config('request.jwt.claim.sub', 'a0a00000-0000-0000-0000-0000000000a1', true);
set local role authenticated;

select results_eq(
  $$ select bus_number from buses order by bus_number $$,
  $$ values ('FX-BUS-A1') $$,
  'Admin A sees only school A''s bus, not school B''s'
);

select is(
  (select count(*)::int from students),
  2,
  'Admin A sees both of school A''s fixture students'
);

select is(
  (select count(*)::int from drivers),
  1,
  'Admin A sees school A''s one fixture driver'
);

reset role;

-- Admin B (school B) sees exactly school B's one fixture bus — the mirror
-- image of the above, proving isolation runs both directions, not just
-- "school A can't see out" without checking "school B can't see in".
select set_config('request.jwt.claim.sub', 'a0a00000-0000-0000-0000-0000000000a2', true);
set local role authenticated;

select results_eq(
  $$ select bus_number from buses order by bus_number $$,
  $$ values ('FX-BUS-B1') $$,
  'Admin B sees only school B''s bus, not school A''s'
);

select is(
  (select count(*)::int from students),
  0,
  'Admin B sees none of school A''s students'
);

select is(
  (select count(*)::int from drivers),
  0,
  'Admin B sees none of school A''s drivers (school B has none of its own in this fixture set)'
);

reset role;

select * from finish();
rollback;
