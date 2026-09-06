-- 0017_parent_portal.sql
-- Schema + RLS for the parent portal (apps/parent-portal). Previously the
-- `students.guardian_name`/`guardian_phone` columns were just free-text
-- contact info with no login of their own — this migration adds an actual
-- account link (`guardian_user_id`) and read-only RLS scoped to "my own
-- children's data", following the same pattern the driver role already
-- uses ("only my own assigned bus/route/students").
--
-- A parent user is a normal `users` row with role = 'parent' (see 0016) and
-- school_id set — created the same way admin/driver accounts are, via the
-- `create-staff-account` Edge Function or a school-specific signup flow
-- (not built here; out of scope for v1, same as the rest of parent-portal
-- account provisioning).

-- ---------- Schema ----------

alter table students add column if not exists guardian_user_id uuid references users(id) on delete set null;
create index if not exists idx_students_guardian on students(guardian_user_id);
comment on column students.guardian_user_id is
  'Links this student to the parent/guardian''s own login (users row with '
  'role = ''parent''), if they have a parent-portal account. Null for '
  'students whose guardian hasn''t been given portal access — guardian_name/'
  'guardian_phone remain the contact info of record either way.';

-- ---------- Helpers ----------
-- All SECURITY DEFINER (same pattern current_user_school_id()/is_admin()/
-- current_driver_id() already use in 0007): the function owner bypasses RLS
-- entirely, so queries *inside* these functions never trigger policy
-- evaluation on the tables they touch. That isn't just tidiness here — it's
-- required. A first version of this migration used plain subqueries
-- instead (e.g. a policy on daily_route_stops querying
-- daily_student_assignments directly), and because 0007's own
-- `dsa_select` policy queries *back* into daily_route_stops, that created a
-- two-table RLS cycle: "infinite recursion detected in policy for relation
-- daily_student_assignments". It broke ordinary admin/driver queries too,
-- not just parent ones, since Postgres plans every policy on a table
-- regardless of the querying role. Caught by
-- supabase/tests/rls/001_multi_tenant_isolation.sql and
-- 002_parent_own_children_only.sql — see docs/testing-rls.md. Routing every
-- cross-table lookup through a SECURITY DEFINER function breaks the cycle
-- the same way current_user_child_ids() already did for `students`.

create or replace function current_user_child_ids()
returns setof uuid
language sql stable security definer
as $$
  select id from students where guardian_user_id = auth.uid();
$$;

create or replace function current_user_child_daily_route_stop_ids()
returns setof uuid
language sql stable security definer
as $$
  select dsa.daily_route_stop_id
  from daily_student_assignments dsa
  where dsa.student_id in (select current_user_child_ids());
$$;

create or replace function current_user_child_daily_route_ids()
returns setof uuid
language sql stable security definer
as $$
  select drs.daily_route_id
  from daily_route_stops drs
  where drs.id in (select current_user_child_daily_route_stop_ids());
$$;

-- ---------- students: parents see only their own children ----------

create policy students_select_parent on students for select
  using (current_user_role() = 'parent' and guardian_user_id = auth.uid());

-- ---------- daily_student_assignments: a child's own pickup/drop-off status ----------

create policy dsa_select_parent on daily_student_assignments for select
  using (
    current_user_role() = 'parent'
    and student_id in (select current_user_child_ids())
  );

-- ---------- daily_route_stops / daily_routes: only the instances that carry a child of this parent ----------

create policy drs_select_parent on daily_route_stops for select
  using (
    current_user_role() = 'parent'
    and id in (select current_user_child_daily_route_stop_ids())
  );

create policy daily_routes_select_parent on daily_routes for select
  using (
    current_user_role() = 'parent'
    and id in (select current_user_child_daily_route_ids())
  );

-- ---------- drivers: name/phone of a driver currently driving a child of this parent ----------

create policy drivers_select_parent on drivers for select
  using (
    current_user_role() = 'parent'
    and id in (
      select dr.driver_id from daily_routes dr
      where dr.id in (select current_user_child_daily_route_ids())
    )
  );

-- ---------- gps_locations: live position, today only, for a child's bus ----------

create policy gps_select_parent on gps_locations for select
  using (
    current_user_role() = 'parent'
    and daily_route_id in (
      select dr.id from daily_routes dr
      where dr.id in (select current_user_child_daily_route_ids())
        and dr.service_date = current_date
    )
  );

-- ---------- pickup_events / dropoff_events: a child's own confirmed events ----------

create policy pickup_events_select_parent on pickup_events for select
  using (
    current_user_role() = 'parent'
    and daily_student_assignment_id in (
      select dsa.id from daily_student_assignments dsa
      where dsa.student_id in (select current_user_child_ids())
    )
  );

create policy dropoff_events_select_parent on dropoff_events for select
  using (
    current_user_role() = 'parent'
    and daily_student_assignment_id in (
      select dsa.id from daily_student_assignments dsa
      where dsa.student_id in (select current_user_child_ids())
    )
  );
