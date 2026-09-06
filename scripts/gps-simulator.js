#!/usr/bin/env node
/**
 * GPS simulator — a known limitation called out in the README ("No GPS
 * simulator built"). This is a dev/demo tool, not part of either app: it
 * moves a bus smoothly between a daily route's stops (or a straight line
 * through them if the route has no saved road_polyline, see migration
 * 0014) and inserts `gps_locations` rows at a configurable interval, the
 * same way the driver app's background location task would.
 *
 * It intentionally writes with the SUPABASE_SERVICE_ROLE_KEY (bypassing
 * RLS) rather than a driver's own session — this is meant to run from a
 * developer machine or CI, not from a real driver device.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/gps-simulator.js --daily-route-id <uuid> [options]
 *
 * Options:
 *   --daily-route-id <uuid>   Required. A daily_routes.id to drive (must
 *                             already exist — see generate_daily_route()).
 *   --interval-seconds <n>    Seconds between pings (default: system_settings
 *                             .gps_update_interval_seconds for the school, or 15).
 *   --speed-kmh <n>           Simulated travel speed (default: 30).
 *   --deviate-meters <n>      Nudge every ping sideways by up to this many
 *                             meters, to exercise route_deviation alerts
 *                             (default: 0, i.e. drive the planned line exactly).
 *   --loop                    Restart from the first stop after reaching the
 *                             last one, instead of exiting (default: off).
 *   --dry-run                 Print what would be inserted instead of writing.
 *
 * Example — drive a route normally:
 *   node scripts/gps-simulator.js --daily-route-id 3f2a...  --interval-seconds 5
 *
 * Example — deliberately trigger a deviation alert:
 *   node scripts/gps-simulator.js --daily-route-id 3f2a... --deviate-meters 250
 */

const { createClient } = require('@supabase/supabase-js');

function parseArgs(argv) {
  const args = { intervalSeconds: null, speedKmh: 30, deviateMeters: 0, loop: false, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--daily-route-id') args.dailyRouteId = argv[++i];
    else if (a === '--interval-seconds') args.intervalSeconds = Number(argv[++i]);
    else if (a === '--speed-kmh') args.speedKmh = Number(argv[++i]);
    else if (a === '--deviate-meters') args.deviateMeters = Number(argv[++i]);
    else if (a === '--loop') args.loop = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function interpolate(a, b, t) {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/** Offsets a point sideways (perpendicular to travel direction) by roughly `meters`. */
function jitterSideways(point, heading, meters) {
  if (!meters) return point;
  const bearing = heading + Math.PI / 2; // perpendicular
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((point.lat * Math.PI) / 180);
  return {
    lat: point.lat + ((meters * Math.sin(bearing)) / metersPerDegLat) * (Math.random() > 0.5 ? 1 : -1),
    lng: point.lng + ((meters * Math.cos(bearing)) / metersPerDegLng) * (Math.random() > 0.5 ? 1 : -1),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.dailyRouteId) {
    console.log(
      'Usage: node scripts/gps-simulator.js --daily-route-id <uuid> ' +
        '[--interval-seconds n] [--speed-kmh n] [--deviate-meters n] [--loop] [--dry-run]'
    );
    process.exit(args.help ? 0 : 1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment.');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  const { data: dailyRoute, error: drError } = await supabase
    .from('daily_routes')
    .select('id, school_id, bus_id, driver_id, route_id, status')
    .eq('id', args.dailyRouteId)
    .single();
  if (drError || !dailyRoute) {
    console.error('Could not find that daily_route:', drError?.message ?? 'not found');
    process.exit(1);
  }

  const { data: stopRows, error: stopError } = await supabase
    .from('daily_route_stops_with_coords')
    .select('sequence, is_skipped, latitude, longitude')
    .eq('daily_route_id', args.dailyRouteId)
    .order('sequence', { ascending: true });

  if (stopError) {
    console.error('Could not load stops:', stopError.message);
    process.exit(1);
  }

  const stops = (stopRows ?? []).filter((r) => !r.is_skipped).map((r) => ({ lat: r.latitude, lng: r.longitude }));

  if (stops.length < 2) {
    console.error('This daily route needs at least 2 non-skipped stops to simulate.');
    process.exit(1);
  }

  let intervalSeconds = args.intervalSeconds;
  if (!intervalSeconds) {
    const { data: settings } = await supabase
      .from('system_settings')
      .select('gps_update_interval_seconds')
      .eq('school_id', dailyRoute.school_id)
      .maybeSingle();
    intervalSeconds = settings?.gps_update_interval_seconds ?? 15;
  }

  const speedMetersPerSecond = (args.speedKmh * 1000) / 3600;

  console.log(
    `Simulating bus ${dailyRoute.bus_id} on daily_route ${dailyRoute.id} — ${stops.length} stops, ` +
      `${args.speedKmh} km/h, one ping every ${intervalSeconds}s${args.deviateMeters ? `, deviating up to ${args.deviateMeters}m` : ''}.` +
      (args.dryRun ? ' [dry run — nothing will be written]' : '')
  );

  do {
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i];
      const b = stops[i + 1];
      const legMeters = haversineMeters(a, b);
      const legSeconds = Math.max(intervalSeconds, legMeters / speedMetersPerSecond);
      const steps = Math.max(1, Math.round(legSeconds / intervalSeconds));
      const heading = Math.atan2(b.lng - a.lng, b.lat - a.lat);

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const point = jitterSideways(interpolate(a, b, t), heading, args.deviateMeters);
        const row = {
          daily_route_id: dailyRoute.id,
          bus_id: dailyRoute.bus_id,
          driver_id: dailyRoute.driver_id,
          location: `POINT(${point.lng} ${point.lat})`,
          speed_kmh: args.speedKmh,
          accuracy_meters: 8,
          recorded_at: new Date().toISOString(),
        };

        if (args.dryRun) {
          console.log(JSON.stringify(row));
        } else {
          const { error } = await supabase.from('gps_locations').insert(row);
          if (error) console.error('Insert failed:', error.message);
          else process.stdout.write('.');
        }

        await new Promise((r) => setTimeout(r, args.dryRun ? 0 : intervalSeconds * 1000));
      }
    }
    console.log('\nReached the last stop.');
  } while (args.loop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
