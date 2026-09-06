import { supabase } from '../supabaseClient';
import { localDateOnly } from '../date';

export type RouteDirection = 'home_to_school' | 'school_to_home';
export type StopEventType = 'pickup' | 'dropoff';

export interface RouteListItem {
  id: string;
  name_en: string;
  name_ar: string | null;
  direction: 'home_to_school' | 'school_to_home';
  bus_number: string | null;
  driver_name: string | null;
  is_active: boolean;
  stop_count: number;
}

export interface RouteInput {
  name_en: string;
  name_ar?: string | null;
  direction: 'home_to_school' | 'school_to_home';
  default_bus_id?: string | null;
  default_driver_id?: string | null;
  /** Encoded Directions API polyline for the road-snapped path through this
   *  route's stops — see migration 0014 and StopMapEditor's directions callback. */
  road_polyline?: string | null;
}

export async function fetchRoutes(schoolId: string): Promise<RouteListItem[]> {
  const { data, error } = await supabase
    .from('routes')
    .select('id, name_en, name_ar, direction, is_active, buses(bus_number), drivers(full_name), route_stops(id)')
    .eq('school_id', schoolId)
    .order('name_en', { ascending: true });

  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id,
    name_en: r.name_en,
    name_ar: r.name_ar,
    direction: r.direction,
    // @ts-expect-error -- joined fields, typed properly once `supabase gen types` runs
    bus_number: r.buses?.bus_number ?? null,
    // @ts-expect-error -- see above
    driver_name: r.drivers?.full_name ?? null,
    is_active: r.is_active,
    stop_count: r.route_stops?.length ?? 0,
  }));
}

export async function createRoute(schoolId: string, input: RouteInput) {
  return supabase.from('routes').insert({ school_id: schoolId, ...input }).select('id').single();
}

export async function updateRoute(routeId: string, input: Partial<RouteInput> & { is_active?: boolean }) {
  return supabase.from('routes').update(input).eq('id', routeId);
}

export interface RouteStopRow {
  id: string;
  route_id: string;
  sequence: number;
  name_en: string;
  name_ar: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  estimated_arrival_time: string | null;
  stop_type: 'pickup' | 'dropoff';
  geofence_radius_meters: number | null;
  notes: string | null;
}

export async function fetchRoute(routeId: string) {
  return supabase
    .from('routes')
    .select('id, school_id, name_en, name_ar, direction, default_bus_id, default_driver_id, is_active')
    .eq('id', routeId)
    .single();
}

export async function fetchRouteStops(routeId: string): Promise<RouteStopRow[]> {
  const { data, error } = await supabase
    .from('route_stops_with_coords')
    .select('*')
    .eq('route_id', routeId)
    .order('sequence', { ascending: true });
  if (error || !data) return [];
  return data as RouteStopRow[];
}

export interface StopInput {
  name_en: string;
  name_ar?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
  map_place_id?: string | null;
  estimated_arrival_time?: string | null;
  stop_type: 'pickup' | 'dropoff';
  geofence_radius_meters?: number | null;
  notes?: string | null;
}

export async function createStop(routeId: string, sequence: number, input: StopInput) {
  return supabase
    .from('route_stops')
    .insert({
      route_id: routeId,
      sequence,
      name_en: input.name_en,
      name_ar: input.name_ar,
      address: input.address,
      location: `POINT(${input.longitude} ${input.latitude})`,
      map_place_id: input.map_place_id,
      estimated_arrival_time: input.estimated_arrival_time,
      stop_type: input.stop_type,
      geofence_radius_meters: input.geofence_radius_meters,
      notes: input.notes,
    })
    .select('id')
    .single();
}

export async function updateStop(
  stopId: string,
  input: Partial<StopInput>
) {
  const payload: Record<string, unknown> = { ...input };
  if (input.latitude !== undefined && input.longitude !== undefined) {
    payload.location = `POINT(${input.longitude} ${input.latitude})`;
    delete payload.latitude;
    delete payload.longitude;
  }
  return supabase.from('route_stops').update(payload).eq('id', stopId);
}

export async function deleteStop(stopId: string) {
  return supabase.from('route_stops').delete().eq('id', stopId);
}

/** Persists a new stop order after a drag/move — sequence must stay 1-based and contiguous. */
export async function reorderStops(stops: { id: string; sequence: number }[]) {
  // route_stops has a unique(route_id, sequence) constraint, so a naive
  // ordered update can collide mid-batch (e.g. swapping 1<->2). Shift
  // everything to a temporary negative range first, then apply final values.
  await Promise.all(stops.map((s, i) => supabase.from('route_stops').update({ sequence: -(i + 1) }).eq('id', s.id)));
  await Promise.all(stops.map((s) => supabase.from('route_stops').update({ sequence: s.sequence }).eq('id', s.id)));
}

export interface StopStudentAssignment {
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
}

export async function fetchStopAssignments(stopId: string): Promise<StopStudentAssignment[]> {
  const { data, error } = await supabase
    .from('student_route_assignments')
    .select('id, student_id, students(name_en, student_code)')
    .eq('stop_id', stopId)
    .eq('is_active', true);
  if (error || !data) return [];
  return data.map((row) => ({
    assignmentId: row.id,
    studentId: row.student_id,
    // @ts-expect-error -- joined field
    studentName: row.students?.name_en ?? '—',
    // @ts-expect-error -- joined field
    studentCode: row.students?.student_code ?? '—',
  }));
}

/** Active assignment for a student on ANY route, if one exists — used for the duplicate-assignment warning. */
export async function findExistingAssignment(studentId: string) {
  return supabase
    .from('student_route_assignments')
    .select('id, route_id, routes(name_en)')
    .eq('student_id', studentId)
    .eq('is_active', true)
    .maybeSingle();
}

export async function assignStudentToStop(studentId: string, routeId: string, stopId: string) {
  return supabase.from('student_route_assignments').insert({ student_id: studentId, route_id: routeId, stop_id: stopId });
}

export async function reassignStudent(assignmentId: string, routeId: string, stopId: string) {
  return supabase.from('student_route_assignments').update({ route_id: routeId, stop_id: stopId }).eq('id', assignmentId);
}

export async function unassignStudent(assignmentId: string) {
  return supabase.from('student_route_assignments').delete().eq('id', assignmentId);
}

/** Generates (or returns the existing) daily_routes instance for today from this master route. */
export async function generateDailyRouteForToday(routeId: string) {
  const today = localDateOnly();
  return supabase.rpc('generate_daily_route', { p_route_id: routeId, p_service_date: today });
}
