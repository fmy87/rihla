import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchDailyOperations,
  fetchDailyRouteDetail,
  type DailyOperationRow,
  type DailyOperationStop,
} from '../lib/queries/dailyOperations';

const REFRESH_INTERVAL_MS = 20_000;

export default function DailyOperationsPage() {
  const { t } = useTranslation(['operations', 'dashboard', 'common']);
  const { profile } = useAuth();

  const [rows, setRows] = useState<DailyOperationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DailyOperationStop[]>([]);

  async function load() {
    if (!profile?.school_id) return;
    setRows(await fetchDailyOperations(profile.school_id));
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [profile?.school_id]);

  async function toggleExpand(row: DailyOperationRow) {
    if (expandedId === row.dailyRouteId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.dailyRouteId);
    setDetail(await fetchDailyRouteDetail(row.dailyRouteId));
  }

  return (
    <AppLayout>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">{t('operations:title')}</h1>

      {loading ? (
        <div className="text-sm text-slate-400">{t('common:loading')}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          {t('operations:empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.dailyRouteId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button onClick={() => toggleExpand(row)} className="flex w-full items-center justify-between px-5 py-4 text-start">
                <div>
                  <p className="font-semibold text-slate-900">
                    {row.busNumber} · {row.routeName}
                  </p>
                  <p className="text-sm text-slate-500">
                    {row.driverName}
                    {row.driverPhone && (
                      <>
                        {' '}
                        ·{' '}
                        <a href={`tel:${row.driverPhone}`} className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                          {row.driverPhone}
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-500">{row.progressPercent}%</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {t(`dashboard:status.${row.status}`)}
                  </span>
                  <span className="text-slate-400">{expandedId === row.dailyRouteId ? '▲' : '▼'}</span>
                </div>
              </button>

              {expandedId === row.dailyRouteId && (
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                  {detail.length === 0 ? (
                    <p className="text-sm text-slate-400">{t('operations:noStops')}</p>
                  ) : (
                    <ul className="space-y-3">
                      {detail.map((stop) => (
                        <li key={stop.id}>
                          <p className="text-sm font-medium text-slate-800">
                            {stop.sequence}. {stop.nameEn}{' '}
                            {stop.isSkipped && <span className="text-amber-600">{t('operations:skipped')}</span>}
                            {stop.arrivedAt && !stop.isSkipped && <span className="text-green-600"> ✓</span>}
                          </p>
                          <ul className="ms-4 mt-1 space-y-0.5">
                            {stop.students.map((s, i) => (
                              <li key={i} className="text-xs text-slate-500">
                                {s.name} — <span>{t(`operations:studentStatus.${s.status}`)}</span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link to="/attendance" className="mt-3 inline-block text-xs font-medium text-blue-600 hover:underline">
                    {t('operations:viewInAttendance')}
                  </Link>
                  <Link
                    to={`/daily-operations/${row.dailyRouteId}/replay`}
                    className="mt-3 ms-4 inline-block text-xs font-medium text-blue-600 hover:underline"
                  >
                    {t('operations:viewReplay')}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
