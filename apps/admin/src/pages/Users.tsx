import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchAdminUsers,
  createAdminAccount,
  setUserActive,
  type AdminUserRow,
  type AdminAccountInput,
} from '../lib/queries/users';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, statusBadgeClass } from '../lib/formStyles';

const EMPTY_FORM: AdminAccountInput = { full_name: '', email: '', role: 'transport_admin', phone: '' };

export default function UsersPage() {
  const { t } = useTranslation(['users', 'common']);
  const { profile } = useAuth();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AdminAccountInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [passwordLink, setPasswordLink] = useState<string | null>(null);

  async function reload() {
    if (!profile?.school_id) return;
    setUsers(await fetchAdminUsers(profile.school_id));
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [profile?.school_id]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setPasswordLink(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id) return;
    setSaving(true);
    setError(null);

    const { data, error: fnError } = await createAdminAccount(profile.school_id, form);
    setSaving(false);

    if (fnError) {
      setError(t('users:createFailed'));
      return;
    }
    setPasswordLink(data?.password_set_link ?? null);
    reload();
  }

  async function toggleActive(user: AdminUserRow) {
    if (user.id === profile?.id) return; // can't deactivate yourself
    await setUserActive(user.id, !user.is_active);
    reload();
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{t('common:nav.users')}</h1>
        <button onClick={openCreate} className={primaryButtonClass}>
          {t('users:addUser')}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">{t('common:loading')}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">{t('users:fullName')}</th>
                <th className="px-4 py-3 text-start">{t('users:email')}</th>
                <th className="px-4 py-3 text-start">{t('users:role')}</th>
                <th className="px-4 py-3 text-start">{t('users:status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{user.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{user.email}</td>
                  <td className="px-4 py-3 text-slate-600">{t(`common:roles.${user.role}`)}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadgeClass(user.is_active)}>
                      {user.is_active ? t('users:active') : t('users:inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    {user.id !== profile?.id && (
                      <button
                        onClick={() => toggleActive(user)}
                        className="text-sm font-medium text-slate-400 hover:text-slate-700"
                      >
                        {user.is_active ? t('users:deactivate') : t('users:activate')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title={t('users:addUser')} onClose={() => setShowForm(false)}>
          {passwordLink ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">{t('users:accountCreated')}</p>
              <div className="break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-500">{passwordLink}</div>
              <div className="flex justify-end">
                <button onClick={() => setShowForm(false)} className={primaryButtonClass}>
                  {t('common:common.confirm')}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>{t('users:fullName')}</label>
                <input
                  required
                  className={inputClass}
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('users:email')}</label>
                <input
                  required
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('users:role')}</label>
                <select
                  className={inputClass}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as AdminAccountInput['role'] })}
                >
                  <option value="transport_admin">{t('common:roles.transport_admin')}</option>
                  <option value="super_admin">{t('common:roles.super_admin')}</option>
                </select>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className={secondaryButtonClass}>
                  {t('common:common.cancel')}
                </button>
                <button type="submit" disabled={saving} className={primaryButtonClass}>
                  {saving ? t('common:loading') : t('common:common.save')}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </AppLayout>
  );
}
