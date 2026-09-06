import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { fetchRoutes, createRoute, type RouteListItem, type RouteInput } from '../lib/queries/routes';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass, statusBadgeClass } from '../lib/formStyles';

const EMPTY_FORM: RouteInput = { name_en: '', name_ar: '', direction: 'home_to_school' };

export default function RoutesPage() {
  const { t } = useTranslation(['routes', 'common']);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [routes, setRoutes] = useState<RouteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RouteInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    if (!profile?.school_id) return;
    setRoutes(await fetchRoutes(profile.school_id));
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [profile?.school_id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id) return;
    setSaving(true);
    setError(null);
    const { data, error: createError } = await createRoute(profile.school_id, form);
    setSaving(false);
    if (createError || !data) {
      setError(createError?.message ?? t('routes:createFailed'));
      return;
    }
    navigate(`/routes/${data.id}`);
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">{t('common:nav.routes')}</h1>
        <button onClick={() => setShowForm(true)} className={primaryButtonClass}>
          {t('routes:addRoute')}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400">{t('common:loading')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {routes.length === 0 && <p className="text-sm text-slate-400">{t('routes:empty')}</p>}
          {routes.map((route) => (
            <button
              key={route.id}
              onClick={() => navigate(`/routes/${route.id}`)}
              className="rounded-2xl border border-slate-200 bg-white p-5 text-start shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <div className="mb-2 flex items-start justify-between">
                <h3 className="font-semibold text-slate-900">{route.name_en}</h3>
                <span className={statusBadgeClass(route.is_active)}>
                  {route.is_active ? t('routes:active') : t('routes:inactive')}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {t(`routes:direction.${route.direction}`)} · {route.stop_count} {t('routes:stops')}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {route.bus_number ?? t('routes:noBus')} · {route.driver_name ?? t('routes:noDriver')}
              </p>
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={t('routes:addRoute')} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t('routes:nameEn')}</label>
                <input
                  required
                  className={inputClass}
                  value={form.name_en}
                  onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('routes:nameAr')}</label>
                <input
                  dir="rtl"
                  className={inputClass}
                  value={form.name_ar ?? ''}
                  onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>{t('routes:direction.label')}</label>
              <select
                className={inputClass}
                value={form.direction}
                onChange={(e) => setForm({ ...form, direction: e.target.value as RouteInput['direction'] })}
              >
                <option value="home_to_school">{t('routes:direction.home_to_school')}</option>
                <option value="school_to_home">{t('routes:direction.school_to_home')}</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className={secondaryButtonClass}>
                {t('common:common.cancel')}
              </button>
              <button type="submit" disabled={saving} className={primaryButtonClass}>
                {saving ? t('common:loading') : t('routes:createAndEdit')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </AppLayout>
  );
}
