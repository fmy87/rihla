import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // supabase-js auto-detects the recovery token in the URL hash on load
  // and fires PASSWORD_RECOVERY once it's parsed a valid session from it —
  // that's the signal this page is safe to show the "set a new password"
  // form, rather than assuming the link was valid just because this route
  // was reached.
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
    // Covers the case where the PASSWORD_RECOVERY event already fired
    // before this listener was attached (a real race on a fast connection).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('resetPassword.mismatchError'));
      return;
    }
    if (password.length < 8) {
      setError(t('resetPassword.tooShortError'));
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate('/'), 1200);
  }

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand" style={{ marginBottom: 0 }}>
          {t('appName')}
        </div>
        <LanguageSwitcher />
      </div>

      {success ? (
        <div className="card">
          <p className="student-name">{t('resetPassword.successTitle')}</p>
          <p className="muted">{t('resetPassword.successBody')}</p>
        </div>
      ) : !ready ? (
        <div className="card">
          <p className="muted">{t('resetPassword.waitingForLink')}</p>
        </div>
      ) : (
        <form className="card" onSubmit={handleSubmit}>
          <p className="student-name" style={{ marginBottom: 10 }}>
            {t('resetPassword.title')}
          </p>
          <label className="muted" htmlFor="newPassword">
            {t('resetPassword.newPasswordLabel')}
          </label>
          <input
            id="newPassword"
            type="password"
            className="field"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <label className="muted" htmlFor="confirmPassword">
            {t('resetPassword.confirmPasswordLabel')}
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="field"
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          {error && <p className="error">{error}</p>}
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? t('resetPassword.submitting') : t('resetPassword.submit')}
          </button>
        </form>
      )}
    </div>
  );
}
