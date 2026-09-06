import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

const NAV_ITEMS: Array<{ to: string; key: string; superAdminOnly?: boolean }> = [
  { to: '/dashboard', key: 'dashboard' },
  { to: '/live-tracking', key: 'liveTracking' },
  { to: '/routes', key: 'routes' },
  { to: '/buses', key: 'buses' },
  { to: '/drivers', key: 'drivers' },
  { to: '/students', key: 'students' },
  { to: '/stops', key: 'stops' },
  { to: '/daily-operations', key: 'dailyOperations' },
  { to: '/attendance', key: 'attendance' },
  { to: '/alerts', key: 'alerts' },
  { to: '/reports', key: 'reports' },
  { to: '/users', key: 'users', superAdminOnly: true },
  { to: '/settings', key: 'settings', superAdminOnly: true },
];

export default function Sidebar() {
  const { t } = useTranslation('common');
  const { profile } = useAuth();
  const [unresolvedAlertCount, setUnresolvedAlertCount] = useState(0);

  async function loadAlertCount() {
    if (!profile?.school_id) return;
    const { count } = await supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('school_id', profile.school_id)
      .eq('is_resolved', false);
    setUnresolvedAlertCount(count ?? 0);
  }

  useEffect(() => {
    loadAlertCount();
    if (!profile?.school_id) return;
    const channel = supabase
      .channel('sidebar-alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts', filter: `school_id=eq.${profile.school_id}` },
        () => loadAlertCount()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.school_id]);

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col border-e border-slate-200 bg-white py-6">
      <div className="mb-6 px-5 text-lg font-semibold text-slate-900">{t('appName')}</div>
      <ul className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.filter((item) => !item.superAdminOnly || profile?.role === 'super_admin').map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <span>{t(`nav.${item.key}`)}</span>
              {item.key === 'alerts' && unresolvedAlertCount > 0 && (
                <span className="rounded-full bg-status-critical px-1.5 py-0.5 text-xs font-semibold text-white">
                  {unresolvedAlertCount}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
