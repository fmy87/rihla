export interface ProgressStop {
  id: string;
  sequence: number;
  arrivedAt: string | null;
  isSkipped: boolean;
}

export type StopProgressState = 'completed' | 'current' | 'upcoming';

/** A stop is "completed" once arrived_at is set, "current" is the first
 * unresolved, non-skipped stop in sequence, everything else is "upcoming". */
export function stopProgressState(stop: ProgressStop, allStops: ProgressStop[]): StopProgressState {
  if (stop.arrivedAt) return 'completed';
  const ordered = [...allStops].sort((a, b) => a.sequence - b.sequence);
  const firstIncomplete = ordered.find((s) => !s.arrivedAt && !s.isSkipped);
  return firstIncomplete?.id === stop.id ? 'current' : 'upcoming';
}

/** The stop the driver should be acting on right now, or null if the route is done/not started. */
export function findCurrentStop<T extends ProgressStop>(stops: T[]): T | null {
  const ordered = [...stops].sort((a, b) => a.sequence - b.sequence);
  return ordered.find((s) => !s.arrivedAt && !s.isSkipped) ?? null;
}
