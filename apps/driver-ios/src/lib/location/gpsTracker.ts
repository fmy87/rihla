import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { enqueuePoint, flushQueue } from './gpsQueue';

export const LOCATION_TASK_NAME = 'school-bus-background-location';

interface TrackingContext {
  dailyRouteId: string;
  busId: string;
  driverId: string;
}

// Module-level state: TaskManager tasks run in a separate JS context that can
// be re-invoked after the app is backgrounded/relaunched, so this can't live
// in React state. defineTask MUST be called at module scope (not inside a
// component) — see App.tsx, which imports this module for its side effect
// before anything else renders.
let currentContext: TrackingContext | null = null;

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  if (!currentContext) return; // no active route — drop the sample rather than mis-attribute it

  for (const loc of locations) {
    await enqueuePoint({
      daily_route_id: currentContext.dailyRouteId,
      bus_id: currentContext.busId,
      driver_id: currentContext.driverId,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      speed_kmh: loc.coords.speed != null && loc.coords.speed >= 0 ? Math.round(loc.coords.speed * 3.6 * 10) / 10 : null,
      accuracy_meters: loc.coords.accuracy ?? null,
      recorded_at: new Date(loc.timestamp).toISOString(),
    });
  }
  // Background delivery is itself opportunistic — attempt a sync now, but the
  // foreground periodic flush (see TodayRouteContext) is the reliable path.
  await flushQueue();
});

export interface PermissionResult {
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}

export async function requestLocationPermissions(): Promise<PermissionResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') {
    return { foregroundGranted: false, backgroundGranted: false };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { foregroundGranted: true, backgroundGranted: bg.status === 'granted' };
}

/**
 * Starts background location updates. `intervalSeconds` should come from
 * system_settings.gps_update_interval_seconds (school-configurable, default
 * 15s) — see docs/local-development or the admin Settings screen (Phase 12)
 * for where that's surfaced.
 *
 * Honest limitation: iOS may throttle or pause delivery if the app has been
 * backgrounded for a long time with little movement, per Apple's background
 * location budget — this is a platform constraint, not a bug in this code.
 * See the Phase 1 architecture doc's "Risks and Limitations" section.
 */
export async function startTracking(context: TrackingContext, intervalSeconds: number) {
  currentContext = context;

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: intervalSeconds * 1000,
    distanceInterval: 15, // meters — avoid flooding updates while stationary
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Rihla — tracking active',
      notificationBody: 'Sharing your route location with dispatch.',
    },
  });
}

export async function stopTracking() {
  currentContext = null;
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  }
}

export function isTrackingContextActive() {
  return currentContext !== null;
}
