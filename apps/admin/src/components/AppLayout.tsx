import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-8 py-3">
          <span className="text-sm text-slate-500">
            {profile?.full_name} · {t(`roles.${profile?.role}`)}
          </span>
          <button
            onClick={() => signOut()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {t('nav.signOut')}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
