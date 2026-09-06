-- 002_generate_daily_route_idempotent.sql
-- Verifies that generating a daily route twice for the same route+date
-- returns the SAME daily_routes row and does not duplicate stops or
-- student assignments — required since the admin UI's "Generate Today's
-- Route" button (Route Editor) can reasonably be clicked more than once.
--
-- Run with: psql "$DATABASE_URL" -f supabase/tests/002_generate_daily_route_idempotent.sql

do $$
declare
  v_school_id uuid;
  v_bus_id uuid;
  v_driver_id uuid;
  v_route_id uuid;
  v_student_id uuid;
  v_first_daily_route_id uuid;
  v_second_daily_route_id uuid;
  v_stop_count_after_first int;
  v_stop_count_after_second int;
  v_assignment_count_after_second int;
begin
  insert into schools (id, name_en) values (gen_random_uuid(), 'Test School Idempotency') returning id into v_school_id;
  insert into buses (id, school_id, bus_number, registration_number, capacity)
    values (gen_random_uuid(), v_school_id, 'TEST-02', 'REG-TEST-2', 20) returning id into v_bus_id;
  insert into drivers (id, school_id, employee_id, full_name)
    values (gen_random_uuid(), v_school_id, 'TEST-EMP-2', 'Test Driver 2') returning id into v_driver_id;
  insert into routes (id, school_id, name_en, direction, default_bus_id, default_driver_id)
    values (gen_random_uuid(), v_school_id, 'Test Route 2', 'home_to_school', v_bus_id, v_driver_id) returning id into v_route_id;

  insert into route_stops (id, route_id, sequence, name_en, location, stop_type)
    values (gen_random_uuid(), v_route_id, 1, 'Stop A', ST_SetSRID(ST_MakePoint(58.0, 23.0), 4326)::geography, 'pickup');
  insert into route_stops (id, route_id, sequence, name_en, location, stop_type)
    values (gen_random_uuid(), v_route_id, 2, 'Stop B', ST_SetSRID(ST_MakePoint(58.1, 23.1), 4326)::geography, 'pickup');

  insert into students (id, school_id, student_code, name_en)
    values (gen_random_uuid(), v_school_id, 'TEST-STU-02', 'Test Student 2') returning id into v_student_id;
  insert into student_route_assignments (student_id, route_id, stop_id)
    select v_student_id, v_route_id, id from route_stops where route_id = v_route_id and sequence = 1;

  select generate_daily_route(v_route_id, current_date) into v_first_daily_route_id;
  select count(*) into v_stop_count_after_first from daily_route_stops where daily_route_id = v_first_daily_route_id;

  -- Call it again for the same route/date.
  select generate_daily_route(v_route_id, current_date) into v_second_daily_route_id;
  select count(*) into v_stop_count_after_second from daily_route_stops where daily_route_id = v_second_daily_route_id;
  select count(*) into v_assignment_count_after_second
    from daily_student_assignments dsa
    join daily_route_stops drs on drs.id = dsa.daily_route_stop_id
    where drs.daily_route_id = v_second_daily_route_id;

  if v_first_daily_route_id <> v_second_daily_route_id then
    raise exception 'FAIL: generate_daily_route created a second daily_routes row (% vs %)', v_first_daily_route_id, v_second_daily_route_id;
  end if;

  if v_stop_count_after_first <> 2 or v_stop_count_after_second <> 2 then
    raise exception 'FAIL: expected 2 daily_route_stops both times, got % then %', v_stop_count_after_first, v_stop_count_after_second;
  end if;

  if v_assignment_count_after_second <> 1 then
    raise exception 'FAIL: expected exactly 1 student assignment after two generate calls, got %', v_assignment_count_after_second;
  end if;

  raise notice 'PASS: generate_daily_route is idempotent for the same route/date';

  delete from schools where id = v_school_id;
end;
$$;
