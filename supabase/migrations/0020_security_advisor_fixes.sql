-- 0020_security_advisor_fixes.sql
-- Response to Supabase's own security advisor (`get_advisors`, run against
-- the live project after 0001-0019 were applied) — see docs/testing-rls.md
-- for the full list of findings and which ones this fixes vs. deliberately
-- leaves alone.
--
-- ---------- function_search_path_mutable (WARN, 12 functions) ----------
-- Every function below was missing a pinned `search_path`. Without one, a
-- SECURITY DEFINER function (most of these) resolves unqualified names
-- (tables, other functions) using the CALLER's search_path, not a fixed
-- one — so a caller who can create objects in a schema ahead of `public`
-- in their own search_path could shadow a name this function relies on and
-- get it to run attacker-controlled code with the function owner's
-- privileges. Pinning search_path closes that off. resolve_driver_login_email,
-- check_route_deviation, create_stop_skipped_alert, and
-- run_periodic_alert_checks already had `set search_path = public` from
-- when they were first written (0008/0013) and don't appear in the advisor
-- output — this migration brings the rest in line with that existing
-- convention rather than introducing a new one.

alter function public.set_updated_at() set search_path = public;
alter function public.current_user_role() set search_path = public;
alter function public.current_user_school_id() set search_path = public;
alter function public.current_driver_id() set search_path = public;
alter function public.is_admin() set search_path = public;
alter function public.generate_driver_login_email() set search_path = public;
alter function public.generate_daily_route(uuid, date) set search_path = public;
alter function public.route_planned_line(uuid) set search_path = public;
alter function public.decode_road_polyline(text) set search_path = public;
alter function public.current_user_child_ids() set search_path = public;
alter function public.current_user_child_daily_route_stop_ids() set search_path = public;
alter function public.current_user_child_daily_route_ids() set search_path = public;

-- ---------- rls_disabled_in_public (ERROR, 1 table) — attempted, blocked ----------
-- spatial_ref_sys is PostGIS's own coordinate-system reference table,
-- created by `create extension postgis` (0001), not something this project
-- defined. Nothing in this app queries it directly — PostGIS's own
-- ST_*/geography functions read it internally and aren't subject to RLS —
-- so enabling RLS with no policies (deny-by-default) would close the
-- "public table with no RLS" finding without needing to expose any of it
-- over the API.
--
-- Attempted against the live project and rejected:
-- `ERROR: 42501: must be owner of table spatial_ref_sys`. The table is
-- owned by the role that installed the postgis extension, not by this
-- project's migration role, and Supabase's hosted setup doesn't grant
-- ownership of it to the project owner. This is a known PostGIS-on-Supabase
-- limitation, not something fixable from within a normal migration — left
-- as a standing, accepted advisor finding rather than worked around with
-- elevated privileges this role doesn't have.
--
-- alter table public.spatial_ref_sys enable row level security; -- fails: not owner

-- ---------- Deliberately NOT fixed here — see docs/testing-rls.md ----------
-- - extension_in_public (WARN): postgis lives in the public schema.
--   Supabase's recommended fix is relocating it to a dedicated schema, but
--   every geography column and ST_*-calling function in this schema
--   already resolves those types/functions via the public schema's
--   search_path — relocating live, after the fact, on a project with data
--   in it is a real risk of breakage that deserves its own tested
--   migration and a maintenance window, not a same-session fix bundled in
--   with everything else here.
-- - anon_security_definer_function_executable /
--   authenticated_security_definer_function_executable (WARN, ~18 findings):
--   current_user_role()/current_user_school_id()/current_driver_id()/
--   is_admin()/current_user_child_ids() and friends are flagged as
--   publicly callable via /rest/v1/rpc/<name>. That's true, and each one
--   only ever returns information derivable from the caller's own
--   auth.uid() — no cross-user data exposure — but more importantly:
--   REVOKing EXECUTE from `authenticated` on any of these would break
--   every RLS policy that calls it, since a policy's USING/WITH CHECK
--   clause still needs the querying role to hold EXECUTE on the functions
--   it calls, SECURITY DEFINER or not. That's not a safe blind fix to make
--   unattended against a live project. A real fix (moving these helpers to
--   a non-exposed schema, or wrapping the exposed surface) needs testing
--   against the actual RLS suite (supabase/tests/rls/) before it ships,
--   not just a REVOKE run because the advisor said so.
