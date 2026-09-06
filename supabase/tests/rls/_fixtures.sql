-- supabase/tests/rls/_fixtures.sql
-- Deterministic fixture data for the RLS test suite. Deliberately separate
-- from supabase/seed/seed.sql, which uses uuid_generate_v4() for students —
-- fine for demo data, useless for tests that need to reference a specific
-- row's id. Every id below is hand-assigned and stable.
--
-- Layout: two schools (A/B, to test tenant isolation), one admin/driver per
-- school, two students in school A with two different parents (to test
-- parent-to-parent isolation within the same school), and one daily route
-- + GPS ping + guardian invite for the RLS tests that need them.
--
-- ID scheme (all valid hex, since Postgres uuid columns reject non-hex
-- characters): a0a00000-0000-0000-0000-<12 hex chars encoding the role>.
--   a1/a2 = admin A/B      d1    = driver A1 (auth user)   c1 = driver A1 (drivers row)
--   e1/e2 = parent 1/2     b1/b2 = bus A1/B1                f1 = route A1
--   1001  = route stop     2001/2002 = student 1/2
--   3001  = daily_route    4001  = daily_route_stop         5001 = daily_student_assignment
--   6001  = gps_location   7001  = guardian_invite

insert into schools (id, name_en, timezone) values
  ('a0a00000-0000-0000-0000-000000000001', 'Fixture School A', 'Asia/Muscat'),
  ('a0a00000-0000-0000-0000-000000000002', 'Fixture School B', 'Asia/Muscat');

-- Auth + profile rows. auth.users is the local mock from ../_auth_mock.sql.
insert into auth.users (id, email) values
  ('a0a00000-0000-0000-0000-0000000000a1', 'admin.a@fixture.test'),
  ('a0a00000-0000-0000-0000-0000000000a2', 'admin.b@fixture.test'),
  ('a0a00000-0000-0000-0000-0000000000d1', 'driver.a1@fixture.test'),
  ('a0a00000-0000-0000-0000-0000000000e1', 'parent.one@fixture.test'),
  ('a0a00000-0000-0000-0000-0000000000e2', 'parent.two@fixture.test');

insert into users (id, school_id, role, full_name, email) values
  ('a0a00000-0000-0000-0000-0000000000a1', 'a0a00000-0000-0000-0000-000000000001', 'super_admin', 'Admin A', 'admin.a@fixture.test'),
  ('a0a00000-0000-0000-0000-0000000000a2', 'a0a00000-0000-0000-0000-000000000002', 'transport_admin', 'Admin B', 'admin.b@fixture.test'),
  ('a0a00000-0000-0000-0000-0000000000d1', 'a0a00000-0000-0000-0000-000000000001', 'driver', 'Driver A1', 'driver.a1@fixture.test'),
  ('a0a00000-0000-0000-0000-0000000000e1', 'a0a00000-0000-0000-0000-000000000001', 'parent', 'Parent One', 'parent.one@fixture.test'),
  ('a0a00000-0000-0000-0000-0000000000e2', 'a0a00000-0000-0000-0000-000000000001', 'parent', 'Parent Two', 'parent.two@fixture.test');

insert into buses (id, school_id, bus_number, registration_number, capacity) values
  ('a0a00000-0000-0000-0000-0000000000b1', 'a0a00000-0000-0000-0000-000000000001', 'FX-BUS-A1', 'REG-A1', 20),
  ('a0a00000-0000-0000-0000-0000000000b2', 'a0a00000-0000-0000-0000-000000000002', 'FX-BUS-B1', 'REG-B1', 20);

insert into drivers (id, school_id, user_id, employee_id, full_name, phone) values
  ('a0a00000-0000-0000-0000-0000000000c1', 'a0a00000-0000-0000-0000-000000000001', 'a0a00000-0000-0000-0000-0000000000d1', 'FX-EMP-001', 'Driver A1', '+96890000001');

insert into routes (id, school_id, name_en, direction, default_bus_id, default_driver_id) values
  ('a0a00000-0000-0000-0000-0000000000f1', 'a0a00000-0000-0000-0000-000000000001', 'Fixture Route A1', 'home_to_school', 'a0a00000-0000-0000-0000-0000000000b1', 'a0a00000-0000-0000-0000-0000000000c1');

insert into route_stops (id, route_id, sequence, name_en, location, stop_type) values
  ('a0a00000-0000-0000-0000-000000001001', 'a0a00000-0000-0000-0000-0000000000f1', 1, 'Fixture Stop 1', ST_SetSRID(ST_MakePoint(58.20, 23.61), 4326)::geography, 'pickup');

insert into students (id, school_id, student_code, name_en, guardian_user_id) values
  ('a0a00000-0000-0000-0000-000000002001', 'a0a00000-0000-0000-0000-000000000001', 'FX-STU-001', 'Student One', 'a0a00000-0000-0000-0000-0000000000e1'),
  ('a0a00000-0000-0000-0000-000000002002', 'a0a00000-0000-0000-0000-000000000001', 'FX-STU-002', 'Student Two', 'a0a00000-0000-0000-0000-0000000000e2');

insert into daily_routes (id, school_id, route_id, service_date, bus_id, driver_id, status) values
  ('a0a00000-0000-0000-0000-000000003001', 'a0a00000-0000-0000-0000-000000000001', 'a0a00000-0000-0000-0000-0000000000f1', current_date, 'a0a00000-0000-0000-0000-0000000000b1', 'a0a00000-0000-0000-0000-0000000000c1', 'on_route');

insert into daily_route_stops (id, daily_route_id, route_stop_id, sequence, name_en, location, stop_type) values
  ('a0a00000-0000-0000-0000-000000004001', 'a0a00000-0000-0000-0000-000000003001', 'a0a00000-0000-0000-0000-000000001001', 1, 'Fixture Stop 1', ST_SetSRID(ST_MakePoint(58.20, 23.61), 4326)::geography, 'pickup');

-- Only Student One is on today's run — Student Two is used purely to prove
-- Parent Two can't see Student One's data, not because Student Two has any
-- assignment of their own today.
insert into daily_student_assignments (id, daily_route_stop_id, student_id, status) values
  ('a0a00000-0000-0000-0000-000000005001', 'a0a00000-0000-0000-0000-000000004001', 'a0a00000-0000-0000-0000-000000002001', 'pending');

insert into gps_locations (id, daily_route_id, bus_id, driver_id, location, recorded_at) values
  ('a0a00000-0000-0000-0000-000000006001', 'a0a00000-0000-0000-0000-000000003001', 'a0a00000-0000-0000-0000-0000000000b1', 'a0a00000-0000-0000-0000-0000000000c1', ST_SetSRID(ST_MakePoint(58.199, 23.609), 4326)::geography, now());

insert into guardian_invites (id, school_id, student_id, token, expires_at) values
  ('a0a00000-0000-0000-0000-000000007001', 'a0a00000-0000-0000-0000-000000000001', 'a0a00000-0000-0000-0000-000000002002', 'fixture-token-unused', now() + interval '7 days');
