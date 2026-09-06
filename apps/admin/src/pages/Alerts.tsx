import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { fetchAlerts, resolveAlert, type AlertRow } from '../lib/queries/alerts';
import { primaryButtonClass } from '../lib/formStyles';

const SEVERITY_ICON: Record<string, string> = { critical: '🔴', warning: '🟠', info: '🟡' };
const SEVERITY_TONE: Record<string, string> = {
  critical: 'border-status-critical/30 bg-status-critical/5',
  warning: 'border-status-warning/30 bg-status-warning/5',
  info: 'border-slate-200 bg-slate-50',
};

export default function AlertsPage() {
  const { t } = useTranslation('common');
  const { profile } = useAuth();

  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeResolved, setIncludeResolved] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('');

  async function load() {
    if (!profile?.school_id) return;
    setAlerts(await fetchAlerts(profile.school_id, includeResolved));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [profile?.school_id, includeResolved]);

  // Realtime: new alerts (deviation, offline, not-confirmed, skipped) land
  // here the moment the server-side triggers/periodic check insert them.
  useEffect(() => {
    if (!profile?.school_id) return;
    const channel = supabase
      .channel('alerts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts', filter: `school_id=eq.${profile.school_id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.school_id]);

  async function handleResolve(alert: AlertRow) {
    if (!profile) return;
    await resolveAlert(alert.id, profile.id);
    load();
  }

  const filtered = severityFilter ? alerts.filter((a) => a.severity === severityFilter) : alerts;

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Alerts</h1>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={includeResolved} onChange={(e) => setIncludeResolved(e.target.checked)} />
          Show resolved
        </label>
      </div>

      <div className="mb-4 flex gap-2">
        {['', 'critical', 'warning', 'info'].map((sev) => (
          <button
            key={sev || 'all'}
            onClick={() => setSeverityFilter(sev)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              severityFilter === sev ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {sev ? `${SEVERITY_ICON[sev]} ${sev}` : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">{t('loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          No alerts. Everything looks normal.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div key={alert.id} className={`rounded-2xl border p-4 ${SEVERITY_TONE[alert.severity]} ${alert.isResolved ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-900">
                    {SEVERITY_ICON[alert.severity]} {alert.messageEn}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[alert.busNumber, alert.routeName, alert.studentName].filter(Boolean).join(' · ')}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(alert.createdAt).toLocaleString()}</p>
                </div>
                {!alert.isResolved && (
                  <button onClick={() => handleResolve(alert)} className={primaryButtonClass}>
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
