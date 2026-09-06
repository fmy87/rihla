import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  return (
    <select
      aria-label={t('language.label')}
      className="field"
      style={{ width: 'auto', marginBottom: 0 }}
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
    >
      <option value="en">{t('language.en')}</option>
      <option value="ar">{t('language.ar')}</option>
    </select>
  );
}
