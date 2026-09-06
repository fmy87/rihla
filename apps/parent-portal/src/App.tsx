import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { fetchChildrenToday, type ChildToday } from './lib/queries';
import { compactDurationLabel, secondsSince } from './lib/timeAgo';
import LanguageSwitcher from './components/LanguageSwitcher';
import InviteAcceptPage from './pages/InviteAccept';
import ResetPasswordPage from './pages/ResetPassword';
import './i18n';

function timeAgo(iso: string | null, t: (key: string, opts?: Record<string, unknown>) => string) {
  const seconds = secondsSince(iso);
  if (seconds === null) return null;
  return t('dashboard.lastSeen', { time: compactDurationLabel(seconds) });
}

function LoginForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) {
      setError(t('login.forgotPasswordNeedsEmail'));
      return;
    }
    setResetting(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    // Deliberately the same message whether or not the email is actually
    // registered — confirming/denying an account's existence to an
    // unauthenticated caller is its own small information leak.
    if (!resetError) setResetSent(true);
  }

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand" style={{ marginBottom: 0 }}>
          {t('appName')} — {t('portalTitle')}
        </div>
        <LanguageSwitcher />
      </div>
      <form className="card" onSubmit={handleSubmit}>
        <label className="muted" htmlFor="email">
          {t('login.emailLabel')}
        </label>
        <input
          id="email"
          type="email"
          className="field"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setResetSent(false);
          }}
          required
        />
        <label className="muted" htmlFor="password">
          {t('login.passwordLabel')}
        </label>
        <input
          id="password"
          type="password"
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button className="button" type="submit" disabled={loading}>
          {loading ? t('login.submitting') : t('login.submit')}
        </button>
        <p style={{ marginTop: 10, marginBottom: 0 }}>
          {resetSent ? (
            <span className="muted">{t('login.forgotPasswordSent')}</span>
          ) : (
            <button type="button" className="link-button" onClick={handleForgotPassword} disabled={resetting}>
              {resetting ? t('login.forgotPasswordSending') : t('login.forgotPassword')}
            </button>
          )}
        </p>
      </form>
      <p className="muted">{t('login.helpText')}</p>
    </div>
  );
}

function ChildCard({ child }: { child: ChildToday }) {
  const { t } = useTranslation();
  const hasScheduleToday = child.status !== null;
  const statusTone: Record<string, string> = {
    pending: 'badge',
    picked_up: 'badge badge-good',
    dropped_off: 'badge badge-good',
    absent: 'badge badge-bad',
    cancelled: 'badge',
    not_confirmed: 'badge badge-warn',
    exception: 'badge badge-warn',
  };

  return (
    <div className="card">
      <div className="row">
        <span className="student-name">{child.studentName}</span>
        {child.status && (
          <span className={statusTone[child.status] ?? 'badge'}>{t(`status.${child.status}`)}</span>
        )}
      </div>
      {(child.grade || child.className) && <p className="muted">{[child.grade, child.className].filter(Boolean).join(' · ')}</p>}

      {!hasScheduleToday ? (
        <p className="muted">{t('dashboard.noScheduleToday')}</p>
      ) : (
        <>
          <p className="muted">
            {t('dashboard.busLine', { busNumber: child.busNumber ?? '—', driverName: child.driverName ?? t('dashboard.driverNotAssigned') })}
            {child.driverPhone && (
              <>
                {' · '}
                <a href={`tel:${child.driverPhone}`} style={{ color: '#2563eb' }}>
                  {child.driverPhone}
                </a>
              </>
            )}
          </p>
          {child.stopName && (
            <p className="muted">
              {t('dashboard.stopLine', { stopName: child.stopName })}
              {child.scheduledTime && t('dashboard.scheduledSuffix', { time: child.scheduledTime })}
            </p>
          )}
          {child.lastSeenAt && <p className="muted">{timeAgo(child.lastSeenAt, t)}</p>}
        </>
      )}
    </div>
  );
}

function Dashboard({ session }: { session: Session }) {
  const { t } = useTranslation();
  const [children, setChildren] = useState<ChildToday[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setChildren(await fetchChildrenToday());
    setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand" style={{ marginBottom: 0 }}>
          {t('appName')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LanguageSwitcher />
          <button className="link-button" onClick={() => supabase.auth.signOut()}>
            {t('topBar.signOut')}
          </button>
        </div>
      </div>
      <p className="muted" style={{ marginBottom: 16 }}>
        {t('topBar.signedInAs', { email: session.user.email })}
      </p>

      {loading ? (
        <p className="muted">{t('dashboard.loading')}</p>
      ) : children.length === 0 ? (
        <div className="card">
          <p className="muted">{t('dashboard.noChildren')}</p>
        </div>
      ) : (
        children.map((child) => <ChildCard key={child.studentId} child={child} />)
      )}
    </div>
  );
}

function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (initializing) return null;
  return session ? <Dashboard session={session} /> : <LoginForm />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
    </BrowserRouter>
  );
}
