-- supabase/tests/rls/005_driver_write_scope.sql
-- The other write-side gap 001-004 don't cover: a DRIVER's write access
-- (daily_routes_driver_update, dsa_write's driver branch, etc.) scoped to
-- "only my own assigned route," not just "only my own school" — two
-- drivers in the SAME school must not be able to touch each other's
-- routes. Self-contained (ids prefixed c0c00000), rolled back at the end.

begin;
select plan(4);

insert into schools (id, name_en) values ('c0c00000-0000-0000-0000-000000000001', 'Driver Write Test School');

insert into auth.users (id, email) values
  ('c0c00000-0000-0000-0000-0000000000d1', 'driver.write.1@fixture.test'),
  ('c0c00000-0000-0000-0000-0000000000d2', 'driver.write.2@fixture.test');
insert into users (id, school_id, role, full_name, email) values
  ('c0c00000-0000-0000-0000-0000000000d1', 'c0c00000-0000-0000-0000-000000000001', 'driver', 'Driver One', 'driver.write.1@fixture.test'),
  ('c0c00000-0000-0000-0000-0000000000d2', 'c0c00000-0000-0000-0000-000000000001', 'driver', 'Driver Two', 'driver.write.2@fixture.test');

insert into buses (id, school_id, bus_number, registration_number, capacity) values
  ('c0c00000-0000-0000-0000-0000000000b1', 'c0c00000-0000-0000-0000-000000000001', 'DW-BUS-1', 'DW-REG-1', 20),
  ('c0c00000-0000-0000-0000-0000000000b2', 'c0c00000-0000-0000-0000-000000000001', 'DW-BUS-2', 'DW-REG-2', 20);

insert into drivers (id, school_id, user_id, employee_id, full_name) values
  ('c0c00000-0000-0000-0000-0000000000c1', 'c0c00000-0000-0000-0000-000000000001', 'c0c00000-0000-0000-0000-0000000000d1', 'DW-EMP-1', 'Driver One'),
  ('c0c00000-0000-0000-0000-0000000000c2', 'c0c00000-0000-0000-0000-000000000001', 'c0c00000-0000-0000-0000-0000000000d2', 'DW-EMP-2', 'Driver Two');

insert into routes (id, school_id, name_en, direction, default_bus_id, default_driver_id) values
  ('c0c00000-0000-0000-0000-0000000000f1', 'c0c00000-0000-0000-0000-000000000001', 'Driver Write Route 1', 'home_to_school', 'c0c00000-0000-0000-0000-0000000000b1', 'c0c00000-0000-0000-0000-0000000000c1'),
  ('c0c00000-0000-0000-0000-0000000000f2', 'c0c00000-0000-0000-0000-000000000001', 'Driver Write Route 2', 'home_to_school', 'c0c00000-0000-0000-0000-0000000000b2', 'c0c00000-0000-0000-0000-0000000000c2');

insert into daily_routes (id, school_id, route_id, service_date, bus_id, driver_id, status) values
  ('c0c00000-0000-0000-0000-000000003001', 'c0c00000-0000-0000-0000-000000000001', 'c0c00000-0000-0000-0000-0000000000f1', current_date, 'c0c00000-0000-0000-0000-0000000000b1', 'c0c00000-0000-0000-0000-0000000000c1', 'not_started'),
  ('c0c00000-0000-0000-0000-000000003002', 'c0c00000-0000-0000-0000-000000000001', 'c0c00000-0000-0000-0000-0000000000f2', current_date, 'c0c00000-0000-0000-0000-0000000000b2', 'c0c00000-0000-0000-0000-0000000000c2', 'not_started');

select set_config('request.jwt.claim.sub', 'c0c00000-0000-0000-0000-0000000000d1', true);
set local role authenticated;

-- Driver One can update their own daily_route's status.
select results_eq(
  $$ update daily_routes set status = 'on_route' where id = 'c0c00000-0000-0000-0000-000000003001' returning status::text $$,
  $$ values ('on_route') $$,
  'Driver One can update their own daily_route''s status'
);

-- Driver One's attempt to update Driver Two's daily_route is a silent no-op.
update daily_routes set status = 'on_route' where id = 'c0c00000-0000-0000-0000-000000003002';

-- Driver One cannot INSERT a brand-new daily_route at all — only admins can
-- (daily_routes_admin_insert is the only INSERT policy; there's no
-- driver-insert policy, so this must be rejected outright, not merely
-- filtered).
select throws_ok(
  $$ insert into daily_routes (id, school_id, route_id, service_date, bus_id, driver_id, status)
     values ('c0c00000-0000-0000-0000-000000003003', 'c0c00000-0000-0000-0000-000000000001', 'c0c00000-0000-0000-0000-0000000000f1', current_date + 1, 'c0c00000-0000-0000-0000-0000000000b1', 'c0c00000-0000-0000-0000-0000000000c1', 'not_started') $$,
  '42501',
  'new row violates row-level security policy for table "daily_routes"',
  'Driver One cannot INSERT a new daily_route at all — that''s admin-only'
);

-- Confirm Driver Two's route was genuinely untouched (checked as postgres,
-- which bypasses RLS).
reset role;
select is(
  (select status::text from daily_routes where id = 'c0c00000-0000-0000-0000-000000003002'),
  'not_started',
  'Driver Two''s daily_route status was not changed by Driver One'
);

-- And Driver One's own route really did change, confirming the earlier
-- results_eq wasn't itself silently filtered to zero rows in a way that
-- happened to look like a match.
select is(
  (select status::text from daily_routes where id = 'c0c00000-0000-0000-0000-000000003001'),
  'on_route',
  'Driver One''s own daily_route status really did change'
);

select * from finish();
rollback;
