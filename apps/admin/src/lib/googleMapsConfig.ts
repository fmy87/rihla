/**
 * Shared config for every Google Maps instance in this app.
 *
 * @react-google-maps/api's useJsApiLoader() is a singleton keyed by `id` —
 * once the loader has been created with one set of options under an `id`,
 * any other component that calls it again with a *different* options object
 * under the same `id` throws ("Loader must not be called again with
 * different options") and breaks map rendering app-wide until a full page
 * reload. Every component that loads a map (LiveMap, StopMapEditor,
 * RouteReplayMap) must therefore share this exact same `libraries` array —
 * not just an equal-looking one, since it must stay referentially and
 * value-stable across every call site and every render.
 */
export const GOOGLE_MAPS_LOADER_ID = 'school-bus-google-map';
export const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places'];
