import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 md:justify-end md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label={t('nav.openMenu')}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-slate-900">{t('appName')}</span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {profile?.full_name} · {t(`roles.${profile?.role}`)}
            </span>
            <button
              onClick={() => signOut()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {t('nav.signOut')}
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
