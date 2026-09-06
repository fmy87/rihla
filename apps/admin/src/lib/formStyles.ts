export const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500';
export const labelClass = 'mb-1 block text-sm font-medium text-slate-700';
export const primaryButtonClass =
  'rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60';
export const secondaryButtonClass =
  'rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100';

export function statusBadgeClass(isActive: boolean) {
  return isActive
    ? 'rounded-full bg-status-normal/10 px-2.5 py-1 text-xs font-medium text-status-normal'
    : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500';
}
