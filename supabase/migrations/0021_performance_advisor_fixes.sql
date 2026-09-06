-- 0021_performance_advisor_fixes.sql
-- Response to Supabase's performance advisor (`get_advisors`, run against
-- the live project after 0001-0020 were applied). Two categories fixed
-- here; two deliberately left alone — see the note at the end.

-- ---------- auth_rls_initplan (WARN, 3 policies) ----------
-- notifications_select_own, notifications_update_own, and
-- students_select_parent all called auth.uid() directly in their USING/
-- WITH CHECK clause. Postgres re-evaluates a bare function call like that
-- once PER ROW scanned; wrapping it as `(select auth.uid())` lets the
-- planner treat it as an initplan — evaluated once per query instead —
-- which matters once these tables have real row counts. Every other RLS
-- policy in this schema already goes through current_user_role()/
-- current_user_school_id()/current_driver_id()/current_user_child_ids()
-- (all SECURITY DEFINER functions, not raw auth.uid() calls), which is why
-- only these three were flagged.

alter policy notifications_select_own on notifications
  using (recipient_user_id = (select auth.uid()));

alter policy notifications_update_own on notifications
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));

alter policy students_select_parent on students
  using (current_user_role() = 'parent' and guardian_user_id = (select auth.uid()));

-- ---------- unindexed_foreign_keys (INFO, 18 columns) ----------
-- Every one of these is a real foreign key with no covering index, which
-- makes lookups and cascading deletes/updates through it a sequential
-- scan instead of an index scan once the table has real data. Additive
-- and safe — this only adds indexes, it doesn't touch any existing
-- schema, data, or RLS policy.

create index if not exists idx_alerts_bus on alerts(bus_id);
create index if not exists idx_alerts_dsa on alerts(daily_student_assignment_id);
create index if not exists idx_alerts_resolved_by on alerts(resolved_by);
create index if not exists idx_alerts_student on alerts(student_id);
create index if not exists idx_audit_logs_actor on audit_logs(actor_user_id);
create index if not exists idx_buses_default_driver on buses(default_driver_id);
create index if not exists idx_drs_route_stop on daily_route_stops(route_stop_id);
create index if not exists idx_dropoff_events_driver on dropoff_events(driver_id);
create index if not exists idx_gps_driver on gps_locations(driver_id);
create index if not exists idx_guardian_invites_created_by on guardian_invites(created_by);
create index if not exists idx_guardian_invites_used_by on guardian_invites(used_by_user_id);
create index if not exists idx_notifications_daily_route on notifications(related_daily_route_id);
create index if not exists idx_notifications_student on notifications(related_student_id);
create index if not exists idx_notifications_school on notifications(school_id);
create index if not exists idx_pickup_events_driver on pickup_events(driver_id);
create index if not exists idx_routes_default_bus on routes(default_bus_id);
create index if not exists idx_routes_default_driver on routes(default_driver_id);
create index if not exists idx_sra_route on student_route_assignments(route_id);

-- ---------- Deliberately NOT fixed here ----------
-- - unused_index (INFO, ~20 findings): every index on this project is
--   unused because the project has no real query traffic yet — that's
--   expected for a schema that was just created, not evidence any of them
--   are actually unnecessary. Revisit after real usage, not now.
-- - multiple_permissive_policies (WARN, ~90 findings): this schema
--   deliberately uses separate, named, single-purpose policies per role
--   (e.g. students_select_admin / students_select_driver /
--   students_select_parent, rather than one combined policy with a big
--   OR'd condition) for readability and independent testability — see
--   supabase/tests/rls/, which tests several of these roles separately.
--   Postgres does have to evaluate each applicable permissive policy and
--   OR the results, which costs a little at scale, but consolidating
--   dozens of policies into combined conditions is a real rewrite of most
--   of 0007 and 0017 with genuine regression risk, not a same-session fix
--   to make unattended against a live project. At this project's realistic
--   scale (one school's fleet — dozens of buses/drivers, low thousands of
--   daily rows) the readability and independent-testability this buys is
--   worth more than the query-planning overhead it costs.
