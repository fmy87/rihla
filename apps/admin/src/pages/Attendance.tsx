import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { fetchTodayAttendance, type AttendanceRow } from '../lib/queries/attendance';
import { inputClass } from '../lib/formStyles';

const STATUS_OPTIONS = ['pending', 'picked_up', 'dropped_off', 'absent', 'cancelled', 'not_confirmed', 'exception'];

const STATUS_TONE: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-600',
  picked_up: 'bg-status-normal/10 text-status-normal',
  dropped_off: 'bg-status-normal/10 text-status-normal',
  absent: 'bg-status-critical/10 text-status-critical',
  cancelled: 'bg-slate-100 text-slate-500',
  not_confirmed: 'bg-status-critical/10 text-status-critical',
  exception: 'bg-status-warning/10 text-status-warning',
};

export default function AttendancePage() {
  const { t } = useTranslation(['attendance', 'common']);
  const { profile } = useAuth();

  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!profile?.school_id) return;
    fetchTodayAttendance(profile.school_id).then((data) => {
      setRows(data);
      setLoading(false);
    });
  }, [profile?.school_id]);

  const routeOptions = Array.from(new Set(rows.map((r) => r.routeName))).sort();

  const filtered = rows.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (routeFilter && r.routeName !== routeFilter) return false;
    if (search && !r.studentName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const notConfirmedCount = rows.filter((r) => r.status === 'not_confirmed' || r.status === 'pending').length;

  return (
    <AppLayout>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">{t('attendance:title')}</h1>
      <p className="mb-6 text-sm text-slate-500">{t('attendance:pendingSummary', { count: notConfirmedCount })}</p>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          placeholder={t('attendance:searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${inputClass} max-w-xs`}
        />
        <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value)} className={`${inputClass} max-w-xs`}>
          <option value="">{t('attendance:allRoutes')}</option>
          {routeOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputClass} max-w-xs`}>
          <option value="">{t('attendance:allStatuses')}</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {t(`attendance:status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">{t('common:loading')}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">{t('attendance:table.student')}</th>
                <th className="px-4 py-3 text-start">{t('attendance:table.route')}</th>
                <th className="px-4 py-3 text-start">{t('attendance:table.stop')}</th>
                <th className="px-4 py-3 text-start">{t('attendance:table.scheduled')}</th>
                <th className="px-4 py-3 text-start">{t('attendance:table.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    {t('attendance:empty')}
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.assignmentId}>
                  <td className="px-4 py-3 font-medium text-slate-800">{row.studentName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.routeName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.stopName}</td>
                  <td className="px-4 py-3 text-slate-600">{row.scheduledTime ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_TONE[row.status] ?? ''}`}>
                      {t(`attendance:status.${row.status}`)}
                    </span>
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
