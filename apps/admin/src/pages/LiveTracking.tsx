import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import LiveMap from '../components/LiveMap';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchActiveDailyRoutes,
  fetchLatestBusPositions,
  type ActiveRouteRow,
  type LiveBusPosition,
} from '../lib/queries/dashboard';

const REFRESH_INTERVAL_MS = 15_000;

export default function LiveTrackingPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { profile } = useAuth();

  const [routes, setRoutes] = useState<ActiveRouteRow[]>([]);
  const [positions, setPositions] = useState<LiveBusPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.school_id) return;
    let cancelled = false;

    async function load() {
      const routeRows = await fetchActiveDailyRoutes(profile!.school_id);
      if (cancelled) return;
      setRoutes(routeRows);
      const positionRows = await fetchLatestBusPositions(routeRows.map((r) => r.dailyRouteId));
      if (cancelled) return;
      setPositions(positionRows);
      setLoading(false);
    }

    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [profile?.school_id]);

  return (
    <AppLayout>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">{t('common:nav.liveTracking')}</h1>

      {loading ? (
        <div className="text-sm text-slate-400">{t('common:loading')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <LiveMap positions={positions} routes={routes} />

          <div className="space-y-3">
            {routes.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
                {t('dashboard:activeRoutes.empty')}
              </div>
            )}
            {routes.map((r) => {
              const hasPosition = positions.some((p) => p.busId === r.busId);
              return (
                <div key={r.dailyRouteId} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{r.busNumber}</p>
                    <span
                      className={`h-2 w-2 rounded-full ${hasPosition ? 'bg-status-normal' : 'bg-slate-300'}`}
                      title={hasPosition ? 'Receiving GPS' : 'No GPS yet'}
                    />
                  </div>
                  <p className="text-sm text-slate-500">{r.driverName}</p>
                  <p className="text-sm text-slate-500">{r.routeName}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {t(`dashboard:status.${r.status}`)} · {r.progressPercent}%
                  </p>
                  {r.nextStopName && (
                    <p className="text-xs text-slate-400">Next: {r.nextStopName}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
