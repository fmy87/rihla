# Testing

Three layers, matching where the logic actually lives — pure business logic
is unit-tested directly; anything that depends on Postgres/RLS is tested at
the SQL level; there is no attempt to mock Supabase end-to-end, which would
test the mock more than the system.

## 1. Admin app (Vitest)

```bash
cd apps/admin
pnpm test
```

Covers pure logic extracted specifically so it's testable without a live
backend:
- `lib/csv.ts` — CSV escaping (commas, quotes, newlines, nulls)
- `lib/reorder.ts` — stop-reorder sequencing used by the Route Editor's ↑/↓
  buttons (out-of-bounds moves, unknown ids, order-independence)

Anything that reads/writes Supabase directly (every file under
`lib/queries/`) is intentionally left to the SQL tests and manual QA below —
mocking the Supabase client to "test" a query function mostly re-describes
the query in test form and doesn't catch RLS or constraint bugs, which are
exactly the bugs that matter here.

## 2. Driver app (Jest / jest-expo)

```bash
cd apps/driver-ios
pnpm test
```

Covers:
- `lib/routeProgress.ts` — completed/current/upcoming stop-state logic
  (shared by the Route and Students screens as of Phase 12)
- `lib/location/geofence.ts` — haversine distance sanity checks
- `lib/location/gpsQueue.ts` — buffer-first enqueue, successful flush clears
  the queue, a **failed** flush leaves it intact (this is the specific
  behavior "don't lose GPS data offline" depends on), offline-backfill
  flagging
- `lib/offline/actionQueue.ts` — same guarantees for pickup/drop-off
  confirmations: enqueue is local-only, a partial flush failure preserves
  order and never drops an action, a retry only replays what's left

## 3. Database (plain SQL assertion scripts)

```bash
psql "$DATABASE_URL" -f supabase/tests/001_duplicate_event_prevention.sql
psql "$DATABASE_URL" -f supabase/tests/002_generate_daily_route_idempotent.sql
psql "$DATABASE_URL" -f supabase/tests/003_rls_role_permissions.sql
```

Each script creates its own throwaway school/bus/driver/route/student rows,
asserts the behavior with `raise exception` on failure (so a non-zero psql
exit / visible ERROR means a real failure, not a silent pass), and cleans up
after itself via `delete from schools where id = ...` (cascades through
every FK). Safe to run against a scratch/staging database; **do not** run
against production, since 003 briefly runs queries under a simulated driver
session.

Covers:
- **001** — the `unique(daily_student_assignment_id)` constraint on
  `pickup_events` actually rejects a second confirmation (the DB-level
  backstop behind the app's own duplicate-confirmation UI guard)
- **002** — `generate_daily_route()` is idempotent: calling it twice for the
  same route/date returns the same `daily_routes` row and doesn't duplicate
  stops or student assignments
- **003** — RLS actually isolates drivers from each other's students/routes,
  not just the app-layer queries assuming it does

These aren't a full pgTAP suite (no extra extension dependency), but they
exercise the specific failure modes called out in the original requirements
— duplicate events, double-generation, and cross-driver data leakage — with
a pass/fail signal a CI job can key off (non-zero exit on `RAISE
EXCEPTION`).

## What's not automated here

- End-to-end flows (login → start route → confirm pickup → complete route)
  are covered by the manual QA checklist (`docs/manual-qa-checklist.md`)
  instead — they need a real Supabase project, a real iPad/simulator, and
  ideally a second device to watch the admin dashboard update live, which
  isn't something a unit/SQL test can stand in for honestly.
- Google Maps interactions (Places search, draggable markers, Directions
  rendering) are UI-driven against a third-party SDK and are also manual-QA
  territory.
