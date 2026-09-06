import { useTranslation } from 'react-i18next';
import AppLayout from '../components/AppLayout';

interface PlaceholderPageProps {
  titleKey: string;
  phaseLabel: string;
}

export default function PlaceholderPage({ titleKey, phaseLabel }: PlaceholderPageProps) {
  const { t } = useTranslation('common');

  return (
    <AppLayout>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">{t(`nav.${titleKey}`)}</h1>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
        This screen ships in {phaseLabel}. Not yet implemented — intentionally, not a broken button.
      </div>
    </AppLayout>
  );
}
