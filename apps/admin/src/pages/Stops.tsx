import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { fetchAllStopsForSchool, type AllStopsRow } from '../lib/queries/routes';
import { inputClass } from '../lib/formStyles';

export default function StopsPage() {
  const { t, i18n } = useTranslation(['routes', 'common']);
  const { profile } = useAuth();

  const [stops, setStops] = useState<AllStopsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [routeFilter, setRouteFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile?.school_id) return;
    fetchAllStopsForSchool(profile.school_id).then((data) => {
      setStops(data);
      setLoading(false);
    });
  }, [profile?.school_id]);

  const routeNames = Array.from(new Set(stops.map((s) => s.route_name_en))).sort();

  const filtered = stops.filter((s) => {
    if (routeFilter && s.route_name_en !== routeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = i18n.language === 'ar' && s.name_ar ? s.name_ar : s.name_en;
      if (!name.toLowerCase().includes(q) && !s.address?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <AppLayout>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">{t('common:nav.stops')}</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">{t('routes:manageHint')}</p>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('routes:stopName')}
          className={`${inputClass} max-w-xs`}
        />
        <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} className={`${inputClass} max-w-xs`}>
          <option value="">{t('routes:allRoutes')}</option>
          {routeNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">{t('common:common.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          {t('routes:overviewEmpty')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-start">{t('routes:route')}</th>
                  <th className="px-4 py-3 text-start">#</th>
                  <th className="px-4 py-3 text-start">{t('routes:stopName')}</th>
                  <th className="px-4 py-3 text-start">{t('routes:stopType')}</th>
                  <th className="px-4 py-3 text-start">{t('routes:address')}</th>
                  <th className="px-4 py-3 text-start">{t('routes:eta')}</th>
                  <th className="px-4 py-3 text-start"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((stop) => (
                  <tr key={stop.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {i18n.language === 'ar' && stop.route_name_ar ? stop.route_name_ar : stop.route_name_en}
                      {stop.bus_number && <span className="ms-1 text-xs text-slate-400">· {stop.bus_number}</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{stop.sequence}</td>
                    <td className="px-4 py-3 text-slate-800">
                      {i18n.language === 'ar' && stop.name_ar ? stop.name_ar : stop.name_en}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t(`routes:${stop.stop_type}`)}</td>
                    <td className="px-4 py-3 text-slate-500">{stop.address ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{stop.estimated_arrival_time ?? '—'}</td>
                    <td className="px-4 py-3 text-end">
                      <Link to={`/routes/${stop.route_id}`} className="text-xs font-medium text-blue-600 hover:underline">
                        {t('routes:openEditor')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
