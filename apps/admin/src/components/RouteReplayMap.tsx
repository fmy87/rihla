import { GoogleMap, Marker, Polyline, useJsApiLoader } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import type { ReplayPoint, ReplayStop } from '../lib/queries/replay';

interface RouteReplayMapProps {
  points: ReplayPoint[];
  stops: ReplayStop[];
  currentIndex: number;
}

const MUSCAT_CENTER = { lat: 23.588, lng: 58.3829 };
const containerStyle = { width: '100%', height: '480px', borderRadius: '16px' };

export default function RouteReplayMap({ points, stops, currentIndex }: RouteReplayMapProps) {
  const { t, i18n } = useTranslation('common');
  const { isLoaded } = useJsApiLoader({
    id: 'school-bus-google-map',
    googleMapsApiKey: import.meta.env.VITE_MAP_API_KEY,
    language: i18n.language,
  });

  if (!isLoaded) {
    return (
      <div className="flex h-[480px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
        {t('loading')}
      </div>
    );
  }

  const path = points.map((p) => ({ lat: p.latitude, lng: p.longitude }));
  const current = points[currentIndex] ?? null;
  const center = current ? { lat: current.latitude, lng: current.longitude } : path[0] ?? MUSCAT_CENTER;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200">
      <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={13}>
        {path.length > 1 && (
          <Polyline path={path} options={{ strokeColor: '#94a3b8', strokeWeight: 3, strokeOpacity: 0.8 }} />
        )}
        {/* Travelled portion highlighted, so scrubbing shows progress at a glance. */}
        {currentIndex > 0 && (
          <Polyline
            path={path.slice(0, currentIndex + 1)}
            options={{ strokeColor: '#0f172a', strokeWeight: 4, strokeOpacity: 1 }}
          />
        )}

        {stops.map((stop) => (
          <Marker
            key={stop.sequence}
            position={{ lat: stop.latitude, lng: stop.longitude }}
            label={String(stop.sequence)}
            opacity={stop.isSkipped ? 0.4 : 0.9}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 7,
              fillColor: stop.isSkipped ? '#f59e0b' : stop.arrivedAt ? '#16a34a' : '#94a3b8',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            }}
          />
        ))}

        {current && (
          <Marker
            position={{ lat: current.latitude, lng: current.longitude }}
            icon={{
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              scale: 5,
              fillColor: '#2563eb',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 1.5,
            }}
            zIndex={999}
          />
        )}
      </GoogleMap>
    </div>
  );
}
