-- 0012_generate_daily_route.sql
-- Generates a daily_routes + daily_route_stops + daily_student_assignments
-- instance from a master route for a given service_date, without ever
-- mutating the master route itself. Callable by admins via RPC from the
-- Daily Operations screen (Phase 7) or ad hoc from the Route Editor.
--
-- Deliberately NOT security definer: it runs as the calling admin, so the
-- existing RLS policies on daily_routes/daily_route_stops/
-- daily_student_assignments (admin-write, scoped to the caller's school)
-- apply exactly as they would to a manual insert. Automatic nightly/cron
-- generation for every active route is a Phase 7 addition.

create or replace function generate_daily_route(
  p_route_id uuid,
  p_service_date date
)
returns uuid
language plpgsql
as $$
declare
  v_route routes%rowtype;
  v_daily_route_id uuid;
begin
  select * into v_route from routes where id = p_route_id;
  if not found then
    raise exception 'route % not found', p_route_id;
  end if;
  if v_route.default_bus_id is null or v_route.default_driver_id is null then
    raise exception 'route % has no default bus/driver assigned', p_route_id;
  end if;

  insert into daily_routes (school_id, route_id, service_date, bus_id, driver_id, status)
  values (v_route.school_id, v_route.id, p_service_date, v_route.default_bus_id, v_route.default_driver_id, 'not_started')
  on conflict (route_id, service_date) do nothing
  returning id into v_daily_route_id;

  if v_daily_route_id is null then
    select id into v_daily_route_id from daily_routes where route_id = p_route_id and service_date = p_service_date;
    return v_daily_route_id; -- already generated for this date; idempotent
  end if;

  -- Copy stops
  insert into daily_route_stops (daily_route_id, route_stop_id, sequence, name_en, name_ar, location, estimated_arrival_time, geofence_radius_meters, stop_type)
  select v_daily_route_id, rs.id, rs.sequence, rs.name_en, rs.name_ar, rs.location, rs.estimated_arrival_time, rs.geofence_radius_meters, rs.stop_type
  from route_stops rs
  where rs.route_id = p_route_id
  order by rs.sequence;

  -- Copy student assignments, mapped to the new daily_route_stops rows
  insert into daily_student_assignments (daily_route_stop_id, student_id, status)
  select drs.id, sra.student_id, 'pending'
  from student_route_assignments sra
  join route_stops rs on rs.id = sra.stop_id
  join daily_route_stops drs on drs.route_stop_id = rs.id and drs.daily_route_id = v_daily_route_id
  where sra.route_id = p_route_id and sra.is_active = true;

  return v_daily_route_id;
end;
$$;
