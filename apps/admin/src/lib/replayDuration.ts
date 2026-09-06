export interface TimestampedPoint {
  recordedAt: string;
}

/**
 * Minutes between the first and last GPS ping in a replay trail, rounded to
 * the nearest whole minute — or null if there aren't at least two points to
 * measure a span between. Extracted from RouteReplay.tsx so it can be unit
 * tested independent of the map/React rendering.
 */
export function tripDurationMinutes(points: TimestampedPoint[]): number | null {
  if (points.length < 2) return null;
  const startMs = new Date(points[0].recordedAt).getTime();
  const endMs = new Date(points[points.length - 1].recordedAt).getTime();
  return Math.round((endMs - startMs) / 60000);
}
