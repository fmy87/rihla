# Dev scripts

Not part of either shipped app — developer/demo tooling only.

## gps-simulator.js

Drives a bus along a `daily_routes` instance's stops and writes real
`gps_locations` rows, so you can see live tracking, geofence-based
pickup/drop-off, and route deviation alerts working end-to-end without a
physical iPad running the driver app.

```bash
cd scripts
npm install
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
node gps-simulator.js --daily-route-id <uuid> --interval-seconds 5
```

Get a `daily_route_id` by generating today's route from the Route Editor
(the "Generate Today's Route" button, Phase 5) and reading the id back from
the `daily_routes` table, or from the Daily Operations screen's network
requests.

Pass `--deviate-meters 250` to deliberately drift off the planned line and
confirm a `route_deviation` alert fires in the Alerts Center. Pass `--dry-run`
to print what would be inserted without touching the database.

Uses the service role key, so it bypasses RLS entirely — treat it like any
other server-side credential (never commit it, never run this against a
production project's data you care about without knowing what you're
seeding).
