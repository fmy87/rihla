import { useMemo, useState } from 'react';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import type { LiveBusPosition, ActiveRouteRow } from '../lib/queries/dashboard';

interface LiveMapProps {
  positions: LiveBusPosition[];
  routes: ActiveRouteRow[];
}

const MUSCAT_CENTER = { lat: 23.588, lng: 58.3829 };
const containerStyle = { width: '100%', height: '420px', borderRadius: '16px' };

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function LiveMap({ positions, routes }: LiveMapProps) {
  const { t, i18n } = useTranslation('common');
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'school-bus-google-map',
    googleMapsApiKey: import.meta.env.VITE_MAP_API_KEY,
    language: i18n.language, // map labels follow the app's selected language
  });

  const routeByBusId = useMemo(() => new Map(routes.map((r) => [r.busId, r])), [routes]);
  const selectedPosition = positions.find((p) => p.busId === selectedBusId) ?? null;

  if (!isLoaded) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
        {t('loading')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <GoogleMap mapContainerStyle={containerStyle} center={MUSCAT_CENTER} zoom={11}>
        {positions.map((pos) => (
          <Marker
            key={pos.busId}
            position={{ lat: pos.latitude, lng: pos.longitude }}
            title={routeByBusId.get(pos.busId)?.busNumber ?? pos.busId}
            onClick={() => setSelectedBusId(pos.busId)}
          />
        ))}

        {selectedPosition && (
          <InfoWindow
            position={{ lat: selectedPosition.latitude, lng: selectedPosition.longitude }}
            onCloseClick={() => setSelectedBusId(null)}
          >
            <div className="min-w-[160px] text-sm">
              <p className="font-semibold text-slate-900">
                {routeByBusId.get(selectedPosition.busId)?.busNumber ?? selectedPosition.busId}
              </p>
              <p className="text-slate-500">{routeByBusId.get(selectedPosition.busId)?.driverName ?? '—'}</p>
              <p className="text-slate-500">{routeByBusId.get(selectedPosition.busId)?.routeName ?? '—'}</p>
              {selectedPosition.speedKmh != null && (
                <p className="text-slate-500">{selectedPosition.speedKmh} km/h</p>
              )}
              <p className="mt-1 text-xs text-slate-400">{timeAgo(selectedPosition.recordedAt)}</p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      {positions.length === 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-400">
          No live positions yet — buses appear here once a driver starts a route with location tracking enabled.
        </div>
      )}
    </div>
  );
}
