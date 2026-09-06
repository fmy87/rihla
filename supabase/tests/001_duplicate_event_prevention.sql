-- 001_duplicate_event_prevention.sql
-- Verifies the unique(daily_student_assignment_id) constraint on
-- pickup_events actually blocks a second confirmation for the same
-- assignment, per the "no duplicate pickup/drop-off" requirement.
--
-- Run with: psql "$DATABASE_URL" -f supabase/tests/001_duplicate_event_prevention.sql
-- Uses the service role's implicit bypass of RLS (run as the `postgres`
-- role / via the direct connection string, not the anon/authenticated
-- roles) so this test isolates the CONSTRAINT, not RLS — RLS is covered
-- separately in 003_rls_role_permissions.sql.

do $$
declare
  v_school_id uuid := gen_random_uuid();
  v_bus_id uuid;
  v_driver_id uuid;
  v_route_id uuid;
  v_stop_id uuid;
  v_daily_route_id uuid;
  v_daily_stop_id uuid;
  v_student_id uuid;
  v_assignment_id uuid;
  v_second_insert_failed boolean := false;
begin
  insert into schools (id, name_en) values (v_school_id, 'Test School') returning id into v_school_id;
  insert into buses (id, school_id, bus_number, registration_number, capacity)
    values (gen_random_uuid(), v_school_id, 'TEST-01', 'REG-TEST', 20) returning id into v_bus_id;
  insert into drivers (id, school_id, employee_id, full_name)
    values (gen_random_uuid(), v_school_id, 'TEST-EMP', 'Test Driver') returning id into v_driver_id;
  insert into routes (id, school_id, name_en, direction, default_bus_id, default_driver_id)
    values (gen_random_uuid(), v_school_id, 'Test Route', 'home_to_school', v_bus_id, v_driver_id) returning id into v_route_id;
  insert into route_stops (id, route_id, sequence, name_en, location, stop_type)
    values (gen_random_uuid(), v_route_id, 1, 'Test Stop', ST_SetSRID(ST_MakePoint(58.0, 23.0), 4326)::geography, 'pickup')
    returning id into v_stop_id;
  insert into students (id, school_id, student_code, name_en)
    values (gen_random_uuid(), v_school_id, 'TEST-STU-01', 'Test Student') returning id into v_student_id;

  select generate_daily_route(v_route_id, current_date) into v_daily_route_id;
  select id into v_daily_stop_id from daily_route_stops where daily_route_id = v_daily_route_id;

  insert into daily_student_assignments (id, daily_route_stop_id, student_id, status)
    values (gen_random_uuid(), v_daily_stop_id, v_student_id, 'pending')
    returning id into v_assignment_id;

  -- First confirmation should succeed.
  insert into pickup_events (daily_student_assignment_id, driver_id) values (v_assignment_id, v_driver_id);

  -- Second confirmation for the SAME assignment must be rejected.
  begin
    insert into pickup_events (daily_student_assignment_id, driver_id) values (v_assignment_id, v_driver_id);
  exception when unique_violation then
    v_second_insert_failed := true;
  end;

  if not v_second_insert_failed then
    raise exception 'FAIL: a duplicate pickup_events row was allowed for assignment %', v_assignment_id;
  end if;

  raise notice 'PASS: duplicate pickup confirmation correctly rejected';

  -- Cleanup. pickup_events.driver_id is ON DELETE RESTRICT (intentional —
  -- a driver's confirmation history shouldn't silently vanish via an
  -- unrelated cascade), so it has to go before the school delete reaches
  -- drivers, or this fails with "violates foreign key constraint
  -- pickup_events_driver_id_fkey" even though the test itself passed.
  -- Found by actually running this file for the first time — it had never
  -- been executed before, only reviewed; see docs/testing-rls.md.
  delete from pickup_events where daily_student_assignment_id = v_assignment_id;
  delete from schools where id = v_school_id; -- cascades through the rest
end;
$$;
