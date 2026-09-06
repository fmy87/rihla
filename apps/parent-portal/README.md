# Rihla — Parent Portal

A minimal, bilingual (EN/AR) web app for parents/guardians: today's
pickup/drop-off status, bus number, driver contact, and a "last seen"
timestamp for each of their children, for schools that choose to offer it.
Guardians get their own accounts via a self-serve invite link an admin
generates from the Students page — no manual account setup required.

## What this is (and isn't)

This is a v1 companion to the admin portal and driver app, not a third
equal-weight product yet:

- **Read-only.** No writes beyond signing in and accepting an invite — a
  parent can't edit anything.
- **Bilingual (EN/AR).** `src/locales/` + `src/i18n.ts`, with a language
  switcher and RTL layout for Arabic, matching the admin/driver apps.
- **Self-serve account linking.** An admin generates a one-time invite link
  per student from the admin Students page ("Invite parent →"); the parent
  opens it, sets an email/password (or, if they already have a portal
  account from an earlier child, enters that account's password instead),
  and is linked automatically. See "Guardian invites" below.
- **No live map.** Shows a bus number, driver, and "last seen X ago" instead
  of a live-updating map pin — enough to answer "is the bus close" without
  building a second full map component. A map view is a natural next step
  if this gets real usage.
- **Polling, not push.** Refreshes every 20 seconds while the tab is open;
  there's no push notification when a child is picked up/dropped off.
- **Password reset** works via a standard "Forgot password?" link on the
  login screen (`supabase.auth.resetPasswordForEmail`) and a
  `/reset-password` page that handles the email link and lets the parent
  set a new password. The confirmation message is the same whether or not
  the email actually has an account, to avoid leaking account existence to
  an unauthenticated caller.

## Guardian invites

Admin side: Students page → "Invite parent →" on a student's row generates
a `guardian_invites` row (7-day expiry, single use) and shows a shareable
link (`<VITE_PARENT_PORTAL_URL>/invite/<token>`).

Parent side: opening the link calls the `accept-guardian-invite` Edge
Function to verify the token, then submits full name + email + password.
The function either creates a brand-new parent account, or — if that email
already has a parent account at the same school and the password matches
it — links the new child to the *existing* account instead of creating a
duplicate. Either way, `students.guardian_user_id` gets set and the invite
is marked used. That existing-account password check is rate-limited —
5 wrong attempts on a given invite and the Edge Function refuses further
tries on it (`too_many_attempts`); the family isn't locked out, a fresh
invite link from the admin still works.

See `supabase/functions/accept-guardian-invite/index.ts` for the full
server-side logic, `supabase/migrations/0018_guardian_invites.sql` for
the schema/RLS (the table itself grants no anon/parent access at all —
every read and write of an invite goes through that Edge Function with the
service role, the same pattern `create-staff-account` uses), and
`supabase/migrations/0019_guardian_invite_rate_limit.sql` for the attempt
counter.

## Security model

RLS does essentially all the work — see
`supabase/migrations/0017_parent_portal.sql`. A parent's Supabase session
can only ever read: their own linked children's `students` rows, those
children's `daily_student_assignments` (any date — a parent has legitimate
reason to see history, unlike a driver), the `daily_routes`/
`daily_route_stops` those assignments belong to, the `drivers` row currently
driving one of their children, and `gps_locations` for **today only**. The
app itself does no additional filtering — it doesn't need to, and shouldn't
rely on the client to enforce this.

## Running locally

```bash
cd apps/parent-portal
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

To test the invite flow end to end locally, also deploy
`accept-guardian-invite` to your dev Supabase project (see
`docs/deployment.md`) and set `VITE_PARENT_PORTAL_URL` in
`apps/admin/.env` to `http://localhost:5174` (this app's dev port).

## Deploying

Same shape as the admin app (see `docs/deployment.md`) — it's a static Vite
build, so `npm run build` then upload `dist/` to any static host. Give it
its own subdomain (e.g. `parent.yourschool.com`) rather than a path under
the admin portal's domain, since they're separate apps with separate
`.env` build-time config. Update `VITE_PARENT_PORTAL_URL` in the admin
app's `.env` to match once it's live, so invite links point to the right
place.

Password reset needs one more step Supabase requires for any redirect-link
flow: add `<your-deployed-url>/reset-password` (and `http://localhost:5174/
reset-password` for local dev) to the project's Auth → URL Configuration →
Redirect URLs allow-list. Without that, `resetPasswordForEmail`'s
`redirectTo` is silently ignored and the email link falls back to
Supabase's default redirect, which isn't this app.
