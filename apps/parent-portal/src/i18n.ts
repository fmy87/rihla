import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/portal.json';
import ar from './locales/ar/portal.json';

export const RTL_LANGUAGES = ['ar'];

export function applyDirection(language: string) {
  document.documentElement.dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
  document.documentElement.lang = language;
}

const initialLanguage = localStorage.getItem('rihla_parent_language') || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { portal: en },
    ar: { portal: ar },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  ns: ['portal'],
  defaultNS: 'portal',
  interpolation: { escapeValue: false },
});

applyDirection(initialLanguage);

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('rihla_parent_language', lng);
  applyDirection(lng);
});

export default i18n;
