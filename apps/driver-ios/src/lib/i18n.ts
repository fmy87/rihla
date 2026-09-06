import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../../locales/en/common.json';
import enAuth from '../../locales/en/auth.json';
import enDriver from '../../locales/en/driver.json';
import arCommon from '../../locales/ar/common.json';
import arAuth from '../../locales/ar/auth.json';
import arDriver from '../../locales/ar/driver.json';

const LANGUAGE_STORAGE_KEY = 'preferred_language';
const RTL_LANGUAGES = ['ar'];

export async function loadInitialLanguage(): Promise<'en' | 'ar'> {
  const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored === 'en' || stored === 'ar') return stored;
  const deviceLang = Localization.getLocales()[0]?.languageCode;
  return deviceLang === 'ar' ? 'ar' : 'en';
}

/**
 * RTL in React Native requires I18nManager.forceRTL() + an app reload to take
 * full effect (unlike the web, CSS direction alone isn't enough for native
 * layout). Call this from the language switcher and prompt/trigger a reload.
 */
export async function setAppLanguage(lang: 'en' | 'ar') {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  await i18n.changeLanguage(lang);
  const shouldBeRTL = RTL_LANGUAGES.includes(lang);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
    return true; // caller should trigger Updates.reloadAsync()
  }
  return false;
}

export function initI18n(initialLang: 'en' | 'ar') {
  i18n.use(initReactI18next).init({
    resources: {
      en: { common: enCommon, auth: enAuth, driver: enDriver },
      ar: { common: arCommon, auth: arAuth, driver: arDriver },
    },
    lng: initialLang,
    fallbackLng: 'en',
    ns: ['common', 'auth', 'driver'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v3',
  });
  return i18n;
}

export default i18n;
