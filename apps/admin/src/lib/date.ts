/**
 * Returns the device's LOCAL calendar date as YYYY-MM-DD.
 *
 * `new Date().toISOString().slice(0, 10)` — used in a few places before this
 * helper existed — is a real bug, not a style choice: toISOString() always
 * converts to UTC first, so for any timezone ahead of UTC (e.g. Oman,
 * UTC+4) it returns the WRONG calendar date for a multi-hour window every
 * night (local date has already rolled over to the next day while the UTC
 * date hasn't yet). Since this app assumes the admin/driver's device
 * timezone matches the school's operating timezone (a safe assumption —
 * they're using the app from the school's city), the device's own local
 * date getters are what we actually want here, not a UTC conversion.
 */
export function localDateOnly(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight today → local midnight tomorrow, expressed as UTC ISO instants — correct for filtering timestamptz columns (e.g. alerts.created_at) by "today" in local terms. */
export function localDayBoundsISO(date: Date = new Date()): { startISO: string; endISO: string } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}
