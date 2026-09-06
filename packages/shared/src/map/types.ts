/**
 * Provider-agnostic map contract. Concrete implementations (Google Maps now,
 * potentially Apple MapKit later for a native surface) live per-app and
 * implement this shape, so screens never call a maps SDK directly.
 *
 * This phase (3) only needs bus-marker display for the Live Bus Map.
 * geocode/reverseGeocode/calculateRoute/calculateETA/drawGeofence/
 * calculateRouteDeviation are added in Phase 5 (Route Builder) and
 * Phase 9 (Alerts + Route Deviation) as those screens are built.
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface BusMapMarker {
  busId: string;
  busNumber: string;
  driverName: string;
  routeName: string;
  status: string;
  position: LatLng;
  lastUpdateAt: string | null;
  headingDegrees?: number;
}

export interface MapService {
  /** Center/zoom so all given markers are visible. */
  fitToMarkers(markers: BusMapMarker[]): void;
  /** Focus on a single bus, e.g. after clicking it in a list. */
  focusBus(busId: string): void;
}
