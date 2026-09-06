import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import {
  fetchTodayRoute,
  fetchTodayStops,
  startDailyRoute,
  type TodayRoute,
  type TodayStop,
} from '../lib/queries/todayRoute';
import { fetchGpsIntervalSeconds } from '../lib/queries/settings';
import { requestLocationPermissions, startTracking, stopTracking } from '../lib/location/gpsTracker';
import { flushQueue as flushGpsQueue, queueLength as gpsQueueLength } from '../lib/location/gpsQueue';
import { flushActionQueue, actionQueueLength } from '../lib/offline/actionQueue';
import { getCached, setCached } from '../lib/offline/cache';
import { useNetworkStatus } from '../lib/offline/useNetworkStatus';

const FOREGROUND_FLUSH_INTERVAL_MS = 15_000;

export interface SyncStatus {
  isOnline: boolean;
  pendingGpsCount: number;
  pendingActionCount: number;
  lastSyncedAt: string | null;
  usingCachedData: boolean;
}

interface TodayRouteContextValue {
  todayRoute: TodayRoute | null;
  stops: TodayStop[];
  loading: boolean;
  refresh: () => Promise<void>;
  startRoute: () => Promise<{ error: string | null; locationDenied?: boolean }>;
  syncStatus: SyncStatus;
  isTracking: boolean;
}

const TodayRouteContext = createContext<TodayRouteContextValue | undefined>(undefined);

export function TodayRouteProvider({ children }: { children: ReactNode }) {
  const { driver } = useAuth();
  const isConnected = useNetworkStatus();
  const [todayRoute, setTodayRoute] = useState<TodayRoute | null>(null);
  const [stops, setStops] = useState<TodayStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingGpsCount: 0,
    pendingActionCount: 0,
    lastSyncedAt: null,
    usingCachedData: false,
  });
  const flushInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live fetch with a cache fallback: if the network call fails (offline
  // cold start, e.g. app relaunched with no signal), fall back to the last
  // successfully cached route/stops rather than showing an empty screen —
  // this is what "the driver must still be able to view today's route
  // offline" actually requires, not just queuing writes.
  const refresh = useCallback(async () => {
    if (!driver?.id) {
      setTodayRoute(null);
      setStops([]);
      setLoading(false);
      return;
    }
    try {
      const route = await fetchTodayRoute(driver.id);
      const routeStops = route ? await fetchTodayStops(route.dailyRouteId) : [];
      setTodayRoute(route);
      setStops(routeStops);
      setUsingCachedData(false);
      await setCached(`today_route:${driver.id}`, route);
      if (route) await setCached(`today_stops:${route.dailyRouteId}`, routeStops);
    } catch {
      const cachedRoute = await getCached<TodayRoute | null>(`today_route:${driver.id}`);
      if (cachedRoute) {
        setTodayRoute(cachedRoute.value);
        setUsingCachedData(true);
        if (cachedRoute.value) {
          const cachedStops = await getCached<TodayStop[]>(`today_stops:${cachedRoute.value.dailyRouteId}`);
          setStops(cachedStops?.value ?? []);
        }
      }
    }
    setLoading(false);
  }, [driver?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const flushAll = useCallback(async () => {
    const [pendingGpsBefore, pendingActionsBefore] = await Promise.all([gpsQueueLength(), actionQueueLength()]);
    if (pendingGpsBefore === 0 && pendingActionsBefore === 0) {
      setSyncStatus((s) => ({ ...s, pendingGpsCount: 0, pendingActionCount: 0 }));
      return;
    }
    const [gpsResult, actionResult] = await Promise.all([flushGpsQueue(), flushActionQueue()]);
    const succeeded = gpsResult.succeeded && actionResult.remaining === 0;
    setSyncStatus({
      isOnline: succeeded,
      pendingGpsCount: gpsResult.remaining,
      pendingActionCount: actionResult.remaining,
      lastSyncedAt: succeeded ? new Date().toISOString() : null,
      usingCachedData,
    });
    if (actionResult.synced > 0) await refresh(); // pick up server-confirmed statuses
  }, [refresh, usingCachedData]);

  // Periodic sync flush while the route is on_route — the reliable path
  // (the GPS background task also flushes opportunistically on delivery).
  useEffect(() => {
    if (todayRoute?.status === 'on_route') {
      flushAll();
      flushInterval.current = setInterval(flushAll, FOREGROUND_FLUSH_INTERVAL_MS);
    }
    return () => {
      if (flushInterval.current) clearInterval(flushInterval.current);
    };
  }, [todayRoute?.status, flushAll]);

  // Flush immediately when the app returns to the foreground, or when
  // NetInfo reports connectivity returning — both are moments a stalled
  // sync is likely to succeed.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && todayRoute?.status === 'on_route') flushAll();
    });
    return () => sub.remove();
  }, [todayRoute?.status, flushAll]);

  useEffect(() => {
    if (isConnected && todayRoute?.status === 'on_route') flushAll();
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep native tracking in sync with route status — resumes automatically
  // if the app was closed and reopened mid-route.
  useEffect(() => {
    if (!todayRoute || !driver) return;
    if (todayRoute.status === 'on_route' && !isTracking) {
      (async () => {
        const interval = await fetchGpsIntervalSeconds(driver.school_id);
        await startTracking(
          { dailyRouteId: todayRoute.dailyRouteId, busId: todayRoute.busId, driverId: driver.id },
          interval
        );
        setIsTracking(true);
      })();
    }
    if (todayRoute.status !== 'on_route' && isTracking) {
      stopTracking();
      setIsTracking(false);
    }
  }, [todayRoute?.status, todayRoute?.dailyRouteId, driver?.id]);

  async function startRoute() {
    if (!todayRoute || !driver) return { error: 'no_route' };

    const permissions = await requestLocationPermissions();
    if (!permissions.foregroundGranted) {
      return { error: 'location_permission_denied', locationDenied: true };
    }
    // Background permission missing is a degraded-but-usable state (tracking
    // works while the app is open) — not a hard blocker to starting the route.

    const { error } = await startDailyRoute(todayRoute.dailyRouteId);
    if (error) return { error: error.message };
    await refresh();
    return { error: null, locationDenied: !permissions.backgroundGranted };
  }

  return (
    <TodayRouteContext.Provider
      value={{
        todayRoute,
        stops,
        loading,
        refresh,
        startRoute,
        syncStatus: { ...syncStatus, usingCachedData, isOnline: syncStatus.isOnline && isConnected },
        isTracking,
      }}
    >
      {children}
    </TodayRouteContext.Provider>
  );
}

export function useTodayRoute() {
  const ctx = useContext(TodayRouteContext);
  if (!ctx) throw new Error('useTodayRoute must be used within a TodayRouteProvider');
  return ctx;
}
