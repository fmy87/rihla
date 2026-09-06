import { supabase } from '../supabaseClient';

export type NotConfirmedReason = 'student_absent' | 'parent_cancelled' | 'student_not_ready' | 'wrong_location' | 'other';

export interface ConfirmedEventInfo {
  occurredAt: string;
}

/** Returns the existing pickup/dropoff event for an assignment, if one exists — used for the duplicate-confirmation guard. */
export async function fetchExistingEvent(
  assignmentId: string,
  eventType: 'pickup' | 'dropoff'
): Promise<ConfirmedEventInfo | null> {
  const table = eventType === 'pickup' ? 'pickup_events' : 'dropoff_events';
  const { data } = await supabase
    .from(table)
    .select('occurred_at')
    .eq('daily_student_assignment_id', assignmentId)
    .maybeSingle();
  return data ? { occurredAt: data.occurred_at } : null;
}

/**
 * Records a real pickup or drop-off: inserts the immutable event row, then
 * updates the assignment's status. `location` is omitted here — GPS capture
 * lands with Phase 8; recording without it is honest about what's real today
 * rather than sending a fabricated coordinate.
 */
export async function confirmEvent(
  assignmentId: string,
  driverId: string,
  eventType: 'pickup' | 'dropoff'
) {
  const table = eventType === 'pickup' ? 'pickup_events' : 'dropoff_events';
  const { error: eventError } = await supabase.from(table).insert({
    daily_student_assignment_id: assignmentId,
    driver_id: driverId,
  });
  if (eventError) return { error: eventError.message };

  const { error: statusError } = await supabase
    .from('daily_student_assignments')
    .update({ status: eventType === 'pickup' ? 'picked_up' : 'dropped_off' })
    .eq('id', assignmentId);
  if (statusError) return { error: statusError.message };

  return { error: null };
}

export async function markNotConfirmed(assignmentId: string, reason: NotConfirmedReason, notes?: string) {
  return supabase
    .from('daily_student_assignments')
    .update({
      status: reason === 'student_absent' ? 'absent' : reason === 'parent_cancelled' ? 'cancelled' : 'not_confirmed',
      not_confirmed_reason: reason,
      notes: notes ?? null,
    })
    .eq('id', assignmentId);
}

/**
 * Marks a stop "arrived" once every non-skipped assignment at it has been
 * resolved (any status besides pending) — this drives the completed/current/
 * upcoming progression on the Route screen. Geofence-based automatic arrival
 * detection replaces/augments this once GPS lands in Phase 8; until then,
 * resolving every student at a stop IS how the driver marks it done.
 */
export async function markStopArrivedIfResolved(dailyRouteStopId: string) {
  const { data: assignments } = await supabase
    .from('daily_student_assignments')
    .select('status')
    .eq('daily_route_stop_id', dailyRouteStopId);

  if (!assignments || assignments.length === 0) return;
  const allResolved = assignments.every((a) => a.status !== 'pending');
  if (!allResolved) return;

  await supabase
    .from('daily_route_stops')
    .update({ arrived_at: new Date().toISOString() })
    .eq('id', dailyRouteStopId)
    .is('arrived_at', null);
}

export async function skipStop(dailyRouteStopId: string, reason: string) {
  return supabase
    .from('daily_route_stops')
    .update({ is_skipped: true, skipped_reason: reason, arrived_at: new Date().toISOString() })
    .eq('id', dailyRouteStopId);
}

export interface RouteCompletionSummary {
  pickedUp: number;
  droppedOff: number;
  pending: number;
  total: number;
}

export async function fetchRouteCompletionSummary(dailyRouteId: string): Promise<RouteCompletionSummary> {
  const { data } = await supabase
    .from('daily_student_assignments')
    .select('status, daily_route_stops!inner(daily_route_id)')
    .eq('daily_route_stops.daily_route_id', dailyRouteId);

  const rows = data ?? [];
  return {
    pickedUp: rows.filter((r) => r.status === 'picked_up').length,
    droppedOff: rows.filter((r) => r.status === 'dropped_off').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    total: rows.length,
  };
}

/** Blocked client-side (and left to the driver to resolve) if any assignment is still pending — per the "no casual completion" requirement. */
export async function completeRoute(dailyRouteId: string) {
  const summary = await fetchRouteCompletionSummary(dailyRouteId);
  if (summary.pending > 0) {
    return { error: 'pending_students', summary };
  }
  const { error } = await supabase
    .from('daily_routes')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', dailyRouteId);
  return { error: error ? error.message : null, summary };
}
