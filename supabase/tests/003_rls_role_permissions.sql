-- 003_rls_role_permissions.sql
-- Verifies the core RLS promise from the architecture doc: "a driver must
-- never be able to query another driver's students or routes." Run this
-- against a database where migrations 0001-0013 have been applied.
--
-- This test simulates an authenticated request by setting
-- request.jwt.claim.sub — the flat per-claim GUC Supabase's real
-- auth.uid() reads (`select current_setting('request.jwt.claim.sub',
-- true)::uuid`), NOT a `request.jwt.claims` JSON blob (an earlier version
-- of this file used that instead, which meant auth.uid() always returned
-- null and every assertion below failed for the wrong reason — "RLS is
-- over-restrictive" when the real problem was that the simulated driver
-- was never actually authenticated as anyone. Found by actually running
-- this file for the first time; see docs/testing-rls.md.) — then runs
-- queries as the `authenticated` role so RLS actually applies — a
-- superuser/service role connection bypasses RLS entirely and would make
-- this test meaningless.
--
-- Run with: psql "$DATABASE_URL" -f supabase/tests/003_rls_role_permissions.sql
-- (requires a role named `authenticated` to exist, which Supabase projects
-- have by default).

do $$
declare
  v_school_id uuid;
  v_bus_a uuid; v_bus_b uuid;
  v_driver_a_id uuid; v_driver_b_id uuid;
  v_driver_a_auth_id uuid := gen_random_uuid();
  v_driver_b_auth_id uuid := gen_random_uuid();
  v_route_a uuid; v_route_b uuid;
  v_student_a uuid; v_student_b uuid;
  v_visible_students int;
begin
  insert into schools (id, name_en) values (gen_random_uuid(), 'RLS Test School') returning id into v_school_id;
  insert into buses (id, school_id, bus_number, registration_number, capacity)
    values (gen_random_uuid(), v_school_id, 'RLS-01', 'REG-RLS-1', 20) returning id into v_bus_a;
  insert into buses (id, school_id, bus_number, registration_number, capacity)
    values (gen_random_uuid(), v_school_id, 'RLS-02', 'REG-RLS-2', 20) returning id into v_bus_b;

  -- Minimal fake auth.users rows so users.id can reference them (adjust if
  -- your project restricts direct auth.users inserts — in that case, create
  -- these two accounts via the Supabase dashboard/API first and paste their
  -- UUIDs in place of v_driver_a_auth_id/v_driver_b_auth_id above).
  insert into auth.users (id, email) values (v_driver_a_auth_id, 'rls-test-a@example.invalid');
  insert into auth.users (id, email) values (v_driver_b_auth_id, 'rls-test-b@example.invalid');

  insert into users (id, school_id, role, full_name) values (v_driver_a_auth_id, v_school_id, 'driver', 'Driver A');
  insert into users (id, school_id, role, full_name) values (v_driver_b_auth_id, v_school_id, 'driver', 'Driver B');

  insert into drivers (id, school_id, user_id, employee_id, full_name)
    values (gen_random_uuid(), v_school_id, v_driver_a_auth_id, 'RLS-EMP-A', 'Driver A') returning id into v_driver_a_id;
  insert into drivers (id, school_id, user_id, employee_id, full_name)
    values (gen_random_uuid(), v_school_id, v_driver_b_auth_id, 'RLS-EMP-B', 'Driver B') returning id into v_driver_b_id;

  insert into routes (id, school_id, name_en, direction, default_bus_id, default_driver_id)
    values (gen_random_uuid(), v_school_id, 'Route A', 'home_to_school', v_bus_a, v_driver_a_id) returning id into v_route_a;
  insert into routes (id, school_id, name_en, direction, default_bus_id, default_driver_id)
    values (gen_random_uuid(), v_school_id, 'Route B', 'home_to_school', v_bus_b, v_driver_b_id) returning id into v_route_b;

  insert into students (id, school_id, student_code, name_en) values (gen_random_uuid(), v_school_id, 'RLS-STU-A', 'Student A') returning id into v_student_a;
  insert into students (id, school_id, student_code, name_en) values (gen_random_uuid(), v_school_id, 'RLS-STU-B', 'Student B') returning id into v_student_b;

  -- A second, previously-undetected gap: this test never created any
  -- route_stops for either route, so "select ... from route_stops where
  -- route_id = v_route_a" below silently inserted zero rows into
  -- student_route_assignments (a no-match SELECT in an INSERT ... SELECT
  -- is not an error) — which meant generate_daily_route() had nothing to
  -- copy either, on top of the ordering bug described below. Both had to
  -- be fixed together; fixing only one still left zero
  -- daily_student_assignments rows. Found by actually running this file.
  insert into route_stops (id, route_id, sequence, name_en, location, stop_type)
    values (gen_random_uuid(), v_route_a, 1, 'Stop A', ST_SetSRID(ST_MakePoint(58.0, 23.0), 4326)::geography, 'pickup');
  insert into route_stops (id, route_id, sequence, name_en, location, stop_type)
    values (gen_random_uuid(), v_route_b, 1, 'Stop B', ST_SetSRID(ST_MakePoint(58.1, 23.1), 4326)::geography, 'pickup');

  -- Master-level assignments have to exist BEFORE generate_daily_route()
  -- runs — it copies student_route_assignments -> daily_student_assignments
  -- once, at generation time (migration 0012), it doesn't pick up rows
  -- added afterward. Generating the daily routes first (as an earlier
  -- version of this test did) silently produced zero
  -- daily_student_assignments rows for either student, which is a
  -- different bug than the one this test exists to catch — it made
  -- "Driver A can't see Student A" fail for the wrong reason (no
  -- assignment existed at all) instead of testing whether RLS correctly
  -- lets a driver see their own assigned student. Found by actually
  -- running this file for the first time; see docs/testing-rls.md.
  insert into student_route_assignments (student_id, route_id, stop_id)
    select v_student_a, v_route_a, id from route_stops where route_id = v_route_a limit 1;
  insert into student_route_assignments (student_id, route_id, stop_id)
    select v_student_b, v_route_b, id from route_stops where route_id = v_route_b limit 1;

  perform generate_daily_route(v_route_a, current_date);
  perform generate_daily_route(v_route_b, current_date);

  -- Now query AS Driver A and confirm Student B is invisible.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_driver_a_auth_id::text, true);

  select count(*) into v_visible_students from students where id = v_student_b;
  if v_visible_students <> 0 then
    raise exception 'FAIL: Driver A could see Student B (%) — RLS is not isolating drivers by route', v_student_b;
  end if;

  select count(*) into v_visible_students from students where id = v_student_a;
  if v_visible_students <> 1 then
    raise exception 'FAIL: Driver A could NOT see their own assigned Student A — RLS is over-restrictive';
  end if;

  reset role;
  raise notice 'PASS: driver-to-driver student isolation holds under RLS';

  -- Cleanup. schools cascades down through everything this test created
  -- (buses, routes, route_stops, students, drivers, the `users` profile
  -- rows, daily_routes, etc.) — but NOT up to auth.users, which nothing in
  -- our schema points to as a child, so it has to be deleted separately,
  -- last. The original cleanup here only deleted auth.users and claimed
  -- that "cascades schools' children via FKs" — backwards: auth.users is
  -- upstream of schools in this graph, not downstream, so that line
  -- silently left the school and everything under it in the database on
  -- every single run. Confirmed by running this file twice in a row before
  -- this fix: two "RLS Test School" rows, not one. Found by actually
  -- running this file for the first time; see docs/testing-rls.md.
  delete from schools where id = v_school_id;
  delete from auth.users where id in (v_driver_a_auth_id, v_driver_b_auth_id);
end;
$$;
