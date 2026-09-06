import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '../supabaseClient';
import LanguageSwitcher from '../components/LanguageSwitcher';

type VerifyState =
  | { status: 'checking' }
  | { status: 'invalid'; error: string }
  | { status: 'valid'; studentName: string; schoolName: string };

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [verify, setVerify] = useState<VerifyState>({ status: 'checking' });
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.functions
      .invoke('accept-guardian-invite', { body: { action: 'verify', token } })
      .then(({ data, error }) => {
        if (error || !data?.valid) {
          const code = (data as { error?: string } | null)?.error ?? 'unexpected';
          setVerify({ status: 'invalid', error: code });
          return;
        }
        setVerify({ status: 'valid', studentName: data.student_name, schoolName: data.school_name });
      });
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);

    const { data, error } = await supabase.functions.invoke('accept-guardian-invite', {
      body: { action: 'accept', token, email, password, full_name: fullName },
    });

    if (error || !data?.user_id) {
      const code = (data as { error?: string } | null)?.error ?? 'unexpected';
      setSubmitError(code);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    // The Edge Function creates/links the account with the service role — it
    // doesn't hand back a session, so sign in normally with the same
    // credentials the parent just set to establish one in this browser.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (!signInError) {
      setTimeout(() => navigate('/'), 1200);
    }
  }

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="brand" style={{ marginBottom: 0 }}>
          {t('appName')}
        </div>
        <LanguageSwitcher />
      </div>

      {verify.status === 'checking' && <p className="muted">{t('invite.verifying')}</p>}

      {verify.status === 'invalid' && (
        <div className="card">
          <p className="student-name">{t('invite.invalidTitle')}</p>
          <p className="muted">
            {t(`invite.errors.${verify.error}`, { defaultValue: t('invite.invalidBody') })}
          </p>
        </div>
      )}

      {verify.status === 'valid' && !success && (
        <>
          <div className="card">
            <p className="student-name">{t('invite.welcomeTitle')}</p>
            <p className="muted">{t('invite.welcomeBody', { schoolName: verify.schoolName, studentName: verify.studentName })}</p>
          </div>

          <form className="card" onSubmit={handleSubmit}>
            <label className="muted" htmlFor="fullName">
              {t('invite.fullNameLabel')}
            </label>
            <input id="fullName" className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            <p className="muted" style={{ marginTop: -6, marginBottom: 10 }}>
              {t('invite.fullNameHint')}
            </p>

            <label className="muted" htmlFor="email">
              {t('invite.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="muted" htmlFor="password">
              {t('invite.passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              className="field"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p className="muted" style={{ marginTop: -6, marginBottom: 10 }}>
              {t('invite.passwordHint')}
            </p>

            {submitError && <p className="error">{t(`invite.errors.${submitError}`, { defaultValue: t('invite.errors.unexpected') })}</p>}

            <button className="button" type="submit" disabled={submitting}>
              {submitting ? t('invite.submitting') : t('invite.submit')}
            </button>
          </form>
        </>
      )}

      {success && (
        <div className="card">
          <p className="student-name">{t('invite.successTitle')}</p>
          <p className="muted">
            {t('invite.successBody', { studentName: verify.status === 'valid' ? verify.studentName : '' })}
          </p>
        </div>
      )}
    </div>
  );
}
