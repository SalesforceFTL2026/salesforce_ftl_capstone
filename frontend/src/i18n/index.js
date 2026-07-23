// i18next configuration for the app's UI language switching.
//
// How it works, in plain terms:
//   - Each JSON file (en/es/…) is a dictionary: a translation key -> text.
//   - Components call t('some.key') to look up the text for the ACTIVE language.
//   - Changing the language (i18n.changeLanguage) tells i18next to read a
//     different dictionary; React re-renders and the UI appears translated.
//   - Any key we haven't translated falls back to English automatically.
//
// This mirrors the ThemeContext (dark mode) pattern, but for language.
//
// NOTE: the non-English dictionaries are first-draft (machine-assisted)
// translations. Safety-critical strings (the "safety" namespace especially)
// should be reviewed by a native speaker before being relied on in production.

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './en.json';
import es from './es.json';
import zh from './zh.json';
import tl from './tl.json';
import vi from './vi.json';
import fr from './fr.json';
import ko from './ko.json';
import ru from './ru.json';
import ht from './ht.json';
import hi from './hi.json';
import ne from './ne.json';

// The languages we actually ship translations for. Keep in sync with the
// backend's VALID_LANGUAGES (authController.js). US top-spoken languages plus
// Hindi & Nepali; Arabic is deferred until right-to-left (RTL) layout support
// is added.
export const SUPPORTED_LANGUAGES = ['en', 'es', 'zh', 'tl', 'vi', 'fr', 'ko', 'ru', 'ht', 'hi', 'ne'];

// Where we remember the user's choice on this device, so a page refresh keeps
// the language even before the backed-up profile preference loads.
const STORAGE_KEY = 'language';

// Read the saved language, defaulting to English if none/invalid.
export const getStoredLanguage = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LANGUAGES.includes(saved) ? saved : 'en';
};

// Change the active UI language and remember it on this device.
export const setLanguage = (lang) => {
  const next = SUPPORTED_LANGUAGES.includes(lang) ? lang : 'en';
  localStorage.setItem(STORAGE_KEY, next);
  return i18n.changeLanguage(next);
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    zh: { translation: zh },
    tl: { translation: tl },
    vi: { translation: vi },
    fr: { translation: fr },
    ko: { translation: ko },
    ru: { translation: ru },
    ht: { translation: ht },
    hi: { translation: hi },
    ne: { translation: ne },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  interpolation: {
    // React already escapes values, so i18next doesn't need to.
    escapeValue: false,
  },
});

export default i18n;
