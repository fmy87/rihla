import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import StopMapEditor from '../components/StopMapEditor';
import StudentPicker from '../components/StudentPicker';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchRoute,
  fetchRouteStops,
  updateRoute,
  createStop,
  updateStop,
  deleteStop,
  reorderStops,
  fetchStopAssignments,
  unassignStudent,
  generateDailyRouteForToday,
  type RouteStopRow,
  type StopStudentAssignment,
} from '../lib/queries/routes';
import { fetchBuses, type BusRow } from '../lib/queries/buses';
import { fetchDrivers, type DriverRow } from '../lib/queries/drivers';
import { inputClass, labelClass, primaryButtonClass } from '../lib/formStyles';
import { computeReorderedSequence } from '../lib/reorder';

interface RouteMeta {
  id: string;
  school_id: string;
  name_en: string;
  name_ar: string | null;
  direction: 'home_to_school' | 'school_to_home';
  default_bus_id: string | null;
  default_driver_id: string | null;
  is_active: boolean;
}

export default function RouteEditorPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const { t } = useTranslation(['routes', 'common']);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [route, setRoute] = useState<RouteMeta | null>(null);
  const [stops, setStops] = useState<RouteStopRow[]>([]);
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<StopStudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);
  const [stopDraft, setStopDraft] = useState<Partial<RouteStopRow> | null>(null);
  const [generatingToday, setGeneratingToday] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);

  async function loadAll() {
    if (!routeId) return;
    const [{ data: routeData }, stopRows] = await Promise.all([fetchRoute(routeId), fetchRouteStops(routeId)]);
    if (routeData) setRoute(routeData as RouteMeta);
    setStops(stopRows);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [routeId]);

  useEffect(() => {
    if (!profile?.school_id) return;
    fetchBuses(profile.school_id).then(setBuses);
    fetchDrivers(profile.school_id).then((rows) => setDrivers(rows.filter((d) => d.is_active)));
  }, [profile?.school_id]);

  useEffect(() => {
    const selected = stops.find((s) => s.id === selectedStopId) ?? null;
    setStopDraft(selected ? { ...selected } : null);
    if (selectedStopId) {
      fetchStopAssignments(selectedStopId).then(setAssignments);
    } else {
      setAssignments([]);
    }
  }, [selectedStopId, stops]);

  // Persists the road-snapped polyline the map just computed so route
  // deviation detection (migration 0014) can use it instead of a straight
  // line through stops. Fire-and-forget: this is a cache of something
  // Google's Directions API can always recompute, not the source of truth,
  // so a failed/late write here just means deviation checks fall back to
  // the straight-line approximation until the next successful save.
  async function handleRoadPolylineComputed(encodedPolyline: string) {
    if (!routeId) return;
    await updateRoute(routeId, { road_polyline: encodedPolyline });
  }

  async function saveRouteMeta() {
    if (!route) return;
    setSavingMeta(true);
    await updateRoute(route.id, {
      name_en: route.name_en,
      name_ar: route.name_ar,
      direction: route.direction,
      default_bus_id: route.default_bus_id,
      default_driver_id: route.default_driver_id,
    });
    setSavingMeta(false);
  }

  async function handleAddStop(lat: number, lng: number, address?: string, placeId?: string) {
    if (!routeId) return;
    const nextSequence = stops.length + 1;
    const defaultStopType = route?.direction === 'school_to_home' ? 'dropoff' : 'pickup';
    const { data } = await createStop(routeId, nextSequence, {
      name_en: address ?? `Stop ${nextSequence}`,
      address: address ?? null,
      latitude: lat,
      longitude: lng,
      map_place_id: placeId ?? null,
      stop_type: defaultStopType,
    });
    await loadAll();
    if (data) setSelectedStopId(data.id);
  }

  async function handleMoveStop(stopId: string, lat: number, lng: number) {
    await updateStop(stopId, { latitude: lat, longitude: lng });
    setStops((prev) => prev.map((s) => (s.id === stopId ? { ...s, latitude: lat, longitude: lng } : s)));
  }

  async function handleMove(stopId: string, direction: -1 | 1) {
    const withNewSequence = computeReorderedSequence(stops, stopId, direction);
    if (!withNewSequence) return;
    await reorderStops(withNewSequence);
    await loadAll();
  }

  async function handleSaveStop() {
    if (!stopDraft?.id) return;
    await updateStop(stopDraft.id, {
      name_en: stopDraft.name_en,
      name_ar: stopDraft.name_ar,
      address: stopDraft.address,
      estimated_arrival_time: stopDraft.estimated_arrival_time,
      stop_type: stopDraft.stop_type,
      geofence_radius_meters: stopDraft.geofence_radius_meters,
      notes: stopDraft.notes,
    });
    await loadAll();
  }

  async function handleDeleteStop() {
    if (!stopDraft?.id) return;
    if (!confirm(t('routes:confirmDeleteStop'))) return;
    await deleteStop(stopDraft.id);
    setSelectedStopId(null);
    const remaining = stops.filter((s) => s.id !== stopDraft.id).sort((a, b) => a.sequence - b.sequence);
    await reorderStops(remaining.map((s, i) => ({ id: s.id, sequence: i + 1 })));
    await loadAll();
  }

  async function handleUnassign(assignmentId: string) {
    await unassignStudent(assignmentId);
    if (selectedStopId) setAssignments(await fetchStopAssignments(selectedStopId));
  }

  async function handleGenerateToday() {
    if (!route) return;
    setGeneratingToday(true);
    setGenerateMessage(null);
    const { error } = await generateDailyRouteForToday(route.id);
    setGeneratingToday(false);
    setGenerateMessage(
      error
        ? t('routes:generateFailed', { detail: error.message })
        : t('routes:generateSuccess')
    );
  }

  if (loading || !route) {
    return (
      <AppLayout>
        <div className="text-sm text-slate-400">{t('common:loading')}</div>
      </AppLayout>
    );
  }

  const orderedStops = [...stops].sort((a, b) => a.sequence - b.sequence);

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <button onClick={() => navigate('/routes')} className="text-sm text-slate-500 hover:text-slate-800">
          ← {t('common:nav.routes')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr_320px]">
        {/* LEFT: route info */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">{t('routes:routeInformation')}</h2>
          <div>
            <label className={labelClass}>{t('routes:nameEn')}</label>
            <input
              className={inputClass}
              value={route.name_en}
              onChange={(e) => setRoute({ ...route, name_en: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>{t('routes:nameAr')}</label>
            <input
              dir="rtl"
              className={inputClass}
              value={route.name_ar ?? ''}
              onChange={(e) => setRoute({ ...route, name_ar: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass}>{t('routes:direction.label')}</label>
            <select
              className={inputClass}
              value={route.direction}
              onChange={(e) => setRoute({ ...route, direction: e.target.value as RouteMeta['direction'] })}
            >
              <option value="home_to_school">{t('routes:direction.home_to_school')}</option>
              <option value="school_to_home">{t('routes:direction.school_to_home')}</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('routes:bus')}</label>
            <select
              className={inputClass}
              value={route.default_bus_id ?? ''}
              onChange={(e) => setRoute({ ...route, default_bus_id: e.target.value || null })}
            >
              <option value="">{t('routes:noBus')}</option>
              {buses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bus_number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('routes:driver')}</label>
            <select
              className={inputClass}
              value={route.default_driver_id ?? ''}
              onChange={(e) => setRoute({ ...route, default_driver_id: e.target.value || null })}
            >
              <option value="">{t('routes:noDriver')}</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                </option>
              ))}
            </select>
          </div>
          <button onClick={saveRouteMeta} disabled={savingMeta} className={`${primaryButtonClass} w-full`}>
            {savingMeta ? t('common:loading') : t('common:common.save')}
          </button>

          <hr className="border-slate-100" />
          <div>
            <button
              onClick={handleGenerateToday}
              disabled={generatingToday || !route.default_bus_id || !route.default_driver_id}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {generatingToday ? t('common:loading') : t('routes:generateToday')}
            </button>
            {(!route.default_bus_id || !route.default_driver_id) && (
              <p className="mt-1 text-xs text-slate-400">{t('routes:generateNeedsBusDriver')}</p>
            )}
            {generateMessage && <p className="mt-1 text-xs text-slate-500">{generateMessage}</p>}
          </div>
        </div>

        {/* CENTER: map */}
        <div>
          <StopMapEditor
            stops={orderedStops}
            selectedStopId={selectedStopId}
            onSelectStop={setSelectedStopId}
            onMoveStop={handleMoveStop}
            onMapClickToAddStop={handleAddStop}
            onRoadPolylineComputed={handleRoadPolylineComputed}
          />
        </div>

        {/* RIGHT: stop list + detail */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-slate-900">{t('routes:stops')}</h2>
            <ul className="space-y-1">
              {orderedStops.length === 0 && <p className="text-sm text-slate-400">{t('routes:noStopsYet')}</p>}
              {orderedStops.map((stop, idx) => (
                <li
                  key={stop.id}
                  className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                    selectedStopId === stop.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                  }`}
                >
                  <button className="flex-1 text-start" onClick={() => setSelectedStopId(stop.id)}>
                    {stop.sequence}. {stop.name_en}
                  </button>
                  <div className="flex gap-0.5">
                    <button
                      onClick={() => handleMove(stop.id, -1)}
                      disabled={idx === 0}
                      className="rounded p-1.5 disabled:opacity-30"
                      aria-label={t('routes:moveUp')}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => handleMove(stop.id, 1)}
                      disabled={idx === orderedStops.length - 1}
                      className="rounded p-1.5 disabled:opacity-30"
                      aria-label={t('routes:moveDown')}
                    >
                      ↓
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">{t('routes:addStopHint')}</p>
          </div>

          {stopDraft && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-slate-900">{t('routes:stopDetails')}</h3>
              <div>
                <label className={labelClass}>{t('routes:nameEn')}</label>
                <input
                  className={inputClass}
                  value={stopDraft.name_en ?? ''}
                  onChange={(e) => setStopDraft({ ...stopDraft, name_en: e.target.value })}
                />
              </div>
              <div>
                <label className={labelClass}>{t('routes:nameAr')}</label>
                <input
                  dir="rtl"
                  className={inputClass}
                  value={stopDraft.name_ar ?? ''}
                  onChange={(e) => setStopDraft({ ...stopDraft, name_ar: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t('routes:stopType')}</label>
                  <select
                    className={inputClass}
                    value={stopDraft.stop_type ?? 'pickup'}
                    onChange={(e) => setStopDraft({ ...stopDraft, stop_type: e.target.value as 'pickup' | 'dropoff' })}
                  >
                    <option value="pickup">{t('routes:pickup')}</option>
                    <option value="dropoff">{t('routes:dropoff')}</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t('routes:eta')}</label>
                  <input
                    type="time"
                    className={inputClass}
                    value={stopDraft.estimated_arrival_time ?? ''}
                    onChange={(e) => setStopDraft({ ...stopDraft, estimated_arrival_time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>{t('routes:geofence')}</label>
                <input
                  type="number"
                  min={20}
                  className={inputClass}
                  placeholder={t('routes:geofenceDefault')}
                  value={stopDraft.geofence_radius_meters ?? ''}
                  onChange={(e) =>
                    setStopDraft({
                      ...stopDraft,
                      geofence_radius_meters: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div>
                <label className={labelClass}>{t('routes:notes')}</label>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={stopDraft.notes ?? ''}
                  onChange={(e) => setStopDraft({ ...stopDraft, notes: e.target.value })}
                />
              </div>
              <div className="flex justify-between gap-2">
                <button onClick={handleDeleteStop} className="text-sm font-medium text-red-600 hover:text-red-800">
                  {t('routes:deleteStop')}
                </button>
                <button onClick={handleSaveStop} className={primaryButtonClass}>
                  {t('common:common.save')}
                </button>
              </div>

              <hr className="border-slate-100" />

              <h4 className="text-sm font-semibold text-slate-900">{t('routes:assignedStudents')}</h4>
              <ul className="space-y-1">
                {assignments.length === 0 && <p className="text-xs text-slate-400">{t('routes:noStudentsYet')}</p>}
                {assignments.map((a) => (
                  <li key={a.assignmentId} className="flex items-center justify-between text-sm">
                    <span>
                      {a.studentName} <span className="text-slate-400">· {a.studentCode}</span>
                    </span>
                    <button
                      onClick={() => handleUnassign(a.assignmentId)}
                      className="text-xs font-medium text-slate-400 hover:text-red-600"
                    >
                      {t('routes:remove')}
                    </button>
                  </li>
                ))}
              </ul>

              {profile?.school_id && stopDraft.id && (
                <StudentPicker
                  schoolId={profile.school_id}
                  routeId={route.id}
                  stopId={stopDraft.id}
                  alreadyAssignedIds={assignments.map((a) => a.studentId)}
                  onAssigned={() => selectedStopId && fetchStopAssignments(selectedStopId).then(setAssignments)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
