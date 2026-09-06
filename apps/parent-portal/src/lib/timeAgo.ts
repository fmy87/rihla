/**
 * Formats a duration in seconds as a compact "Xs"/"Xm"/"Xh" label — the pure
 * part of App.tsx's timeAgo() helper, split out so it can be unit tested
 * without pulling in React or react-i18next (the caller wraps this in the
 * translated "Bus last seen {{time}}" string).
 */
export function compactDurationLabel(seconds: number): string {
  const clamped = Math.max(0, seconds);
  if (clamped < 60) return `${clamped}s`;
  if (clamped < 3600) return `${Math.round(clamped / 60)}m`;
  return `${Math.round(clamped / 3600)}h`;
}

/** Seconds elapsed between `iso` and now — null passes through as null. */
export function secondsSince(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
}
