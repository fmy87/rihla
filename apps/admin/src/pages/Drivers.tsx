import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchDrivers,
  createDriverAccount,
  updateDriverProfile,
  type DriverRow,
  type DriverAccountInput,
} from '../lib/queries/drivers';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, statusBadgeClass } from '../lib/formStyles';

const EMPTY_FORM: DriverAccountInput = {
  full_name: '',
  employee_id: '',
  pin: '',
  phone: '',
  license_number: '',
  license_expiry: '',
};

export default function DriversPage() {
  const { t } = useTranslation(['drivers', 'common']);
  const { profile } = useAuth();

  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DriverAccountInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    if (!profile?.school_id) return;
    setDrivers(await fetchDrivers(profile.school_id));
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [profile?.school_id]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id) return;
    if (form.pin.length < 6) {
      setError(t('drivers:pinTooShort'));
      return;
    }
    setSaving(true);
    setError(null);

    const { data, error: fnError } = await createDriverAccount(profile.school_id, form);
    setSaving(false);

    if (fnError || (data as any)?.error) {
      setError(t('drivers:createFailed'));
      return;
    }
    setShowForm(false);
    reload();
  }

  async function toggleActive(driver: DriverRow) {
    await updateDriverProfile(driver.id, { is_active: !driver.is_active });
    reload();
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{t('common:nav.drivers')}</h1>
        <button onClick={openCreate} className={primaryButtonClass}>
          {t('drivers:addDriver')}
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
                <th className="px-4 py-3 text-start">{t('drivers:employeeId')}</th>
                <th className="px-4 py-3 text-start">{t('drivers:fullName')}</th>
                <th className="px-4 py-3 text-start">{t('drivers:phone')}</th>
                <th className="px-4 py-3 text-start">{t('drivers:login')}</th>
                <th className="px-4 py-3 text-start">{t('drivers:status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {drivers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    {t('drivers:empty')}
                  </td>
                </tr>
              )}
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{driver.employee_id}</td>
                  <td className="px-4 py-3 text-slate-600">{driver.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">{driver.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {driver.has_login ? t('drivers:loginActive') : t('drivers:loginMissing')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={statusBadgeClass(driver.is_active)}>
                      {driver.is_active ? t('drivers:active') : t('drivers:inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => toggleActive(driver)}
                      className="text-sm font-medium text-slate-400 hover:text-slate-700"
                    >
                      {driver.is_active ? t('drivers:deactivate') : t('drivers:activate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {showForm && (
        <Modal title={t('drivers:addDriver')} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('drivers:fullName')}</label>
                <input
                  required
                  className={inputClass}
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('drivers:employeeId')}</label>
                <input
                  required
                  className={inputClass}
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('drivers:pin')}</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  className={inputClass}
                  value={form.pin}
                  onChange={(e) => setForm({ ...form, pin: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-400">{t('drivers:pinHint')}</p>
              </div>
              <div>
                <label className={labelClass}>{t('drivers:phone')}</label>
                <input
                  className={inputClass}
                  value={form.phone ?? ''}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>{t('drivers:licenseNumber')}</label>
                <input
                  className={inputClass}
                  value={form.license_number ?? ''}
                  onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('drivers:licenseExpiry')}</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.license_expiry ?? ''}
                  onChange={(e) => setForm({ ...form, license_expiry: e.target.value })}
                />
              </div>
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
        </Modal>
      )}
    </AppLayout>
  );
}
