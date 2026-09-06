# Deployment

## GitHub repository setup

```
main                — always deployable; protected, requires PR review
develop             — integration branch for the next release
feature/<name>      — one branch per phase/feature, merged into develop via PR
hotfix/<name>       — branched from main for urgent production fixes
```

Suggested branch protection on `main`: require a passing CI run (lint +
`pnpm test` in both `apps/admin` and `apps/driver-ios`, plus the SQL tests
against a scratch Supabase branch if you wire that up) and at least one
review before merge. Tag releases (`v1.0.0`, etc.) off `main` so Codemagic
and Hostinger deploys can both reference a stable point.

Store secrets (Supabase service role key, Google Maps API keys, Codemagic
credentials) in GitHub Actions/Codemagic environment variables — never
commit `.env` files. `.env.example` files are the only env-related files
that belong in the repo.

## Environment configuration reference

| Variable | Where | Purpose |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | root `.env`, Edge Function config | Base Supabase project connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function secrets only — never in a client bundle | Used by `create-staff-account` and the alert trigger functions |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | `apps/admin/.env` | Admin web Supabase client |
| `VITE_MAP_API_KEY` | `apps/admin/.env` | Google Maps JS API key (Maps JavaScript API, Places API, Directions API enabled) |
| `VITE_PARENT_PORTAL_URL` | `apps/admin/.env` | Base URL of the deployed parent portal — used to build the "Invite parent" links shown on the Students page. Safe to leave unset until the parent portal has a real domain. |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | `apps/parent-portal/.env` | Parent portal Supabase client (separate `.env`/build from the admin app — see `apps/parent-portal/README.md`) |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `apps/driver-ios/.env` | Driver app Supabase client |
| `EXPO_PUBLIC_SCHOOL_ID` | `apps/driver-ios/.env` | Single-school deployments only (see Phase 6 note) |
| `apps/driver-ios/app.json` → `expo.ios.config.googleMapsApiKey` | app.json, not `.env` (Expo config, not a runtime secret in the JS sense) | iOS-restricted Google Maps SDK key for `react-native-maps` |

Restrict each Google Maps key to the product/domain/bundle ID it's actually
used from in the Google Cloud Console — the web key to your Hostinger
domain, the iOS key to the app's bundle identifier.

## Hostinger — Admin Web

The admin app is a static Vite build; Hostinger's shared/business hosting
(Apache/LiteSpeed, no Node runtime needed) is sufficient.

1. Build locally or in CI:
   ```bash
   cd apps/admin
   pnpm install
   pnpm build          # outputs apps/admin/dist
   ```
2. In Hostinger's hPanel, go to **File Manager** (or connect via FTP/SFTP —
   credentials under **Hosting → Advanced → FTP Accounts**).
3. Upload the **contents** of `apps/admin/dist` (not the folder itself) into
   `public_html/` (or a subfolder if the admin portal lives at a path like
   `admin.yourschool.com`).
4. Because this is a client-side-routed SPA (`react-router-dom`), add a
   fallback so deep links like `/routes/<id>` don't 404 on refresh. Create
   `public_html/.htaccess`:
   ```apache
   <IfModule mod_rewrite.c>
     RewriteEngine On
     RewriteBase /
     RewriteRule ^index\.html$ - [L]
     RewriteCond %{REQUEST_FILENAME} !-f
     RewriteCond %{REQUEST_FILENAME} !-d
     RewriteRule . /index.html [L]
   </IfModule>
   ```
5. Point your domain/subdomain at this hosting account (hPanel → **Domains**),
   and enable free SSL (hPanel → **SSL**) — required for Supabase Auth and
   geolocation-adjacent browser APIs to behave correctly over HTTPS.
6. Environment variables (`VITE_SUPABASE_URL` etc.) are baked in at **build
   time** by Vite, not read at runtime — set them in whatever CI job runs
   `pnpm build` (or in a local `.env` if building manually), not on Hostinger
   itself.

**Redeploying**: repeat steps 1–3. For zero-downtime-ish updates, upload to
a fresh `dist-YYYYMMDD/` folder and re-point a symlink, or just accept the
brief overwrite window for a school-internal admin tool — traffic here is
low enough that a few seconds of inconsistency during upload is rarely
noticeable.

## Codemagic — Driver iOS App

1. Push `apps/driver-ios` (as part of this monorepo) to GitHub, then in
   Codemagic: **Add application** → connect the repository → select **Expo**
   as the project type (or configure a custom `codemagic.yaml` — see below
   for a starting point).
2. **Signing**: Codemagic can manage iOS signing automatically if you connect
   your Apple Developer account (Codemagic → **Team integrations → Apple
   Developer Portal**), or you can upload a distribution certificate +
   provisioning profile manually under **Code signing identities**. For a
   background-location app, make sure the provisioning profile's App ID has
   the **Background Modes** capability (Location updates) enabled in the
   Apple Developer portal first.
3. **Environment variables**: add `EXPO_PUBLIC_SUPABASE_URL`,
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_MAP_API_KEY`,
   `EXPO_PUBLIC_SCHOOL_ID` as encrypted variables in the Codemagic workflow —
   Expo inlines `EXPO_PUBLIC_*` vars into the JS bundle at build time.
4. A real `codemagic.yaml` lives at the repo root with three workflows:
   `driver-ios-dev` (push to `develop`/`feature/*`, local `.ipa`, no
   publishing), `driver-ios-production` (triggered by `driver-v*` tags,
   submits straight to TestFlight via an App Store Connect API key), and
   `admin-web` (type-check + test + build the Vite app, with an optional
   SFTP upload step to Hostinger gated on `HOSTINGER_SFTP_*` vars being
   set). Create the three environment variable groups it references
   (`driver_ios_secrets`, `eas_credentials`, `app_store_connect`,
   `admin_web_secrets`) under Codemagic → Team settings before the first
   run — an unset group just means that workflow's step is skipped or
   fails fast with a clear message, not a silent partial deploy.
5. **Test on iPad**: install the built `.ipa` via TestFlight (recommended —
   handles provisioning automatically for testers) or Codemagic's direct
   install link for ad-hoc builds during early development.
6. **App Store deployment**: once stable, switch the build profile to
   `production`, add an `app_store_connect` publishing block to
   `codemagic.yaml` with your App Store Connect API key, and submit through
   TestFlight → App Store review. Budget real review time for a
   background-location app — include clear reviewer notes explaining the
   school-transportation use case (see Phase 1's "Risks and Limitations").

## Supabase (backend)

Already covered in `docs/local-development.md` for local setup. For a
hosted environment: create a Supabase project per deployment tier (e.g.
`school-bus-staging`, `school-bus-production`), run `supabase db push`
against each from CI on merge to the corresponding branch, and keep the
`create-staff-account` and `accept-guardian-invite` Edge Functions'
`SUPABASE_SERVICE_ROLE_KEY` secret scoped per-project (never shared between
staging and production).

`accept-guardian-invite` must be deployed with `--no-verify-jwt`
(`supabase functions deploy accept-guardian-invite --no-verify-jwt`) since a
parent has no session yet when they open an invite link — the function does
its own token/expiry validation instead of relying on Supabase's default
JWT check. `create-staff-account` deploys normally (`supabase functions
deploy create-staff-account`), since it requires a valid admin session.
