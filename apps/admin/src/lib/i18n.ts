import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../../locales/en/common.json';
import enAuth from '../../locales/en/auth.json';
import enDashboard from '../../locales/en/dashboard.json';
import enBuses from '../../locales/en/buses.json';
import enDrivers from '../../locales/en/drivers.json';
import enStudents from '../../locales/en/students.json';
import enUsers from '../../locales/en/users.json';
import enRoutes from '../../locales/en/routes.json';
import enOperations from '../../locales/en/operations.json';
import enAttendance from '../../locales/en/attendance.json';

import arCommon from '../../locales/ar/common.json';
import arAuth from '../../locales/ar/auth.json';
import arDashboard from '../../locales/ar/dashboard.json';
import arBuses from '../../locales/ar/buses.json';
import arDrivers from '../../locales/ar/drivers.json';
import arStudents from '../../locales/ar/students.json';
import arUsers from '../../locales/ar/users.json';
import arRoutes from '../../locales/ar/routes.json';
import arOperations from '../../locales/ar/operations.json';
import arAttendance from '../../locales/ar/attendance.json';

export const RTL_LANGUAGES = ['ar'];

export function applyDirection(lang: string) {
  const dir = RTL_LANGUAGES.includes(lang) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lang;
}

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      auth: enAuth,
      dashboard: enDashboard,
      buses: enBuses,
      drivers: enDrivers,
      students: enStudents,
      users: enUsers,
      routes: enRoutes,
      operations: enOperations,
      attendance: enAttendance,
    },
    ar: {
      common: arCommon,
      auth: arAuth,
      dashboard: arDashboard,
      buses: arBuses,
      drivers: arDrivers,
      students: arStudents,
      users: arUsers,
      routes: arRoutes,
      operations: arOperations,
      attendance: arAttendance,
    },
  },
  lng: localStorage.getItem('preferred_language') || 'en',
  fallbackLng: 'en',
  ns: ['common', 'auth', 'dashboard', 'buses', 'drivers', 'students', 'users', 'routes', 'operations', 'attendance'],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  applyDirection(lng);
  localStorage.setItem('preferred_language', lng);
});

// Apply on initial load too (languageChanged doesn't fire for the initial lng).
applyDirection(i18n.language);

export default i18n;
