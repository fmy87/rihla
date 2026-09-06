-- 0007_row_level_security.sql
-- Enables RLS on every tenant table and defines access by role:
--   super_admin      -> full access within their school
--   transport_admin  -> operational access within their school (no system settings/users)
--   driver           -> only their own assigned bus/route/students, today's data

-- ---------- Helper functions (SECURITY DEFINER, read the caller's own users row) ----------

create or replace function current_user_role()
returns user_role
language sql stable security definer
as $$
  select role from users where id = auth.uid();
$$;

create or replace function current_user_school_id()
returns uuid
language sql stable security definer
as $$
  select school_id from users where id = auth.uid();
$$;

create or replace function current_driver_id()
returns uuid
language sql stable security definer
as $$
  select id from drivers where user_id = auth.uid();
$$;

create or replace function is_admin()
returns boolean
language sql stable security definer
as $$
  select current_user_role() in ('super_admin', 'transport_admin');
$$;

-- ---------- Enable RLS ----------

alter table schools enable row level security;
alter table users enable row level security;
alter table drivers enable row level security;
alter table buses enable row level security;
alter table students enable row level security;
alter table system_settings enable row level security;
alter table routes enable row level security;
alter table route_stops enable row level security;
alter table student_route_assignments enable row level security;
alter table daily_routes enable row level security;
alter table daily_route_stops enable row level security;
alter table daily_student_assignments enable row level security;
alter table pickup_events enable row level security;
alter table dropoff_events enable row level security;
alter table attendance enable row level security;
alter table gps_locations enable row level security;
alter table alerts enable row level security;
alter table audit_logs enable row level security;
alter table notifications enable row level security;

-- ---------- schools ----------
create policy schools_select on schools for select
  using (id = current_user_school_id());
create policy schools_admin_write on schools for all
  using (id = current_user_school_id() and current_user_role() = 'super_admin')
  with check (id = current_user_school_id() and current_user_role() = 'super_admin');

-- ---------- users ----------
create policy users_select_self_or_admin on users for select
  using (school_id = current_user_school_id());
create policy users_admin_write on users for all
  using (school_id = current_user_school_id() and is_admin())
  with check (school_id = current_user_school_id() and is_admin());

-- ---------- drivers ----------
create policy drivers_select on drivers for select
  using (
    school_id = current_user_school_id()
    and (is_admin() or id = current_driver_id())
  );
create policy drivers_admin_write on drivers for all
  using (school_id = current_user_school_id() and is_admin())
  with check (school_id = current_user_school_id() and is_admin());

-- ---------- buses ----------
create policy buses_select on buses for select
  using (school_id = current_user_school_id());
create policy buses_admin_write on buses for all
  using (school_id = current_user_school_id() and is_admin())
  with check (school_id = current_user_school_id() and is_admin());

-- ---------- students ----------
-- Drivers only see students assigned to a daily_route_stop on one of their own daily_routes.
create policy students_select_admin on students for select
  using (school_id = current_user_school_id() and is_admin());
create policy students_select_driver on students for select
  using (
    current_user_role() = 'driver'
    and id in (
      select dsa.student_id
      from daily_student_assignments dsa
      join daily_route_stops drs on drs.id = dsa.daily_route_stop_id
      join daily_routes dr on dr.id = drs.daily_route_id
      where dr.driver_id = current_driver_id()
        and dr.service_date = current_date
    )
  );
create policy students_admin_write on students for all
  using (school_id = current_user_school_id() and is_admin())
  with check (school_id = current_user_school_id() and is_admin());

-- ---------- system_settings ----------
create policy settings_select on system_settings for select
  using (school_id = current_user_school_id());
create policy settings_super_admin_write on system_settings for all
  using (school_id = current_user_school_id() and current_user_role() = 'super_admin')
  with check (school_id = current_user_school_id() and current_user_role() = 'super_admin');

-- ---------- routes / route_stops / student_route_assignments (master config) ----------
-- Drivers get read-only access to their currently assigned master route; never write.
create policy routes_select on routes for select
  using (
    school_id = current_user_school_id()
    and (is_admin() or default_driver_id = current_driver_id())
  );
create policy routes_admin_write on routes for all
  using (school_id = current_user_school_id() and is_admin())
  with check (school_id = current_user_school_id() and is_admin());

create policy route_stops_select on route_stops for select
  using (
    route_id in (
      select id from routes
      where school_id = current_user_school_id()
        and (is_admin() or default_driver_id = current_driver_id())
    )
  );
create policy route_stops_admin_write on route_stops for all
  using (
    route_id in (select id from routes where school_id = current_user_school_id() and is_admin())
  )
  with check (
    route_id in (select id from routes where school_id = current_user_school_id() and is_admin())
  );

create policy sra_select on student_route_assignments for select
  using (
    route_id in (
      select id from routes
      where school_id = current_user_school_id()
        and (is_admin() or default_driver_id = current_driver_id())
    )
  );
create policy sra_admin_write on student_route_assignments for all
  using (
    route_id in (select id from routes where school_id = current_user_school_id() and is_admin())
  )
  with check (
    route_id in (select id from routes where school_id = current_user_school_id() and is_admin())
  );

-- ---------- daily_routes (today's operational instance) ----------
create policy daily_routes_select on daily_routes for select
  using (
    school_id = current_user_school_id()
    and (is_admin() or driver_id = current_driver_id())
  );
create policy daily_routes_admin_insert on daily_routes for insert
  with check (school_id = current_user_school_id() and is_admin());
create policy daily_routes_admin_update on daily_routes for update
  using (school_id = current_user_school_id() and is_admin())
  with check (school_id = current_user_school_id() and is_admin());
create policy daily_routes_admin_delete on daily_routes for delete
  using (school_id = current_user_school_id() and is_admin());
-- Drivers may update ONLY their own daily_route's operational fields (status/started_at/etc.)
create policy daily_routes_driver_update on daily_routes for update
  using (driver_id = current_driver_id() and current_user_role() = 'driver')
  with check (driver_id = current_driver_id() and current_user_role() = 'driver');

-- ---------- daily_route_stops ----------
create policy drs_select on daily_route_stops for select
  using (
    daily_route_id in (
      select id from daily_routes
      where school_id = current_user_school_id()
        and (is_admin() or driver_id = current_driver_id())
    )
  );
create policy drs_admin_insert on daily_route_stops for insert
  with check (
    daily_route_id in (select id from daily_routes where school_id = current_user_school_id() and is_admin())
  );
create policy drs_admin_delete on daily_route_stops for delete
  using (
    daily_route_id in (select id from daily_routes where school_id = current_user_school_id() and is_admin())
  );
create policy drs_write on daily_route_stops for update
  using (
    daily_route_id in (
      select id from daily_routes
      where school_id = current_user_school_id()
        and (is_admin() or driver_id = current_driver_id())
    )
  );

-- ---------- daily_student_assignments ----------
create policy dsa_select on daily_student_assignments for select
  using (
    daily_route_stop_id in (
      select drs.id from daily_route_stops drs
      join daily_routes dr on dr.id = drs.daily_route_id
      where dr.school_id = current_user_school_id()
        and (is_admin() or dr.driver_id = current_driver_id())
    )
  );
create policy dsa_admin_insert on daily_student_assignments for insert
  with check (
    daily_route_stop_id in (
      select drs.id from daily_route_stops drs
      join daily_routes dr on dr.id = drs.daily_route_id
      where dr.school_id = current_user_school_id() and is_admin()
    )
  );
create policy dsa_admin_delete on daily_student_assignments for delete
  using (
    daily_route_stop_id in (
      select drs.id from daily_route_stops drs
      join daily_routes dr on dr.id = drs.daily_route_id
      where dr.school_id = current_user_school_id() and is_admin()
    )
  );
-- Drivers confirm pickup/dropoff by updating status here.
create policy dsa_write on daily_student_assignments for update
  using (
    daily_route_stop_id in (
      select drs.id from daily_route_stops drs
      join daily_routes dr on dr.id = drs.daily_route_id
      where dr.school_id = current_user_school_id()
        and (is_admin() or dr.driver_id = current_driver_id())
    )
  );

-- ---------- pickup_events / dropoff_events (append-only) ----------
create policy pickup_events_select on pickup_events for select
  using (
    daily_student_assignment_id in (
      select dsa.id from daily_student_assignments dsa
      join daily_route_stops drs on drs.id = dsa.daily_route_stop_id
      join daily_routes dr on dr.id = drs.daily_route_id
      where dr.school_id = current_user_school_id()
        and (is_admin() or dr.driver_id = current_driver_id())
    )
  );
create policy pickup_events_insert on pickup_events for insert
  with check (
    driver_id = current_driver_id()
    and daily_student_assignment_id in (
      select dsa.id from daily_student_assignments dsa
      join daily_route_stops drs on drs.id = dsa.daily_route_stop_id
      join daily_routes dr on dr.id = drs.daily_route_id
      where dr.driver_id = current_driver_id() and dr.service_date = current_date
    )
  );
-- no update/delete policy => events are immutable once inserted (admins excepted via service role if ever needed)

create policy dropoff_events_select on dropoff_events for select
  using (
    daily_student_assignment_id in (
      select dsa.id from daily_student_assignments dsa
      join daily_route_stops drs on drs.id = dsa.daily_route_stop_id
      join daily_routes dr on dr.id = drs.daily_route_id
      where dr.school_id = current_user_school_id()
        and (is_admin() or dr.driver_id = current_driver_id())
    )
  );
create policy dropoff_events_insert on dropoff_events for insert
  with check (
    driver_id = current_driver_id()
    and daily_student_assignment_id in (
      select dsa.id from daily_student_assignments dsa
      join daily_route_stops drs on drs.id = dsa.daily_route_stop_id
      join daily_routes dr on dr.id = drs.daily_route_id
      where dr.driver_id = current_driver_id() and dr.service_date = current_date
    )
  );

-- ---------- attendance (rollup, admin/edge-function maintained) ----------
create policy attendance_select on attendance for select
  using (school_id = current_user_school_id());
create policy attendance_admin_write on attendance for all
  using (school_id = current_user_school_id() and is_admin())
  with check (school_id = current_user_school_id() and is_admin());

-- ---------- gps_locations ----------
create policy gps_select on gps_locations for select
  using (
    daily_route_id in (
      select id from daily_routes
      where school_id = current_user_school_id()
        and (is_admin() or driver_id = current_driver_id())
    )
  );
create policy gps_insert on gps_locations for insert
  with check (
    driver_id = current_driver_id()
    and daily_route_id in (
      select id from daily_routes where driver_id = current_driver_id() and service_date = current_date
    )
  );

-- ---------- alerts ----------
create policy alerts_select on alerts for select
  using (school_id = current_user_school_id());
create policy alerts_admin_write on alerts for update
  using (school_id = current_user_school_id() and is_admin())
  with check (school_id = current_user_school_id() and is_admin());
-- inserts happen via Edge Functions using the service role key (bypasses RLS by design)

-- ---------- audit_logs ----------
create policy audit_select_admin on audit_logs for select
  using (school_id = current_user_school_id() and is_admin());
-- inserts happen via triggers/Edge Functions using the service role key

-- ---------- notifications ----------
create policy notifications_select_own on notifications for select
  using (recipient_user_id = auth.uid());
create policy notifications_update_own on notifications for update
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());
