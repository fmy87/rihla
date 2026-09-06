interface OverviewCardProps {
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'critical';
}

const TONE_CLASSES: Record<NonNullable<OverviewCardProps['tone']>, string> = {
  default: 'text-slate-900',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
};

export default function OverviewCard({ label, value, tone = 'default' }: OverviewCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${TONE_CLASSES[tone]}`}>{value}</p>
    </div>
  );
}
