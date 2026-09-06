import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';
import RouteReplayMap from '../components/RouteReplayMap';
import { fetchGpsHistory, fetchReplayMeta, fetchReplayStops, type ReplayPoint, type ReplayMeta, type ReplayStop } from '../lib/queries/replay';
import { tripDurationMinutes } from '../lib/replayDuration';

const SPEED_OPTIONS = [1, 2, 4, 8];

function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function RouteReplayPage() {
  const { dailyRouteId } = useParams<{ dailyRouteId: string }>();
  const { t } = useTranslation(['operations', 'dashboard', 'common']);

  const [meta, setMeta] = useState<ReplayMeta | null>(null);
  const [points, setPoints] = useState<ReplayPoint[]>([]);
  const [stops, setStops] = useState<ReplayStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!dailyRouteId) return;
    setLoading(true);
    Promise.all([fetchReplayMeta(dailyRouteId), fetchGpsHistory(dailyRouteId), fetchReplayStops(dailyRouteId)]).then(
      ([metaRow, pointRows, stopRows]) => {
        setMeta(metaRow);
        setPoints(pointRows);
        setStops(stopRows);
        setIndex(0);
        setLoading(false);
      }
    );
  }, [dailyRouteId]);

  // Advances one GPS point roughly every second, faster at higher "speed" —
  // this is a scrubbing aid, not a claim to real elapsed-time accuracy (gaps
  // between real pings vary with the GPS update interval and offline replay).
  useEffect(() => {
    if (playing && points.length > 0) {
      timerRef.current = setInterval(() => {
        setIndex((i) => {
          if (i >= points.length - 1) {
            setPlaying(false);
            return i;
          }
          return i + 1;
        });
      }, 1000 / speed);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speed, points.length]);

  const durationLabel = useMemo(() => {
    const minutes = tripDurationMinutes(points);
    return minutes === null ? null : `${minutes} min`;
  }, [points]);

  if (loading) {
    return (
      <AppLayout>
        <div className="text-sm text-slate-400">{t('common:loading')}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link to="/daily-operations" className="text-xs font-medium text-blue-600 hover:underline">
            ← {t('operations:title')}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            {meta ? `${meta.busNumber} · ${meta.routeName}` : t('operations:replay.title')}
          </h1>
          {meta && (
            <p className="text-sm text-slate-500">
              {meta.driverName} · {meta.serviceDate} · {t(`dashboard:status.${meta.status}`)}
              {durationLabel && <> · {durationLabel}</>}
            </p>
          )}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          {t('operations:replay.empty')}
        </div>
      ) : (
        <>
          <RouteReplayMap points={points} stops={stops} currentIndex={index} />

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                {playing ? t('operations:replay.pause') : t('operations:replay.play')}
              </button>

              <input
                type="range"
                min={0}
                max={points.length - 1}
                value={index}
                onChange={(e) => {
                  setPlaying(false);
                  setIndex(Number(e.target.value));
                }}
                className="min-w-[200px] flex-1"
              />

              <span className="w-24 shrink-0 text-sm tabular-nums text-slate-600">{formatClock(points[index].recordedAt)}</span>

              <select
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                {SPEED_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}×
                  </option>
                ))}
              </select>
            </div>

            {points[index].speedKmh != null && (
              <p className="mt-2 text-xs text-slate-400">{points[index].speedKmh} km/h at this point</p>
            )}
          </div>
        </>
      )}
    </AppLayout>
  );
}
