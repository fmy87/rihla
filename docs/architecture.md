# Rihla — School Bus Route Management & Live Tracking System
## Phase 1 — Architecture Review (for approval before implementation)

---

## A. Recommended Architecture

**Three coordinated surfaces, one backend:**

1. **Admin Web** (React + TypeScript + Vite + Tailwind) — deployed to Hostinger as a static build, talking directly to Supabase over HTTPS/WebSockets. Installable as a PWA.
2. **Driver iPad App** (Expo / React Native, built via Codemagic, distributed via TestFlight → App Store) — a real installable iOS app, not a WebView wrapper. Talks to Supabase directly, with a local SQLite/AsyncStorage queue for offline events.
3. **Backend** — Supabase (PostgreSQL + Auth + Realtime + Storage + Row Level Security). No custom server is required for v1; Postgres functions/triggers and Supabase Edge Functions handle server-side logic (deviation calculation, audit logging, notification dispatch hooks).

**Data flow:**

```
Admin Web  ───┐
              ├──►  Supabase Auth (RLS-scoped sessions)
Driver iPad ──┘
              │
              ▼
      Supabase PostgreSQL  ◄──── Edge Functions (deviation calc,
              │                   grace-period alerts, audit triggers)
              ▼
      Supabase Realtime (Postgres CDC over WebSocket)
              │
     ┌────────┴────────┐
     ▼                 ▼
Admin live map    (future) Parent app
receives bus
position/status
updates in <1s
```

**GPS flow specifically:**

```
Driver iPad GPS (foreground + background task)
   → local buffer (always writes here first)
   → if online: batch-upsert to `gps_locations` table (every 10–30s, configurable)
   → if offline: buffer persists (SQLite queue)
   → on reconnect: flush queue in order, mark synced
   → Postgres trigger/Edge Function computes deviation vs planned route
   → writes to `alerts` if threshold exceeded
   → Realtime pushes bus position + alert to Admin Web map
```

Why this shape: it avoids a custom backend to build/host/secure, gets you real-time out of the box via Postgres logical replication, and RLS lets the same tables serve admins, transport admins, drivers, and (later) parents with row-level isolation instead of separate APIs per role.

---

## B. System Architecture Diagram

```
┌─────────────────────┐        ┌─────────────────────┐
│   Admin Web (SPA)    │        │  Driver iPad App     │
│ React/TS/Vite/Tailwind│       │ Expo/React Native    │
│ Deployed: Hostinger   │       │ Built: Codemagic     │
│ Map: Google Maps JS   │       │ Map: Google Maps SDK │
└──────────┬───────────┘        └──────────┬───────────┘
           │  HTTPS + WSS                  │ HTTPS + WSS
           │  (Supabase client, RLS-scoped)│ (offline queue + sync)
           ▼                               ▼
┌─────────────────────────────────────────────────────┐
│                     Supabase                          │
│  ┌───────────┐ ┌───────────┐ ┌────────────────────┐  │
│  │   Auth    │ │ PostgreSQL │ │  Realtime (CDC)    │  │
│  │ (RBAC via │ │  + RLS     │ │  → live bus pos,   │  │
│  │  JWT roles)│ │  policies  │ │    alerts, status  │  │
│  └───────────┘ └─────┬─────┘ └────────────────────┘  │
│                       │                                │
│              ┌────────▼────────┐                       │
│              │  Edge Functions  │  deviation calc,      │
│              │  (Deno)          │  grace-period sweep,  │
│              │                  │  notification hooks   │
│              └──────────────────┘                       │
│  ┌───────────┐                                          │
│  │  Storage   │  driver photos, logos, exported reports │
│  └───────────┘                                          │
└─────────────────────────────────────────────────────┘
```

---

## C. Database ERD (major tables & relationships)

```
schools 1───* users (role: super_admin | transport_admin | driver)
schools 1───* buses
schools 1───* drivers (1-to-1 with a users row, role=driver)
schools 1───* students
schools 1───* routes

buses        1───* daily_routes  (a bus operates 0..1 daily_route per date/direction)
drivers      1───* daily_routes  (assigned driver per day, may differ from master)
routes       1───* route_stops        (MASTER: permanent config)
routes       1───* daily_routes        (generated per-day instance of a master route)

daily_routes 1───* daily_route_stops   (TODAY: mutable copy of route_stops,
                                         may include skips/temp stops)
route_stops  1───* student_route_assignments (master assignment: student ↔ stop)
daily_route_stops 1───* daily_student_assignments (today's actual assignment,
                                                    inherits from master, editable)

daily_student_assignments 1───1 pickup_events   (0..1 — created on confirm)
daily_student_assignments 1───1 dropoff_events  (0..1 — created on confirm)

buses        1───* gps_locations   (time-series, high volume, indexed by bus_id+ts)
daily_routes 1───* alerts          (deviation, offline, not-picked-up, skipped-stop…)
students     1───* attendance      (daily rollup: scheduled/picked_up/absent/…)

users        1───* audit_logs      (who/what/when on every mutating action)
schools      1───1 system_settings (geofence radius, deviation threshold, GPS
                                     interval, grace period, timezone, default lang)
users        1───* notifications   (future parent portal ready)
```

**Key design decisions embedded in the schema:**
- `routes`/`route_stops` = master config; `daily_routes`/`daily_route_stops`/`daily_student_assignments` = today's operational instance. Admin overrides never touch the master.
- `pickup_events`/`dropoff_events` are append-only, immutable once written (duplicate-prevention enforced via a unique constraint on `(daily_student_assignment_id, event_type)`).
- `gps_locations` is partitioned/indexed by `(bus_id, recorded_at)` for fast "latest position" and historical replay queries.
- Bilingual fields (`name_en`/`name_ar`) live directly on `schools`, `routes`, `route_stops`, `students` (name only), and `buses` (nickname) — see Section on bilingual architecture below.
- `school_id` foreign key on every tenant-scoped table + RLS policies keyed off `auth.jwt()` claims gives multi-school isolation without separate databases.

---

## D. User Journeys

**Primary journey (the one the whole system is built around):**

```
Admin creates route (master)
  → assigns bus + driver
  → assigns students to stops
  → route marked "active"
  → [each morning] system generates today's daily_route from master
  → driver opens iPad app, sees "Today's Route", taps START ROUTE
  → daily_routes.status → on_route, start GPS timestamp recorded
  → GPS tracking begins (buffered locally, synced every 10–30s)
  → Edge Function compares actual position vs planned route continuously
  → driver's app shows current/next stop; geofence entry → "Arrived" prompt
  → driver taps PICKED UP per student → pickup_events row + attendance update
  → Realtime pushes each event to Admin's Daily Operations screen instantly
  → if scheduled time + grace period passes with no confirmation
       → alert created, surfaced on Admin's Absentee dashboard
  → driver reaches final stop → Route Completion Check
       (must resolve all pending students before completing)
  → daily_routes.status → completed, end GPS timestamp recorded
  → admin can review Reports / Route Replay for that day
```

**Secondary journeys** (documented, built in later phases): transport admin makes a same-day override (skip stop / swap driver) without touching master route; driver logs offline and syncs on reconnect; admin resolves a route-deviation alert; admin generates and exports a daily attendance report.

---

## E. Screen Map

**Admin Web**
- Login (EN/AR)
- Dashboard (today's overview + live map + active routes table)
- Live Tracking (full-screen map, bus detail panel)
- Routes → Route List → Route Editor (map + stop list, drag-reorder)
- Buses → Bus List → Bus Detail/Edit
- Drivers → Driver List → Driver Detail/Edit
- Students → Student List → Student Detail/Edit → Assign to Stop
- Stops → Stop List → Stop Editor (map picker, geofence radius)
- Daily Operations (today's buses, card/table view, quick actions, overrides)
- Attendance / Absentee Dashboard (filters: date, route, bus, stop, grade, status)
- Alerts Center (live feed, severity, resolve action)
- Reports (Daily Attendance, Route Performance, Driver Performance, Bus Performance; CSV/PDF export)
- Route Replay (date/bus/route picker → planned vs actual playback)
- Users (role management)
- Settings (branding, timezone, geofence radius, deviation threshold, GPS interval, grace period, default language)

**Driver iPad**
- Login (Employee ID + PIN, or phone/email + password; biometric unlock after first login)
- Today (route summary, bus, status, START ROUTE)
- Route (map + stop sequence: completed / current / upcoming)
- Current Stop (student list, PICKED UP / NOT PICKED UP with reason)
- Route Completion Check (picked up / dropped off / pending counts, resolve-required)
- History (past routes, read-only)
- Profile (language switcher, sync status, emergency button always accessible)

---

## F. Technology Decisions

| Area | Choice | Why |
|---|---|---|
| Admin frontend | React + TS + Vite + Tailwind | Fast dev loop, static-buildable for Hostinger, strong typing across a data-heavy UI |
| Driver app | Expo (React Native) | Real installable iOS app with managed background-location config, shares TypeScript types/logic with admin, buildable through Codemagic without a Mac |
| Backend | Supabase/Postgres | Auth + DB + Realtime + RLS + Storage in one managed service; avoids building/hosting a custom API for v1; Realtime (via Postgres CDC) is exactly what live tracking needs |
| State sync (offline) | Local SQLite (expo-sqlite) queue + background sync worker | Required for "never lose an attendance record" — buffer-first, sync-second pattern |
| Maps | Google Maps (see Section: Map & Localization Architecture) | Best combined coverage/routing/geocoding/Arabic support/React+iOS availability for Oman |
| Hosting (admin) | Hostinger static hosting | Explicit user requirement; React build is a static SPA, compatible |
| Mobile build/distribution | Codemagic | Explicit requirement; handles iOS signing/provisioning without local Xcode |
| i18n | i18next / react-i18next (web) + i18n-js (RN) sharing a common translation-key schema | Mature, supports RTL, namespaced JSON files, per-user persisted preference |

---

## G. Development Phases (implementation order)

1. **Architecture + database schema** — this document + full SQL migrations + RLS policies
2. **Authentication + roles** — Supabase Auth, custom claims for role/school_id, login screens (EN/AR)
3. **Admin dashboard shell** — navigation, layout, empty-state dashboard
4. **Bus / Driver / Student management** — CRUD + validation + bilingual fields
5. **Route builder** — map-based stop editor, drag-reorder, student assignment
6. **Driver iPad app shell** — auth, Today screen, navigation
7. **Pickup / drop-off flow** — daily_routes generation, event recording, completion check
8. **Live GPS tracking** — background location, sync queue, Realtime map on admin side
9. **Alerts + route deviation** — Edge Function deviation calc, absentee grace-period sweep, Alerts Center
10. **Reports** — attendance/route/driver/bus performance, CSV/PDF export (Arabic-safe)
11. **Offline synchronization hardening** — conflict handling, sync diagnostics, logging
12. **Testing + deployment** — automated tests for critical paths, Hostinger deploy docs, Codemagic pipeline, seed data, GPS simulator, manual QA checklist

Each phase ships runnable, reviewed code before the next begins, per your development method requirement.

---

## H. Risks and Limitations

- **iPadOS background GPS**: iOS restricts background location to preserve battery; sustained background tracking requires the `Always` authorization plus the `location` background mode, and iOS may still throttle updates if the app is suspended for a long time. We'll document realistic behavior (works well while app is foregrounded or in a locked-but-recently-active state; degrades over very long idle periods) rather than promise uninterrupted tracking.
- **Battery consumption**: Continuous GPS + network sync drains battery; the configurable interval (10–30s default) is a deliberate trade-off, and buses should be on iPad charging mounts as a hard operational requirement.
- **Internet loss**: Handled via local buffering, but a very long offline period (multi-hour) means degraded live-tracking visibility for admins during that window, even though data isn't lost.
- **GPS accuracy**: Urban/covered areas can reduce accuracy; geofence radius (default 100–200m) must stay generous enough to avoid false "arrived" negatives.
- **Apple permissions**: Requires correct `NSLocationWhenInUseUsageDescription` and `NSLocationAlwaysAndWhenInUseUsageDescription` strings, background mode capability in Xcode/Codemagic, and Apple App Review will scrutinize background-location apps — expect to justify the use case in review notes.
- **Map API costs**: Google Maps billing is usage-based (loads, geocoding calls, directions requests); at fleet scale this needs monitoring and caching (e.g., don't re-geocode unchanged stops, cache route polylines).
- **Realtime/database scaling**: `gps_locations` is high-write-volume; needs indexing/partitioning strategy and a retention policy (e.g., archive raw pings older than N days into a compressed history table) to keep the live table fast.
- **Multi-tenant RLS complexity**: Correct, well-tested RLS policies are critical since a bug here could leak one school's student data to another — this needs explicit test coverage before go-live.

---

## Map & Localization Architecture

### A. Google Maps vs Apple Maps — comparison for this project

| Criterion | Google Maps | Apple Maps |
|---|---|---|
| Oman coverage/road data | Strong, actively maintained, good address-level detail in Muscat/Seeb/Al Khoudh area | Improving but historically thinner outside major Western markets; less reliable address-level accuracy in Oman |
| Geocoding/reverse geocoding | Mature Geocoding API, good for stop-creation search-and-drop-pin flow | MapKit/Apple Maps Server API geocoding available but generally less precise outside Apple's stronger regions |
| Routing/road-based route lines | Directions API gives real road-following polylines and ETAs | MapKit directions available on iOS; web/server-side routing (MapKit JS) is more limited |
| ETA / traffic | Distance Matrix + traffic-aware ETAs | Available on-device via MapKit; less exposed for server-side calculation |
| Arabic/RTL support | Full language/region localization including Arabic labels and RTL-aware UI | Native Arabic support on iOS is good, but MapKit JS (web) localization is less flexible |
| Web (Admin portal) support | Maps JavaScript API — first-class, React-friendly | MapKit JS exists but is less commonly used in React ecosystems, fewer community libraries |
| iOS/iPad native support | Available via Google Maps SDK for iOS (React Native wrapper: `react-native-maps` w/ Google provider) | Native, zero extra dependency (MapKit is built into iOS) |
| React/React Native compatibility | Excellent — `@react-google-maps/api` (web), `react-native-maps` (mobile) | Web: limited RN wrapper support; iOS: native but less common in RN cross-platform code |
| API complexity/cost | Requires API key, usage-based billing across several API products; well-documented pricing | Apple Maps Server API also billed per-request past a free tier; MapKit itself (on-device iOS) is free |
| Long-term scalability | Proven at large fleet-tracking scale, broad tooling ecosystem | Fewer public examples of Apple Maps used for live fleet tracking at scale |

### B. Final recommendation

**Use Google Maps as the single primary mapping provider for both the Admin Web portal and the Driver iPad app.** It gives the best combined score on the criteria that matter most here — Oman road/address accuracy, road-based routing for the "planned route line," geocoding for stop creation, Arabic/RTL localization, and mature React + React Native library support — while keeping the project to **one map abstraction instead of two**, which materially reduces complexity per the stated preference. `react-native-maps` with the Google provider on iOS gives consistent behavior with the web app's `@react-google-maps/api` implementation, and both share the same `MapService` abstraction (see below), so switching to Apple MapKit later remains possible without a rewrite if a compelling reason emerges (e.g., cost at very large scale).

### C. Arabic/English (i18n) architecture

```
User selects language (🌐 EN | العربية) in profile/settings
   → preference persisted to users.preferred_language (Supabase)
      + cached locally (localStorage / AsyncStorage) for instant load
   → i18next (web) / i18n-js (RN) loads matching namespace JSON files
   → <html dir="rtl"|"ltr"> set on document root (web)
      / I18nManager.forceRTL() + app reload (React Native, per Expo requirement)
   → Tailwind uses logical properties (ms-/me- instead of ml-/mr-, etc.)
      so spacing auto-flips under RTL
   → Map localization explicitly set via Google Maps `language`/`region`
      params to match selected app language (not automatic)
```

LTR (English) and RTL (Arabic) are two configurations of the same components — never two separate builds — driven by the `dir` attribute + logical CSS + i18next's RTL-aware layout primitives.

### D. Translation file structure

```
/locales
  /en
    common.json      // shared: buttons, statuses, nav labels
    dashboard.json
    driver.json
    students.json
    routes.json
    alerts.json
    reports.json
  /ar
    common.json
    dashboard.json
    driver.json
    students.json
    routes.json
    alerts.json
    reports.json
```
All user-facing strings are referenced by key (e.g., `t('common.status.on_route')`) — never hard-coded in components. Both the web app and the Expo app import from the same `/packages/shared/locales` package so English/Arabic copy stays in sync across platforms.

### E. Bilingual database architecture

**Fields getting explicit `name_en` / `name_ar` columns** (school-specific, admin-entered content that isn't a fixed system label):
- `schools.name_en` / `name_ar`
- `routes.name_en` / `name_ar`
- `route_stops.name_en` / `name_ar` (and `daily_route_stops` inherits/can override)
- `students.name_en` / `name_ar` (student's own name, entered once)
- `buses.nickname_en` / `nickname_ar` (bus number/registration stay as neutral codes, no translation needed)

**Everything else uses translation files, not database columns** — because it's a fixed, finite set of system-generated labels, not user content: status labels (`on_route`, `delayed`, `picked_up`…), navigation labels, button text, alert message templates, report headers/column titles, and error messages. This keeps the schema lean and avoids re-translating the same "Picked Up" string per row.

---

**Awaiting your review/approval of this architecture before Phase 1 (schema + migrations) begins.**
