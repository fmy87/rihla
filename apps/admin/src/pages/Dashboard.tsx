import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import OverviewCard from '../components/OverviewCard';
import LiveMap from '../components/LiveMap';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchTodayOverview,
  fetchActiveDailyRoutes,
  fetchLatestBusPositions,
  type TodayOverview,
  type ActiveRouteRow,
  type LiveBusPosition,
} from '../lib/queries/dashboard';

const REFRESH_INTERVAL_MS = 20_000;

export default function DashboardPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { profile } = useAuth();

  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const [routes, setRoutes] = useState<ActiveRouteRow[]>([]);
  const [positions, setPositions] = useState<LiveBusPosition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.school_id) return;

    let cancelled = false;

    async function load() {
      const [overviewData, routeRows] = await Promise.all([
        fetchTodayOverview(profile!.school_id),
        fetchActiveDailyRoutes(profile!.school_id),
      ]);
      if (cancelled) return;
      setOverview(overviewData);
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
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">{t('dashboard:overview.title')}</h1>

      {loading || !overview ? (
        <div className="text-sm text-slate-400">{t('common:loading')}</div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <OverviewCard label={t('dashboard:overview.activeBuses')} value={overview.activeBuses} />
            <OverviewCard label={t('dashboard:overview.onRoute')} value={overview.onRoute} />
            <OverviewCard label={t('dashboard:overview.completed')} value={overview.completed} />
            <OverviewCard label={t('dashboard:overview.notStarted')} value={overview.notStarted} />
            <OverviewCard label={t('dashboard:overview.delayed')} value={overview.delayed} tone="warning" />
            <OverviewCard label={t('dashboard:overview.studentsTransported')} value={overview.studentsTransported} />
            <OverviewCard label={t('dashboard:overview.pendingPickup')} value={overview.pendingPickup} tone="warning" />
            <OverviewCard label={t('dashboard:overview.absentees')} value={overview.absentees} tone="critical" />
            <OverviewCard
              label={t('dashboard:overview.routeDeviations')}
              value={overview.routeDeviations}
              tone="critical"
            />
          </div>

          <h2 className="mb-3 text-lg font-semibold text-slate-900">{t('dashboard:liveMap')}</h2>
          <div className="mb-8">
            <LiveMap positions={positions} routes={routes} />
          </div>

          <h2 className="mb-3 text-lg font-semibold text-slate-900">{t('dashboard:activeRoutes.title')}</h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-start">{t('dashboard:activeRoutes.route')}</th>
                  <th className="px-4 py-3 text-start">{t('dashboard:activeRoutes.bus')}</th>
                  <th className="px-4 py-3 text-start">{t('dashboard:activeRoutes.driver')}</th>
                  <th className="px-4 py-3 text-start">{t('dashboard:activeRoutes.progress')}</th>
                  <th className="px-4 py-3 text-start">{t('dashboard:activeRoutes.status')}</th>
                  <th className="px-4 py-3 text-start">{t('dashboard:activeRoutes.nextStop')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      {t('dashboard:activeRoutes.empty')}
                    </td>
                  </tr>
                )}
                {routes.map((r) => (
                  <tr key={r.dailyRouteId}>
                    <td className="px-4 py-3 font-medium text-slate-800">{r.routeName}</td>
                    <td className="px-4 py-3 text-slate-600">{r.busNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{r.driverName}</td>
                    <td className="px-4 py-3 text-slate-600">{r.progressPercent}%</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {t(`dashboard:status.${r.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.nextStopName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
