import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { fetchBuses, createBus, updateBus, type BusRow, type BusInput } from '../lib/queries/buses';
import { fetchDrivers, type DriverRow } from '../lib/queries/drivers';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, statusBadgeClass } from '../lib/formStyles';

const EMPTY_FORM: BusInput = {
  bus_number: '',
  registration_number: '',
  nickname_en: '',
  nickname_ar: '',
  capacity: 30,
  default_driver_id: null,
  assistant_name: '',
  notes: '',
};

export default function BusesPage() {
  const { t } = useTranslation(['buses', 'common']);
  const { profile } = useAuth();

  const [buses, setBuses] = useState<BusRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BusRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BusInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    if (!profile?.school_id) return;
    const [busRows, driverRows] = await Promise.all([fetchBuses(profile.school_id), fetchDrivers(profile.school_id)]);
    setBuses(busRows);
    setDrivers(driverRows.filter((d) => d.is_active));
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [profile?.school_id]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setShowForm(true);
  }

  function openEdit(bus: BusRow) {
    setEditing(bus);
    setForm({
      bus_number: bus.bus_number,
      registration_number: bus.registration_number,
      nickname_en: bus.nickname_en ?? '',
      nickname_ar: bus.nickname_ar ?? '',
      capacity: bus.capacity,
      default_driver_id: bus.default_driver_id,
      assistant_name: bus.assistant_name ?? '',
      notes: bus.notes ?? '',
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id) return;
    setSaving(true);
    setError(null);

    const { error: saveError } = editing
      ? await updateBus(editing.id, form)
      : await createBus(profile.school_id, form);

    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setShowForm(false);
    reload();
  }

  async function toggleActive(bus: BusRow) {
    await updateBus(bus.id, { is_active: !bus.is_active });
    reload();
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{t('common:nav.buses')}</h1>
        <button onClick={openCreate} className={primaryButtonClass}>
          {t('buses:addBus')}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">{t('common:loading')}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-start text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-start">{t('buses:busNumber')}</th>
                <th className="px-4 py-3 text-start">{t('buses:registration')}</th>
                <th className="px-4 py-3 text-start">{t('buses:capacity')}</th>
                <th className="px-4 py-3 text-start">{t('buses:driver')}</th>
                <th className="px-4 py-3 text-start">{t('buses:status')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {buses.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    {t('buses:empty')}
                  </td>
                </tr>
              )}
              {buses.map((bus) => (
                <tr key={bus.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{bus.bus_number}</td>
                  <td className="px-4 py-3 text-slate-600">{bus.registration_number}</td>
                  <td className="px-4 py-3 text-slate-600">{bus.capacity}</td>
                  <td className="px-4 py-3 text-slate-600">{bus.driver_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadgeClass(bus.is_active)}>
                      {bus.is_active ? t('common:common.confirm') : t('buses:inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button onClick={() => openEdit(bus)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                      {t('buses:edit')}
                    </button>
                    <button
                      onClick={() => toggleActive(bus)}
                      className="ms-3 text-sm font-medium text-slate-400 hover:text-slate-700"
                    >
                      {bus.is_active ? t('buses:deactivate') : t('buses:activate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title={editing ? t('buses:editBus') : t('buses:addBus')} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t('buses:busNumber')}</label>
                <input
                  required
                  className={inputClass}
                  value={form.bus_number}
                  onChange={(e) => setForm({ ...form, bus_number: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('buses:registration')}</label>
                <input
                  required
                  className={inputClass}
                  value={form.registration_number}
                  onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t('buses:nicknameEn')}</label>
                <input
                  className={inputClass}
                  value={form.nickname_en ?? ''}
                  onChange={(e) => setForm({ ...form, nickname_en: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('buses:nicknameAr')}</label>
                <input
                  dir="rtl"
                  className={inputClass}
                  value={form.nickname_ar ?? ''}
                  onChange={(e) => setForm({ ...form, nickname_ar: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t('buses:capacity')}</label>
                <input
                  required
                  type="number"
                  min={1}
                  className={inputClass}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('buses:driver')}</label>
                <select
                  className={inputClass}
                  value={form.default_driver_id ?? ''}
                  onChange={(e) => setForm({ ...form, default_driver_id: e.target.value || null })}
                >
                  <option value="">{t('buses:unassigned')}</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.full_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>{t('buses:assistant')}</label>
              <input
                className={inputClass}
                value={form.assistant_name ?? ''}
                onChange={(e) => setForm({ ...form, assistant_name: e.target.value })}
              />
            </div>

            <div>
              <label className={labelClass}>{t('buses:notes')}</label>
              <textarea
                className={inputClass}
                rows={2}
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
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
