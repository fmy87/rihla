/**
 * Returns the device's LOCAL calendar date as YYYY-MM-DD.
 *
 * `new Date().toISOString().slice(0, 10)` — used here before this helper
 * existed — is a real bug: toISOString() converts to UTC first, so for any
 * timezone ahead of UTC (e.g. Oman, UTC+4, which this whole system targets)
 * it returns the wrong calendar date for a multi-hour window every night.
 * This matters most here: it's what decides which `daily_routes` row a
 * driver sees as "today's route". The device's own local date getters are
 * what we want — the driver's iPad is physically at the school.
 */
export function localDateOnly(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
