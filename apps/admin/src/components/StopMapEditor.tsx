import { useCallback, useRef, useState, useEffect } from 'react';
import {
  GoogleMap,
  Marker,
  Autocomplete,
  DirectionsService,
  DirectionsRenderer,
  useJsApiLoader,
} from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import type { RouteStopRow } from '../lib/queries/routes';
import { GOOGLE_MAPS_LOADER_ID, GOOGLE_MAPS_LIBRARIES } from '../lib/googleMapsConfig';

const MUSCAT_CENTER = { lat: 23.588, lng: 58.3829 };
const containerStyle = { width: '100%', height: '520px', borderRadius: '16px' };

interface StopMapEditorProps {
  stops: RouteStopRow[];
  selectedStopId: string | null;
  onSelectStop: (stopId: string) => void;
  onMoveStop: (stopId: string, lat: number, lng: number) => void;
  onMapClickToAddStop: (lat: number, lng: number, address?: string, placeId?: string) => void;
  /** Fires with the encoded road-snapped polyline whenever the Directions API
   *  recomputes one for the current stop order — used to persist it on the
   *  route for road-snapped deviation detection (see routes.road_polyline). */
  onRoadPolylineComputed?: (encodedPolyline: string) => void;
}

export default function StopMapEditor({
  stops,
  selectedStopId,
  onSelectStop,
  onMoveStop,
  onMapClickToAddStop,
  onRoadPolylineComputed,
}: StopMapEditorProps) {
  const { t, i18n } = useTranslation(['routes', 'common']);
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: import.meta.env.VITE_MAP_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    language: i18n.language,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [requestDirections, setRequestDirections] = useState(false);

  // Recompute the road-based route line whenever the stop set/order changes.
  useEffect(() => {
    setDirections(null);
    setRequestDirections(stops.length >= 2);
  }, [stops.map((s) => `${s.id}:${s.sequence}:${s.latitude}:${s.longitude}`).join('|')]);

  const directionsCallback = useCallback(
    (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
      setRequestDirections(false);
      if (status === 'OK' && result) {
        setDirections(result);
        const encoded = result.routes[0]?.overview_polyline;
        if (encoded && onRoadPolylineComputed) onRoadPolylineComputed(encoded);
      }
    },
    [onRoadPolylineComputed]
  );

  function handlePlaceChanged() {
    const place = autocompleteRef.current?.getPlace();
    if (!place?.geometry?.location) return;
    onMapClickToAddStop(
      place.geometry.location.lat(),
      place.geometry.location.lng(),
      place.formatted_address ?? place.name,
      place.place_id
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-sm text-slate-400">
        {t('common:loading')}
      </div>
    );
  }

  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  const waypoints = ordered.slice(1, -1).map((s) => ({ location: { lat: s.latitude, lng: s.longitude }, stopover: true }));

  return (
    <div className="space-y-2">
      <Autocomplete onLoad={(a) => (autocompleteRef.current = a)} onPlaceChanged={handlePlaceChanged}>
        <input
          type="text"
          placeholder={t('routes:searchAddress')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      </Autocomplete>
      <p className="text-xs text-slate-400">{t('routes:mapHint')}</p>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={ordered[0] ? { lat: ordered[0].latitude, lng: ordered[0].longitude } : MUSCAT_CENTER}
          zoom={ordered.length ? 12 : 11}
          onClick={(e) => {
            if (e.latLng) onMapClickToAddStop(e.latLng.lat(), e.latLng.lng());
          }}
        >
          {ordered.map((stop) => (
            <Marker
              key={stop.id}
              position={{ lat: stop.latitude, lng: stop.longitude }}
              label={String(stop.sequence)}
              draggable
              onClick={() => onSelectStop(stop.id)}
              onDragEnd={(e) => {
                if (e.latLng) onMoveStop(stop.id, e.latLng.lat(), e.latLng.lng());
              }}
              opacity={selectedStopId === stop.id ? 1 : 0.85}
            />
          ))}

          {requestDirections && ordered.length >= 2 && (
            <DirectionsService
              options={{
                origin: { lat: ordered[0].latitude, lng: ordered[0].longitude },
                destination: {
                  lat: ordered[ordered.length - 1].latitude,
                  lng: ordered[ordered.length - 1].longitude,
                },
                waypoints,
                travelMode: google.maps.TravelMode.DRIVING,
              }}
              callback={directionsCallback}
            />
          )}
          {directions && <DirectionsRenderer options={{ directions, suppressMarkers: true }} />}
        </GoogleMap>
      </div>
    </div>
  );
}
