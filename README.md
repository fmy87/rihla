# Rihla — School Bus Route Management & Live Tracking System

Premium, bilingual (English/Arabic) school transportation platform: admin web
portal + driver iPad app + Supabase backend with live GPS tracking, route
deviation detection, and full pickup/drop-off accountability.

See `/docs/architecture.md` for the full Phase 1 architecture writeup
(also delivered separately as `school-bus-system-architecture.md`).

## Repository structure

```
/apps
  /admin           React + TypeScript + Vite + Tailwind admin web portal
  /driver-ios      Expo (React Native) driver app, built via Codemagic
  /parent-portal   Minimal read-only React + Vite parent web app (v1 — see
                    apps/parent-portal/README.md for scope/limitations)
/packages
  /shared           Shared TypeScript types, i18n keys, business logic
/scripts            Dev/demo tooling (GPS simulator) — not part of either app
/supabase
  /migrations       Ordered SQL migrations (schema, enums, RLS policies)
  /seed             Demo data (3 buses, 3 drivers, 3 routes, 20+ students)
  /functions        Edge Functions (create-staff-account, accept-guardian-invite)
  /tests            pgTAP RLS suite + standalone SQL tests — see docs/testing-rls.md
/docs               Architecture, deployment, and setup documentation
codemagic.yaml       CI: driver iOS (dev + TestFlight), admin web, parent web
.env.example
README.md
```

## Status — Phase 1 complete

- [x] Full architecture writeup (admin/driver/backend/map/i18n)
- [x] Database schema — 7 ordered migrations covering:
  core tenant/people/fleet tables, master routes, daily operational
  instances, pickup/dropoff events, GPS + alerts, audit/notifications,
  and complete Row Level Security policies for `super_admin` /
  `transport_admin` / `driver` roles
- [x] Demo seed data script
- [x] `.env.example` and local development docs

## Status — Phase 2 complete

- [x] Supabase Auth wired into both apps (session hydration, sign-in, sign-out)
- [x] Admin login (email + password) with EN/AR language switcher and RTL
- [x] Driver login (School + Employee ID + PIN) via `resolve_driver_login_email`
      RPC — one Supabase Auth system serves both login styles
- [x] `users` table role (`super_admin`/`transport_admin`/`driver`) drives
      route access: `ProtectedRoute` on the admin web app, role check on the
      driver app's `AuthContext`
- [x] Optional Face ID / Touch ID unlock on the driver app (credentials cached
      in `expo-secure-store`, never in plain storage)
- [x] Shared `en`/`ar` translation namespaces (`common`, `auth`) consumed by
      both apps from one source (`packages/shared/src/i18n`)

## Status — Phase 3 complete

- [x] Admin dashboard shell: sidebar nav (role-aware — Users/Settings hidden
      from `transport_admin`), top bar with signed-in identity + sign out
- [x] Today's Overview — 9 live stat cards (active/on-route/completed/
      not-started/delayed buses, students transported, pending pickup,
      absentees, route deviations) computed from real Supabase queries
      against `daily_routes` / `daily_student_assignments` / `alerts`
- [x] Live Bus Map — Google Maps integration (`@react-google-maps/api`),
      backed by the new `latest_gps_locations` view; renders real bus
      markers the moment GPS data exists (Phase 8), shows an honest empty
      state until then rather than fake markers
- [x] Active Routes table — route/bus/driver/progress/status/next stop,
      auto-refreshing every 20s
- [x] Every other sidebar screen (Live Tracking, Routes, Buses, Drivers,
      Students, Stops, Daily Operations, Attendance, Alerts, Reports, Users,
      Settings) routes to a clearly labeled "ships in Phase N" placeholder —
      no dead or fake buttons
- [x] `dashboard` i18n namespace added (EN/AR) alongside `common`/`auth`
- [x] Phase 4 (Bus / Driver / Student Management) complete — see below

## Status — Phase 4 complete

- [x] **Buses**: list + create/edit (bus number, registration, EN/AR
      nickname, capacity, default driver, assistant, notes), activate/
      deactivate
- [x] **Drivers**: list + full account creation (Employee ID + PIN → real
      Supabase Auth login, not just a profile row) via the new
      `create-staff-account` Edge Function; activate/deactivate; login
      status shown per driver
- [x] **Students**: list + search + create/edit (bilingual name, grade,
      class, gender, guardian contact, admin-only special notes),
      activate/deactivate
- [x] **Users** (super_admin only): list admin/transport_admin accounts,
      create new admin accounts with a one-time password-set link, cannot
      deactivate your own account
- [x] `supabase/functions/create-staff-account` — the one place the service
      role key is used; re-validates the caller's own admin session before
      creating any account, audit-logs every creation
- [x] `buses`/`drivers`/`students`/`users` i18n namespaces added (EN/AR)
- [x] Phase 5 (Route Builder) complete — see below

## Status — Phase 5 complete

- [x] **Routes list** — create a route (bilingual name, direction, default
      bus/driver), open it into the editor
- [x] **Route Editor**: left panel (route info, save), center (Google Map
      with Places search-to-drop-pin, click-to-add-stop, draggable markers,
      road-based route line via the Directions API), right panel (stop list
      with ↑/↓ reorder, stop detail form, student assignment)
- [x] Stops store real lat/lng (PostGIS `geography(Point)`); a new
      `route_stops_with_coords` view exposes lat/lng to the client since
      PostGIS functions aren't queryable directly over PostgREST
- [x] Student assignment with the required duplicate-assignment warning —
      assigning a student already active on another route prompts to
      reassign rather than silently double-booking them
- [x] Reordering handles the `unique(route_id, sequence)` constraint safely
      (two-phase update through a temporary negative range)
- [x] `routes` i18n namespace added (EN/AR); "Stops" nav item now explains
      stops are managed inside the Route Editor rather than being a
      separate flat screen
- [ ] Phase 6 (Driver iPad App) — next, pending your review

## Status — Phase 6 complete

- [x] Driver app navigation shell — bottom tabs: Today, Route, Students,
      History, Profile (`@react-navigation`)
- [x] **Today**: shows the real daily_routes row for the signed-in driver
      (if one exists for today), bus/route/status, working START ROUTE
      button (transitions `daily_routes.status` → `on_route`, records
      `started_at`) — an honest empty state when no route is scheduled
- [x] **Route**: `react-native-maps` with stop markers colored
      completed/current/upcoming, a connecting polyline, and a matching list
      below — backed by the new `daily_route_stops_with_coords` view
- [x] **Students**: read-only roster for the current stop with each
      student's real `daily_student_assignments` status — pickup/drop-off
      confirmation buttons are clearly labeled as shipping in Phase 7 rather
      than faked
- [x] **Profile**: driver identity, EN/AR language switcher (triggers the
      RTL reload React Native requires), sign out, and an Emergency button
      whose confirm dialog is real — the alert-dispatch backend is flagged
      as landing with Phase 8 (needs GPS to attach a location)
- [x] New `generate_daily_route(route_id, service_date)` Postgres function +
      a "Generate Today's Route" button on the admin Route Editor, since the
      driver app needs a `daily_routes` row to exist to show anything —
      full automatic nightly generation is a Phase 7 addition
- [x] Migration 0011 (`daily_route_stops_with_coords` view) for the Route
      screen's map
- [x] `driver` i18n namespace added (EN/AR)
- [ ] Phase 7 (Pickup / Drop-off) — next, pending your review

## Status — Phase 7 complete

- [x] **Students screen** is now actionable: PICKED UP / DROPPED OFF (label
      follows the stop's `stop_type`) and NOT CONFIRMED (with the required
      reason picker — absent/parent cancelled/not ready/wrong location/
      other), writing real `pickup_events`/`dropoff_events` rows and
      updating `daily_student_assignments.status`
- [x] Duplicate-confirmation guard — tapping an already-resolved student
      shows "already marked at HH:MM" instead of creating a second event
      (backed by the events tables' `unique(daily_student_assignment_id)`)
- [x] Stop progression: a stop is marked "arrived" once every assignment on
      it is resolved, driving the completed/current/upcoming state on the
      Route screen — geofence-based auto-arrival replaces/augments this
      once GPS lands in Phase 8
- [x] Skip Stop — explicit driver action with confirmation, visible to
      admins in Daily Operations
- [x] Route Completion Check — COMPLETE ROUTE is blocked with a clear count
      of unresolved students until every assignment is resolved, matching
      the "no casual completion" requirement; success shows the picked-up/
      dropped-off tally
- [x] Admin **Daily Operations** screen — today's buses with progress,
      current stop, tap-to-expand per-stop student status, and a tel: link
      to call the driver
- [x] Admin **Attendance** dashboard — every student today, filterable by
      route/status/search, with pending/not-confirmed counted up top
- [x] `driver` i18n namespace extended with all new confirmation/skip/
      completion strings (EN/AR). Known gap: the two new admin screens
      (Daily Operations, Attendance) use inline English copy rather than
      the `dashboard` namespace yet — flagged for a follow-up pass rather
      than shipped as if it were already bilingual
- [ ] Phase 8 (Live GPS Tracking) — next, pending your review

## Status — Phase 8 complete

- [x] Real background GPS tracking on the driver app — `expo-location` +
      `expo-task-manager`, registered at module scope so it survives an app
      relaunch mid-route; starts automatically when a route is `on_route`
      (including on app reopen) and stops on completion
- [x] Buffer-first, sync-second offline queue (`gpsQueue.ts`) — every point
      is written to `AsyncStorage` before any network attempt; a foreground
      15s interval plus an app-foreground listener flush it, and nothing is
      lost if the flush fails, only retried
- [x] Points synced more than 60s after capture are flagged
      `is_offline_backfill` so admins can tell a backfilled trail from live
      data
- [x] Location permissions requested at START ROUTE (not before) — clear
      messaging if foreground access is denied (blocks starting) vs.
      background access is denied (route starts, tracking pauses if the
      iPad is locked — explained to the driver, not silently degraded)
- [x] Geofence proximity banner on the Route screen — a UI-only "you're near
      your next stop" hint computed client-side; it does **not** auto-mark
      any student, matching the "driver must explicitly confirm" requirement
- [x] `SyncStatusBadge` — online/offline/"syncing N" shown on the Route
      screen
- [x] Admin **Live Bus Map** (built in Phase 3, was empty by design) now
      genuinely receives markers the moment a driver starts tracking; added
      a click-to-open info window (bus, driver, route, speed, last update)
- [x] Fixed a Phase 3 bug found while wiring this up: the dashboard's
      `ActiveRouteRow` had no `busId`, so the Live Map couldn't actually
      match GPS points to bus/driver/route info — added `bus_id` to the
      query and fixed the map's lookup key
- [ ] Phase 9 (Alerts + Route Deviation) — next, pending your review

## Status — Phase 9 complete

- [x] **Route deviation detection** — a trigger on every `gps_locations`
      insert compares the point against the day's stop sequence (as a
      straight-line approximation — noted as a v1 simplification; a
      road-snapped polyline from the Directions API result is a natural
      follow-up), and opens a `route_deviation` alert past the school's
      configurable threshold, debounced to avoid spamming
- [x] **Stop skipped** alert — fires automatically when a driver skips a
      stop (Phase 7's action), visible to admins immediately
- [x] **Bus offline** and **pickup/drop-off not confirmed** alerts — a new
      `run_periodic_alert_checks()` function, schedulable via `pg_cron`
      (auto-attempted, with a documented manual/external fallback since
      `pg_cron` isn't guaranteed available on every project)
- [x] Not-confirmed detection also flips the assignment's own status to
      `not_confirmed`, so it shows correctly in the Phase 7 Attendance
      dashboard too — the two features now agree with each other
- [x] Admin **Alerts Center** — severity-coded feed (🔴/🟠/🟡), filters,
      resolve action, and a live Supabase Realtime subscription so new
      alerts appear without a manual refresh
- [x] Unresolved-alert count badge on the sidebar's Alerts nav item,
      updating in real time
- [x] All alert-generating functions are `SECURITY DEFINER` with a stated
      reason (drivers/cron have no direct `alerts` INSERT rights by design,
      per the Phase 1 RLS policy) rather than quietly loosening RLS
- [ ] Phase 10 (Reports) — next, pending your review

## Status — Phase 10 complete

- [x] **Reports** screen — 4 tabs (Daily Attendance, Route/Driver/Bus
      Performance), date-range filter, CSV export (UTF-8 BOM so Arabic text
      opens correctly in Excel); PDF export explicitly flagged as not yet
      built rather than faked
- [x] Daily Attendance: real per-student rows + a scheduled/picked-up/
      dropped-off/absent/not-confirmed summary strip
- [x] Route Performance: planned vs. actual duration, stops/skips, deviation
      count per route
- [x] Driver/Bus Performance: aggregated from real `daily_routes`/`alerts`/
      `gps_locations` data; On-Time % is explicitly noted as an
      approximation (zero-deviation routes) since v1's schema has no
      scheduled-start field to compare against — documented in the UI, not
      hidden
- [x] Fixed a gap noticed while building this: **Live Tracking** had been a
      placeholder pointing to the Dashboard's embedded map since Phase 3 —
      built it out as its own full screen (map + bus list panel) now that
      Phase 8/9 give it real data worth a dedicated view
- [ ] Phase 11 (Offline Synchronization hardening) — next, pending your
      review

## Status — Phase 11 complete

- [x] **Action queue** for pickup/drop-off confirmations and not-confirmed
      markings (`actionQueue.ts`) — this was the real gap: Phase 7's
      confirmations assumed the network call would simply succeed. Now a
      failed confirm/not-confirm is queued locally instead of shown as a
      scary error or silently lost, exactly matching "do not lose
      attendance records because of poor connectivity"
- [x] **"Pending sync" state** — a queued-but-unsynced student shows a
      distinct amber "Pending sync" label (not confused with a real
      server-confirmed status), and re-tapping it is handled gracefully
      instead of double-submitting
- [x] **Offline read cache** — Today's route/stops are cached to
      `AsyncStorage` after every successful fetch and served from cache if
      the live fetch fails, so a driver who opens the app with no signal
      still sees their route instead of a blank screen
- [x] **Unified flush** — GPS pings and pickup/drop-off actions now sync
      together on the same foreground timer, app-foreground event, and a
      new `NetInfo`-driven reconnect trigger (`@react-native-community/
      netinfo`), replaying in order and never dropping an action
- [x] `SyncStatusBadge` extended to reflect both queues plus a
      "showing last saved route" state, and added to the Today and Students
      screens (previously Route-only)
- [x] **Sync Diagnostics** section on Profile — pending GPS/action counts
      and last-synced time, giving the driver (and, by extension, whoever's
      troubleshooting with them) real visibility rather than a silent queue
- [ ] Phase 12 (Testing + Deployment) — next, pending your review

## Status — Phase 12 complete — Project Delivered

- [x] **Driver app tests** (Jest/jest-expo): `routeProgress.ts` stop-state
      logic, `geofence.ts` distance math, and — most importantly —
      `gpsQueue.ts`/`actionQueue.ts`'s offline guarantees (buffer-first
      enqueue, a failed flush never drops data, retries preserve order)
- [x] **Admin app tests** (Vitest): CSV export escaping, the Route Editor's
      stop-reorder sequencing logic
- [x] Deduplicated `stopProgressState`/`findCurrentStop` out of RouteScreen
      and StudentsScreen into one shared, tested module while writing these
      tests — a real cleanup, not just test scaffolding
- [x] **SQL assertion tests** (`supabase/tests/`) for the three DB-level
      guarantees that matter most and can't be meaningfully unit-tested:
      duplicate pickup/drop-off prevention, `generate_daily_route()`
      idempotency, and driver-to-driver RLS isolation
- [x] `docs/testing.md` explaining what's automated where and why, plus a
      **manual QA checklist** (`docs/manual-qa-checklist.md`) for the
      end-to-end/device-dependent flows that genuinely need a human and a
      real iPad
- [x] `docs/deployment.md` — GitHub branch structure, full environment
      variable reference, step-by-step Hostinger deployment (including the
      `.htaccess` SPA rewrite rule), and Codemagic setup (signing,
      background-location provisioning, a starter `codemagic.yaml`,
      TestFlight → App Store path)

### Final deliverables checklist (from the original brief)

1. [x] Fully structured GitHub project (`/apps`, `/packages`, `/supabase`, `/docs`)
2. [x] Premium admin web portal
3. [x] iOS/iPad driver application
4. [x] Supabase database schema (13 migrations)
5. [x] Authentication
6. [x] Role-based access (RLS, enforced end-to-end, tested)
7. [x] Route management
8. [x] Student management
9. [x] Bus management
10. [x] Driver management
11. [x] Pickup tracking
12. [x] Drop-off tracking
13. [x] Absentee monitoring
14. [x] Live GPS tracking
15. [x] Route deviation alerts
16. [x] Offline synchronization
17. [x] Reports
18. [x] Audit logs
19. [x] Demo data (seed script)
20. [x] GPS simulator — `scripts/gps-simulator.js` (dev/demo tool, not part of either app)
21. [x] Deployment documentation
22. [x] Codemagic configuration (real `codemagic.yaml` at repo root — driver
    iOS dev + TestFlight-publishing workflows, admin web, parent portal web)
23. [x] Hostinger deployment instructions
24. [x] README
25. [x] Environment configuration examples

### Known limitations / good next steps

Flagged as such throughout rather than silently shipped as complete:
- **Route deviation** now prefers the road-snapped polyline captured from
  the Route Editor's Directions API call (migration `0014`, `routes.road_polyline`),
  falling back to the older straight-line-through-stops approximation for any
  route that hasn't been re-opened in the editor since this shipped.
- **`pg_cron`-scheduled alert checks** need either `pg_cron` enabled on the
  Supabase project or an external scheduler — see `docs/local-development.md`.
- **Parent portal** (`apps/parent-portal`) is now bilingual (EN/AR, matching
  the admin/driver apps) with self-serve account linking via invite links
  generated from the admin Students page, and a standard "forgot password"
  reset flow — no more manual `guardian_user_id` setup and no more "a new
  invite link works as a de facto password reset" workaround. Still narrow
  in other ways: no live map (a "last seen" timestamp instead), polling
  instead of push notifications. See `apps/parent-portal/README.md` for
  the full scope note.
- **Route Replay** now has a UI (Daily Operations → "Replay route →", or
  `/daily-operations/:dailyRouteId/replay`) — scrub/play a completed route's
  full GPS trail over the map. Playback speed is a scrubbing aid based on
  ping order, not a strict real-time reconstruction of gaps between pings.
- The GPS simulator can drive a real `daily_routes` instance end-to-end
  (including deliberately triggering deviation alerts via `--deviate-meters`)
  but doesn't yet model realistic traffic-aware speed variation — it's linear
  interpolation between stops at a constant speed.
- **Test coverage**: the pure logic behind Route Replay (trip duration),
  PDF export (cell formatting), the guardian invite flow (URL building,
  invite-usability rules, and rate-limiting), and the parent portal
  ("time ago" formatting) all have unit tests. RLS policies have a real
  pgTAP suite run against actual PostgreSQL, covering both SELECT and
  write (INSERT/UPDATE/DELETE) isolation — see "RLS testing found and
  fixed a real bug" and "Three more pre-existing bugs" below; this is the
  work that matters most, because it caught multiple genuine bugs
  (one ship-blocking) before they reached a live project. Both apps also
  now have their first React component tests (`Modal.test.tsx`,
  `LanguageSwitcher.test.tsx`) — a real, if small, start on the one gap
  that used to be described here as entirely uncovered. What's *still*
  not covered: most component rendering/interaction (two components isn't
  the whole UI), and the Edge Functions' actual HTTP/Supabase-client
  behavior (their pure validation logic is unit tested with `deno test`,
  but not the full request-handling flow — see "Edge Function testing"
  below for exactly where that line sits). None of this is a newly
  invented gap — it's the same gap, narrowed round over round — but it's
  still real, and worth naming precisely rather than letting "added
  tests" imply more than it does.
- **Guardian invite rate limiting**: `accept-guardian-invite` now caps
  wrong-password attempts against the "link to an existing account" path
  at 5 per invite (migration `0019`, `guardian_invites.failed_attempts`)
  — there was no protection against password-guessing on that path
  before this round.

## Quick start

See [`docs/local-development.md`](./docs/local-development.md).

## Design principles baked into the schema

- **Master vs. daily separation**: `routes`/`route_stops` never change day to
  day; `daily_routes`/`daily_route_stops`/`daily_student_assignments` are the
  generated, overridable instance for a given `service_date`.
- **Immutable events**: `pickup_events`/`dropoff_events` are insert-only with a
  uniqueness constraint per assignment — no duplicate or retroactively edited
  confirmations.
- **Multi-tenant by default**: every operational table carries `school_id`,
  enforced end-to-end by RLS, so a second school can be onboarded without
  schema changes.
- **Bilingual where it matters**: `name_en`/`name_ar` columns only on
  admin-entered content (schools, routes, stops, students); everything else
  (statuses, buttons, labels) lives in translation files.

## Post-delivery audit

After Phase 12, the project was audited by actually installing dependencies
and running `tsc`, `vitest`, `jest`, and `vite build` for real — not just
reviewing code — for both apps, plus a manual pass over every SQL migration
and the Edge Function. Real issues were found and fixed:

**Critical (would have blocked deployment):**
- `migrations/0007_row_level_security.sql` had three `CREATE POLICY`
  statements using `for insert, update, delete` — Postgres only allows one
  command per policy, so this migration would have failed to apply. Split
  into correctly-scoped INSERT/UPDATE/DELETE policies.
- `apps/driver-ios` had no `babel.config.js` at all — Metro couldn't have
  bundled the app. Added it (`babel-preset-expo`).
- `apps/driver-ios` had no `tsconfig.json` — no type-checking was actually
  happening. Added one.

**Real logic bugs:**
- `run_periodic_alert_checks()` (migration 0013) compared naive
  `date + time` arithmetic against `now()` without accounting for
  `schools.timezone` — wrong for any school not on UTC, including the
  Muscat deployment this whole system targets. Fixed with `timezone(s.timezone, ...)`.
- Six client-side "today" computations (`new Date().toISOString().slice(0,10)`)
  had the same UTC-vs-local bug, most critically in the driver app's own
  "which route is mine today" lookup. Added a shared `localDateOnly()`
  helper in each app and fixed every call site.
- `create-staff-account` Edge Function had no CORS handling — every call
  from the admin web app would have failed in the browser. Fixed.

**Test infrastructure** (found by actually getting the suites to run
green, not just written and left unrun): a React 19 peer conflict from an
unused dependency, an incorrect Jest `transformIgnorePatterns` override,
two `jest.mock()` hoisting violations, and incorrect AsyncStorage mock
wiring — all fixed; both suites now pass in full (12/12 admin, 22/22 driver).

## Post-branding follow-up (this round)

Everything below was verified with real tool runs (`npm install`, `tsc`,
`vitest run`, `jest --ci`, `vite build`), not just read over:

- Demo school renamed from the placeholder "Example International School"
  to "Al Noor International School" (`supabase/seed/seed.sql`).
- Real `codemagic.yaml` at the repo root, replacing the doc-only example
  (three workflows: `driver-ios-dev`, `driver-ios-production` with
  TestFlight publishing, `admin-web`; a fourth, `parent-portal-web`, was
  added alongside the new parent portal).
- Daily Operations and Attendance now use the i18n system (`operations`
  and `attendance` namespaces, EN/AR) instead of inline English — every
  admin screen is bilingual now.
- Route deviation detection upgraded to prefer a road-snapped polyline
  (migration `0014_road_snapped_deviation.sql`, `routes.road_polyline`,
  captured from the Route Editor's existing Directions API call) over the
  old straight-line approximation, which remains as a fallback.
- PDF export added to Reports (`apps/admin/src/lib/pdf.ts`, `jspdf` +
  `jspdf-autotable`) alongside the existing CSV export.
- `scripts/gps-simulator.js` — a dev/demo tool that drives a real
  `daily_routes` instance's GPS trail, including a `--deviate-meters` flag
  to deliberately exercise deviation alerts.
- Route Replay UI: `gps_locations_with_coords` view (migration `0015`),
  `apps/admin/src/pages/RouteReplay.tsx` + `RouteReplayMap.tsx`, linked from
  Daily Operations.
- Parent portal (`apps/parent-portal`) — schema/RLS in migrations `0016`
  (adds the `parent` role) and `0017` (`students.guardian_user_id` +
  read-only RLS scoped to "my own children's data"), plus a minimal
  working v1 app. Scope and gaps documented in
  `apps/parent-portal/README.md` rather than left implicit.

All four `npm`/`vite` builds (admin, driver-ios, parent-portal, plus the
existing test suites) were run clean before this was packaged — see each
migration/file's inline comments for the reasoning behind specific
decisions (e.g. why `0016` is a standalone file, why `decode_road_polyline`
swallows exceptions).

## Parent portal i18n + self-serve invites (this round)

Also verified with real tool runs, not just read over — both apps
reinstalled, type-checked, tested, and built clean after every change below:

- **Parent portal is now bilingual.** `apps/parent-portal/src/locales/`
  (EN/AR), `src/i18n.ts`, and a language switcher — same RTL-toggle pattern
  the admin app uses, scaled down to the portal's single `portal` namespace.
- **Self-serve guardian invites**, replacing manual `guardian_user_id`
  setup:
  - Migration `0018_guardian_invites.sql` — `guardian_invites` table,
    admin-only RLS (no anon/parent access at all; see next point).
  - `supabase/functions/accept-guardian-invite/index.ts` — a new Edge
    Function (deployed with `--no-verify-jwt`, since a parent has no
    session yet when they open the link) that verifies a token and either
    creates a new parent account or links an *existing* one (matched by
    email + school, password re-verified via `signInWithPassword`) — so a
    parent with two children invited separately ends up with one account,
    not two.
  - Admin side: Students page → "Invite parent →" generates and displays
    the shareable link (`apps/admin/src/lib/queries/guardianInvites.ts`,
    `Students.tsx`).
  - Parent side: `/invite/:token` (`apps/parent-portal/src/pages/InviteAccept.tsx`)
    verifies the link, collects signup details, and signs the parent in on
    success.
- **Admin bundle-size fix**: `apps/admin/vite.config.ts` now splits
  `@react-google-maps/api` and `jspdf`/`jspdf-autotable` into their own
  chunks — main bundle dropped from 1.1MB to ~412KB, clearing Vite's
  500kB chunk-size warning.

**Known gap, called out rather than hidden**: none of the above — Route
Replay, the parent portal, PDF export, or this invite flow — has automated
test coverage yet. Type-checking and manual review caught issues (this is
real, not a rubber stamp), but "no unit tests" is a genuinely different
bar than the rest of this README claims for the original 12 phases, and
worth fixing before treating any of this round as done-done.

Both apps verified clean end-to-end: `tsc --noEmit`, test suite, and (for
admin) a full production `vite build`.

## Testing added (this round)

Closed most of the gap named directly above. Rather than trying to unit
test jsPDF/Google Maps/React rendering directly (heavy DOM/canvas
dependencies that don't run meaningfully in a node test environment —
consistent with why this project's existing tests were always pure-logic
only, not component tests), the actual *logic* behind each new feature was
extracted into small, dependency-free functions and tested directly:

- `apps/admin/src/lib/pdfFormat.ts` (`cellsToDisplayRows`) — null/undefined
  → em-dash handling for PDF export, split out of `pdf.ts` so it doesn't
  drag in jsPDF. 6 tests.
- `apps/admin/src/lib/replayDuration.ts` (`tripDurationMinutes`) — the trip
  length calculation behind Route Replay's header, split out of
  `RouteReplay.tsx`. 4 tests, including one that would catch a
  sum-of-gaps bug (it only compares first/last point, not every gap).
- `apps/admin/src/lib/inviteUrl.ts` (`buildInviteUrl`) — trailing-slash
  handling for the shareable invite link, split out of `guardianInvites.ts`
  specifically so it *doesn't* import the Supabase client (which throws in
  a test environment with no `VITE_SUPABASE_*` vars set — this is also why
  it isn't `pdf.ts`/`RouteReplay.tsx` themselves being tested, but small
  siblings next to them). 4 tests.
- `apps/parent-portal/src/lib/timeAgo.ts` (`compactDurationLabel`,
  `secondsSince`) — the "Bus last seen Xm ago" formatting, split out of
  `App.tsx`. 7 tests. This also means the parent portal has a real test
  suite (`npm test`, `vitest.config.ts`) for the first time — it had none
  before this round — and `codemagic.yaml`'s `parent-portal-web` workflow
  now runs it before building.

Admin: 26/26 tests passing (up from 12), full `vite build` clean, chunk
warning still resolved. Parent portal: 7/7 tests passing (up from 0),
`tsc -b` and `vite build` both clean. **Still not covered**, and not
pretended to be: RLS policy behavior, the two Edge Functions, and any
React component rendering/interaction — see the "Known gap" note above,
which now describes the remaining, smaller slice of the original gap
rather than all of it.

## RLS testing found and fixed a real bug (this round)

This is the one worth reading even if nothing else in this file is: real
PostgreSQL 16 + PostGIS + pgTAP were installed and all 18 migrations run
against a live database for the first time (`supabase/tests/`,
`docs/testing-rls.md`), and it caught a genuine, ship-blocking bug in
migration `0017_parent_portal.sql` that pure code review — the standard
this project had been holding migrations to until now — had missed twice
in a row across two rounds of work.

**The bug**: two of `0017`'s parent-facing RLS policies (on
`daily_route_stops` and `daily_routes`) queried their own table from
inside their own policy definition. Combined with a *pre-existing*
Phase-1 driver policy that queried in the opposite direction
(`students_select_driver` → joins `daily_route_stops`), this created a
two-table RLS cycle. The result: `ERROR: infinite recursion detected in
policy for relation "daily_student_assignments"` — and critically, this
wasn't parent-only breakage. PostgreSQL plans every SELECT policy on a
table regardless of the querying role, so this would have broken
**ordinary admin and driver queries against `students`** the moment this
migration reached a real Supabase project — not a parent-portal edge
case, a core-product outage.

**The fix**: route every cross-table "which rows belong to my children"
lookup through a `SECURITY DEFINER` helper function
(`current_user_child_daily_route_stop_ids()`,
`current_user_child_daily_route_ids()`) — the same pattern
`current_user_school_id()`/`is_admin()`/`current_driver_id()` already used
since Phase 1. A security-definer function's owner (the migration role)
bypasses RLS, so queries *inside* the function never trigger policy
evaluation on the tables they touch, which breaks the cycle at its root
instead of shuffling which table recurses into which.

**Verified, not just fixed**: dropped and rebuilt the test database from
scratch after the fix, reran all 18 migrations clean, and reran the full
pgTAP suite — 19/19 assertions passing across all three test files
(`001_multi_tenant_isolation.sql`, `002_parent_own_children_only.sql`,
`003_guardian_invites_locked_down.sql`). Also manually re-verified the
original Phase-1 driver access pattern (the one whose pre-existing policy
exposed the cycle) still returns exactly the driver's own assigned
student/assignment/stop/route — the fix removed the recursion without
regressing what was already working.

See `docs/testing-rls.md` for how to run this yourself, and
`0017_parent_portal.sql`'s own comments for the fuller technical writeup
inline with the code it's about.

## Three more pre-existing bugs, found the same way (this round)

While verifying the new `rls/` suite, a routine `find` turned up three
older standalone SQL test files already sitting in `supabase/tests/`
(`001_duplicate_event_prevention.sql`,
`002_generate_daily_route_idempotent.sql`,
`003_rls_role_permissions.sql`) — written in an earlier phase, never
mentioned as run in any prior audit note, and (once actually executed)
turned out to have never actually passed:

- `001`'s cleanup violated a foreign key every time (fixed: delete
  `pickup_events` before the cascading school delete reaches `drivers`,
  which is `ON DELETE RESTRICT` on purpose, to protect audit history).
  The real assertion passed every time — only the cleanup was broken —
  but it still exited non-zero, which reads as a failure.
- `003` set the wrong Postgres config variable for simulating an
  authenticated user (`request.jwt.claims` instead of the flat
  `request.jwt.claim.sub` Supabase's real `auth.uid()` reads), so the
  simulated driver was never actually authenticated — plus it never
  created any `route_stops`, so its own student-assignment setup silently
  inserted zero rows. The resulting failure message ("RLS is
  over-restrictive") pointed at the RLS policy; the real problem was
  entirely in the test's own setup, on two independent counts.
- `003` again: its cleanup only ever deleted the `auth.users` rows it
  created, with a comment claiming that cascaded away everything else —
  backwards; nothing cascades from `auth.users` up to `schools`. Every
  run silently left a full school's worth of orphaned data behind.
  Confirmed by running it three times before the fix: three duplicate
  "RLS Test School" rows, not one.

`002` had no bugs — it passed the first time it was ever run. All three
files now pass cleanly and repeatably (each rerun three times post-fix
with zero leftover rows). None of the three real bugs were in the
application; all three were in test setup/cleanup code that had simply
never been verified. See `docs/testing-rls.md`'s "Pre-existing tests that
had never been run" section for the full writeup, and each fixed file's
own inline comments for the specifics.

## Edge Function testing (this round)

`create-staff-account` and `accept-guardian-invite` both import
`https://deno.land/std/http/server.ts` and `https://esm.sh/@supabase/
supabase-js`, which need network access at import time — not available in
every environment (this repo's own sandboxed tool-use environment
included, where `deno.land` returns 403). Rather than leave the Edge
Functions completely untested because of that, their pure validation
rules (PIN/password length, email/full-name presence, invite
used/expired checks) were extracted into
`supabase/functions/_shared/validation.ts` — a dependency-free module
both functions import — and unit tested with the real `deno test` runner
(Deno 2.9.6, installed and run in this environment): **12/12 tests
passing**, covering edge cases like "a used AND expired invite reports
'already used', not 'expired'" and the exact-instant boundary on expiry
checks. `deno lint` (syntax/AST-level, no network needed) also confirms
all three function files parse cleanly.

**What this doesn't cover**: the functions' actual HTTP request handling,
Supabase Auth calls (`admin.createUser`, `signInWithPassword`), and
database writes are still manually verified only — `deno test`ing those
would need either network access to the real `deno.land`/`esm.sh` imports
(unavailable here) or mocking the Supabase client deeply enough that the
test would mostly be exercising the mock. Testing the extracted pure
rules is a real, meaningful slice of the whole — not the whole thing.

## Parent password reset (this round)

`apps/parent-portal` now has a standard forgot-password flow: "Forgot
password?" on the login screen calls
`supabase.auth.resetPasswordForEmail`, and a new `/reset-password` route
(`src/pages/ResetPassword.tsx`) handles the email link — via Supabase's
`PASSWORD_RECOVERY` auth event, not just "this route was reached" — and
lets the parent set a new password. The confirmation message is
identical whether or not the email actually has an account, since
confirming/denying account existence to an unauthenticated caller is its
own small information leak. Requires adding the reset-password URL to the
Supabase project's Auth redirect allow-list — see
`apps/parent-portal/README.md`'s "Deploying" section.

## Guardian invite rate limiting (this round)

`accept-guardian-invite`'s "link this child to an existing account" path
calls `signInWithPassword` with a caller-supplied password — the one
genuinely guessable secret in the whole invite flow (the token itself is
192 bits of randomness; passwords aren't). Nothing in this project's own
code limited how many guesses that path would accept before this round.

Migration `0019_guardian_invite_rate_limit.sql` adds
`guardian_invites.failed_attempts`; the Edge Function increments it on
each wrong-password attempt and refuses further tries on that invite
(`too_many_attempts`, HTTP 429) once it hits
`MAX_INVITE_ATTEMPTS` (5) — a named constant in
`supabase/functions/_shared/validation.ts`
(`hasExceededInviteAttempts`), not a magic number duplicated between the
function and its tests. **3 new `deno test` cases** cover the boundary
(under the limit, at the limit, over the limit) and a custom-max variant,
bringing the Edge Function validation suite to **15/15 passing**. The
invite itself stays usable via a fresh link from the admin even after
hitting the limit — this blocks guessing on one invite, it doesn't lock
the family out.

## RLS write-policy tests (this round)

The pgTAP suite from earlier only covered SELECT — a table can correctly
hide another school's rows from SELECT while still letting an admin
blindly INSERT/UPDATE/DELETE into them if the *write* policy's `with
check`/`using` clause is missing or wrong, which SELECT tests alone can't
catch. Two new suites close that gap:

- `004_admin_write_isolation.sql` (5 assertions) — an admin's INSERT is
  accepted for their own school and rejected (`42501`, real RLS
  violation) for another; UPDATE/DELETE against another school's row is a
  silent no-op rather than an error, confirmed both from the admin's own
  side and independently as `postgres` (bypassing RLS) to verify the
  target row genuinely wasn't touched.
- `005_driver_write_scope.sql` (4 assertions) — a driver can update their
  own `daily_routes` row but not another driver's, even within the same
  school, and can't INSERT a new `daily_routes` row at all (that's
  admin-only — there's no driver-insert policy on that table by design).

All 5 pgTAP files (28 assertions total), the 3 standalone tests, all 19
migrations, and the seed data were reverified together end-to-end on a
freshly dropped-and-recreated database after adding these — see
`docs/testing-rls.md`.

## First React component tests (this round)

Every test in this project before this round — including everything
added in the previous three rounds — was pure-logic-only: no test ever
rendered a component or clicked a button. Both apps now have jsdom +
`@testing-library/react` wired in (`vitest.config.ts` in each app stays
`node` by default for the existing fast pure-logic tests; component test
files opt into `jsdom` individually via a `// @vitest-environment jsdom`
docblock, so this didn't slow down or change behavior for anything
already passing):

- `apps/admin/src/components/__tests__/Modal.test.tsx` — renders title
  and children, calls `onClose` on the close button, and (the check that
  actually matters, not just "it rendered") does *not* call `onClose`
  from clicking inside the modal body.
- `apps/parent-portal/src/components/__tests__/LanguageSwitcher.test.tsx`
  — renders both language options against the app's real i18n setup (not
  a mock), and — the one worth having — confirms that switching to
  Arabic actually flips `document.documentElement.dir` to `rtl` and back,
  which is the real-world effect this component exists to produce, not
  just an internal state change.

Admin: **29/29 tests passing** (up from 26). Parent portal: **10/10
passing** (up from 7). Both `tsc` and full `vite build` reconfirmed clean
after adding the new dev dependencies. This is a real start, not a
completed gap — two components is not the UI, and the "React component
rendering/interaction" line in "Known limitations" above still stands,
just narrower than it was.

