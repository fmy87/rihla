# Testing Row-Level Security locally

`supabase/tests/rls/` is a real pgTAP test suite for this project's RLS
policies — not aspirational, not "reviewed by reading the SQL": every
assertion in it has been run against a real PostgreSQL + PostGIS instance
with all 18 migrations applied. It's what caught the infinite-recursion bug
described in migration `0017_parent_portal.sql`'s comments before it ever
reached a real Supabase project.

## Why this exists, and what it doesn't replace

Supabase's hosted Postgres gives you an `auth` schema, `authenticated`/
`anon` roles with the right grants, and `auth.uid()` reading the request
JWT — all for free. A plain local Postgres has none of that. `supabase/
tests/_auth_mock.sql` and `supabase/tests/_grants_mock.sql` recreate just
enough of it (a minimal `auth.users` + `auth.uid()` reading a session
setting, and the same grants Supabase sets up automatically) to run our own
migrations and exercise RLS for real. Neither file is ever deployed —
they're test-only scaffolding.

This is unit-level RLS testing, not a substitute for testing against an
actual Supabase project before going live — things like Realtime
publications, Auth email templates, or Storage policies aren't covered
here at all, and this suite doesn't touch them.

## Running it

Requires PostgreSQL 16 + PostGIS + pgTAP. On Debian/Ubuntu:

```bash
apt-get install -y postgresql postgresql-contrib postgresql-16-postgis-3 postgresql-16-pgtap
service postgresql start
```

Then, from the repo root:

```bash
# 1. Fresh test database
sudo -u postgres psql -c "CREATE DATABASE rihla_test;"
sudo -u postgres psql -d rihla_test -c "CREATE EXTENSION pgtap;"

# 2. Auth mock (creates the `auth` schema our migrations assume exists)
sudo -u postgres psql -d rihla_test -f supabase/tests/_auth_mock.sql

# 3. All 18 migrations, in order
for f in supabase/migrations/*.sql; do
  sudo -u postgres psql -d rihla_test -v ON_ERROR_STOP=1 -f "$f" || break
done

# 4. Grants (Supabase sets these up automatically on a real project)
sudo -u postgres psql -d rihla_test -f supabase/tests/_grants_mock.sql

# 5. Deterministic fixture data for the RLS tests specifically
#    (separate from supabase/seed/seed.sql, which uses random UUIDs)
sudo -u postgres psql -d rihla_test -f supabase/tests/rls/_fixtures.sql

# 6. Run each test file
for f in supabase/tests/rls/*.sql; do
  [ "$(basename "$f")" = "_fixtures.sql" ] && continue
  sudo -u postgres psql -d rihla_test -f "$f"
done
```

Each test file wraps itself in `begin; ... rollback;`, so running the same
file twice in a row is safe — nothing it does persists. `_fixtures.sql`
itself is NOT wrapped in a rollback (its data needs to persist across all
three test files), so re-running it against a database that already has it
loaded will fail on duplicate keys — drop and recreate `rihla_test` first
if you need to reload fixtures.

## What's covered

- `001_multi_tenant_isolation.sql` — an admin only ever sees their own
  school's rows, checked both directions (school A can't see school B's
  data, and vice versa).
- `002_parent_own_children_only.sql` — a parent sees only their own linked
  child's data (students, assignments, routes, GPS, driver), and explicitly
  NOT another parent's child in the *same* school — the leak a naive
  `school_id`-only check wouldn't catch.
- `003_guardian_invites_locked_down.sql` — `guardian_invites` grants zero
  read access to anon, parent, and driver roles; only an admin of the
  invite's own school can see it. Every legitimate read/write of that table
  goes through the `accept-guardian-invite` Edge Function's service role
  instead (see `apps/parent-portal/README.md`).
- `004_admin_write_isolation.sql` — the write-side counterpart to `001`:
  an admin's INSERT/UPDATE/DELETE are all scoped to their own school, not
  just their SELECTs. A table can correctly hide another school's rows
  from SELECT while still allowing writes into them if the write policy's
  `with check`/`using` is missing or wrong — this checks that separately.
- `005_driver_write_scope.sql` — a driver can only update their own
  assigned `daily_routes` row, never another driver's (even within the
  same school), and can't INSERT a new `daily_routes` row at all (that's
  admin-only).

Separately, `supabase/tests/001_duplicate_event_prevention.sql`,
`002_generate_daily_route_idempotent.sql`, and
`003_rls_role_permissions.sql` (note: no `rls/` in their path — these
predate the suite above) are standalone `DO $$ ... $$` blocks from earlier
phases, each runnable directly with `psql -f`. All three had never actually
been executed before this round — see "Pre-existing tests that had never
been run" below for what running them for the first time turned up.

## Running the standalone tests (001-003, not under rls/)

These don't need `_grants_mock.sql` or `_fixtures.sql` — each is
self-contained (creates its own scratch school/bus/driver/students, asserts,
then deletes what it created) and safe to run repeatedly:

```bash
sudo -u postgres psql -d rihla_test -v ON_ERROR_STOP=1 -f supabase/tests/001_duplicate_event_prevention.sql
sudo -u postgres psql -d rihla_test -v ON_ERROR_STOP=1 -f supabase/tests/002_generate_daily_route_idempotent.sql
sudo -u postgres psql -d rihla_test -v ON_ERROR_STOP=1 -f supabase/tests/003_rls_role_permissions.sql
```

A `NOTICE: PASS: ...` line and a clean exit means it passed; a `RAISE
EXCEPTION 'FAIL: ...'` and non-zero exit means it didn't.

## What isn't covered yet

The original Phase 1 admin/driver SELECT policies not exercised by `001`/
`005` above (e.g. `route_stops_select`, `attendance` policies), and the
alert/audit-log tables. `004`/`005` close the write-side gap that existed
when this file was first written — worth calling out since "SELECT is
tested" and "writes are tested" are genuinely different claims, and this
file used to only support the first one.

## Pre-existing tests that had never been run

While verifying the `rls/` suite above, three older standalone test files
already in `supabase/tests/` (`001_duplicate_event_prevention.sql`,
`002_generate_daily_route_idempotent.sql`,
`003_rls_role_permissions.sql`) turned up during a routine `find`. They
were written in an earlier phase, read as structurally reasonable, and
had apparently never actually been executed — they'd only ever been
reviewed. Running them against the real database for the first time
found three genuine bugs, all in the tests themselves rather than the
application:

1. **`001`**: the cleanup line failed with a foreign-key violation every
   single time (`pickup_events.driver_id` is intentionally `ON DELETE
   RESTRICT`, to protect audit history — the cleanup needs to delete
   `pickup_events` before the cascading school delete reaches `drivers`).
   The actual assertion passed every time; only the cleanup was broken —
   but a broken cleanup after a passing assertion still exits non-zero,
   which would read as a failure to anyone just checking the exit code.
2. **`003`**: set `request.jwt.claims` (a JSON blob) instead of
   `request.jwt.claim.sub` (the flat GUC Supabase's real `auth.uid()`
   actually reads) — meaning `auth.uid()` always returned null and the
   simulated driver was never actually authenticated as anyone. On top of
   that, the test never created any `route_stops` for either route, so
   the student-assignment insert that depended on `route_stops` existing
   silently inserted zero rows. Both bugs had to be fixed together —
   fixing only one still left the driver with nothing to see. The test's
   failure message ("RLS is over-restrictive") pointed at the RLS policy;
   the actual problem was entirely in the test's own setup.
3. **`003`** again: the cleanup only ever deleted the two `auth.users`
   rows it created, with a comment claiming this "cascades schools'
   children via FKs" — backwards. `auth.users` is upstream of `schools` in
   this schema (nothing points to it as a parent), so that line silently
   left the school and everything under it in the database on every run.
   Confirmed by running the file three times in a row before the fix:
   three "RLS Test School" rows, not one.

All three files now pass cleanly and repeatably — each was run three
times in a row post-fix with zero leftover rows. None of the three bugs
were in the application or the RLS policies themselves; all three were in
test setup/cleanup code that had sat unverified. Which is itself the
point: a test that's never been run isn't evidence of anything, however
reasonable it looks on the page — see this project's repeated
"reviewed vs. actually run" distinction throughout its own README.
