import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchSystemSettings,
  updateSystemSettings,
  type SystemSettingsInput,
} from '../lib/queries/settings';
import { inputClass, labelClass, primaryButtonClass } from '../lib/formStyles';

interface FieldConfig {
  key: keyof SystemSettingsInput;
  labelKey: string;
  helpKey: string;
  unitKey: 'seconds' | 'meters' | 'minutes';
  min: number;
  max: number;
}

const FIELDS: FieldConfig[] = [
  {
    key: 'gps_update_interval_seconds',
    labelKey: 'gpsUpdateInterval',
    helpKey: 'gpsUpdateIntervalHelp',
    unitKey: 'seconds',
    min: 5,
    max: 300,
  },
  {
    key: 'stop_geofence_radius_meters',
    labelKey: 'stopGeofenceRadius',
    helpKey: 'stopGeofenceRadiusHelp',
    unitKey: 'meters',
    min: 20,
    max: 1000,
  },
  {
    key: 'route_deviation_threshold_meters',
    labelKey: 'routeDeviationThreshold',
    helpKey: 'routeDeviationThresholdHelp',
    unitKey: 'meters',
    min: 20,
    max: 2000,
  },
  {
    key: 'pickup_grace_period_minutes',
    labelKey: 'pickupGracePeriod',
    helpKey: 'pickupGracePeriodHelp',
    unitKey: 'minutes',
    min: 1,
    max: 60,
  },
  {
    key: 'bus_offline_threshold_minutes',
    labelKey: 'busOfflineThreshold',
    helpKey: 'busOfflineThresholdHelp',
    unitKey: 'minutes',
    min: 1,
    max: 60,
  },
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation(['settings', 'common']);
  const { profile } = useAuth();

  const [values, setValues] = useState<SystemSettingsInput | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (!profile?.school_id) return;
    (async () => {
      const row = await fetchSystemSettings(profile.school_id);
      if (!row) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setValues({
        gps_update_interval_seconds: row.gps_update_interval_seconds,
        stop_geofence_radius_meters: row.stop_geofence_radius_meters,
        route_deviation_threshold_meters: row.route_deviation_threshold_meters,
        pickup_grace_period_minutes: row.pickup_grace_period_minutes,
        bus_offline_threshold_minutes: row.bus_offline_threshold_minutes,
      });
      setUpdatedAt(row.updated_at);
      setLoading(false);
    })();
  }, [profile?.school_id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id || !values) return;
    setSaving(true);
    setSaveResult('idle');
    const { error } = await updateSystemSettings(profile.school_id, values);
    setSaving(false);
    setSaveResult(error ? 'error' : 'success');
    if (!error) setUpdatedAt(new Date().toISOString());
  }

  return (
    <AppLayout>
      <h1 className="mb-2 text-2xl font-semibold text-slate-900">{t('settings:title')}</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">{t('settings:subtitle')}</p>

      {loading ? (
        <div className="text-sm text-slate-400">{t('common:common.loading')}</div>
      ) : loadError || !values ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-400">
          {t('settings:loadError')}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className={labelClass} htmlFor={field.key}>
                {t(`settings:${field.labelKey}`)}
              </label>
              <div className="flex items-center gap-3">
                <input
                  id={field.key}
                  type="number"
                  min={field.min}
                  max={field.max}
                  required
                  value={values[field.key]}
                  onChange={(e) =>
                    setValues({ ...values, [field.key]: Number(e.target.value) })
                  }
                  className={`${inputClass} max-w-[140px]`}
                />
                <span className="text-sm text-slate-500">{t(`settings:${field.unitKey}`)}</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">{t(`settings:${field.helpKey}`)}</p>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <button type="submit" disabled={saving} className={primaryButtonClass}>
              {saving ? t('common:common.loading') : t('settings:save')}
            </button>
            {saveResult === 'success' && (
              <span className="text-sm text-status-normal">{t('settings:saved')}</span>
            )}
            {saveResult === 'error' && (
              <span className="text-sm text-status-critical">{t('settings:saveError')}</span>
            )}
            {updatedAt && (
              <span className="ms-auto text-xs text-slate-400">
                {t('settings:lastUpdated', {
                  time: new Date(updatedAt).toLocaleString(i18n.language),
                })}
              </span>
            )}
          </div>
        </form>
      )}
    </AppLayout>
  );
}
