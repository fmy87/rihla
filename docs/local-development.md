# Local Development

## 1. Prerequisites
- Node.js 20+, pnpm (or npm)
- Supabase CLI (`brew install supabase/tap/supabase` or npm equivalent)
- A free Supabase project (supabase.com) — Postgres + PostGIS is enabled by the migrations

## 2. Clone & install
```bash
git clone <this-repo>
cd school-bus-system
pnpm install
```

## 3. Configure environment
```bash
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_ANON_KEY (from your Supabase project settings),
# and SUPABASE_SERVICE_ROLE_KEY (server-side / Edge Function use only)
```

## 4. Run migrations
```bash
supabase link --project-ref <your-project-ref>
supabase db push   # applies everything in supabase/migrations in order
```

## 5. Create the demo auth users, then seed data
Demo accounts must exist in Supabase Auth before `users`/`drivers` rows can be linked:

1. In the Supabase dashboard → Authentication → Users, create:
   - `admin@example-school.demo` (super_admin)
   - `driver1@example-school.demo`, `driver2@example-school.demo`, `driver3@example-school.demo`
2. Insert matching rows into `public.users` with the returned `auth.users.id` and correct `role`/`school_id`.
3. Update `drivers.user_id` for each driver to link their login identity.
4. Run the seed script:
   ```bash
   psql "$DATABASE_URL" -f supabase/seed/seed.sql
   ```

A full `seed-accounts.sql` helper script that automates steps 2–3 given a list of UUIDs will be added in Phase 12 (seed data hardening).

## 6. Start the admin portal
```bash
cd apps/admin
pnpm dev
```

## 7. Run the driver iOS app
```bash
cd apps/driver-ios
npx expo start
# scan the QR code with Expo Go for quick iteration, or:
eas build --platform ios --profile development   # for a real background-location build
```
Background GPS behavior cannot be fully tested in Expo Go — use a development build once Phase 8 begins.

`react-native-maps` (used by the Route screen, Phase 6) needs its own iOS
Google Maps API key set in `apps/driver-ios/app.json` under
`expo.ios.config.googleMapsApiKey` — this is separate from the admin app's
`VITE_MAP_API_KEY` and should be restricted to this app's iOS bundle ID in
the Google Cloud Console.

Background location (Phase 8) requires a development or production build —
Expo Go does not support the `expo-task-manager` background task reliably.
Build with `eas build --platform ios --profile development` and install
that build on a test iPad to verify tracking continues when the screen is
locked.


## 8. Deploy the account-creation Edge Function (needed for Buses/Drivers/Users screens)
Creating a driver or admin login requires the service role key, which never
ships to the browser — it runs server-side in a Supabase Edge Function:
```bash
supabase functions deploy create-staff-account
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```
The function re-validates the caller's own admin session before doing
anything, so it's safe to leave `verify_jwt` at its default (enabled).

## 9. Periodic alert checks (bus offline, pickup/dropoff not confirmed)
Migration `0013_alerts_and_deviation.sql` defines `run_periodic_alert_checks()`
and tries to schedule it via `pg_cron` automatically. If your Supabase
project doesn't have `pg_cron` enabled (check Database → Extensions in the
dashboard), either enable it there and re-run the migration, or call the
function on a schedule yourself — e.g. a tiny Edge Function that runs
`select run_periodic_alert_checks();` via the service role, triggered by an
external cron (GitHub Actions, Vercel Cron, etc.) once a minute.

## 10. GPS Simulator (Phase 5 onward)
A demo-mode GPS simulator (moves a bus along its planned route, triggers geofence
"arrived" events, can simulate deviation and offline mode) will ship as part of
`apps/admin`'s Daily Operations screen, gated behind `APP_ENV=development`.
