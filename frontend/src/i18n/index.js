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

// Maps our app language codes to the BCP-47 locale we hand Intl.NumberFormat so
// numbers render the way each language writes them. Two things vary: the digits
// themselves (Hindi & Nepali use Devanagari — ०१२…९ — which requires the explicit
// `-u-nu-deva` numbering-system extension; the locale alone still yields Latin
// digits) and the grouping/decimal separators (e.g. fr "12 480", es "12.480").
// Anything not listed falls back to the raw code, then to English formatting.
const NUMBER_LOCALES = {
  en: 'en-US',
  es: 'es',
  zh: 'zh-CN',
  tl: 'fil',
  vi: 'vi',
  fr: 'fr',
  ko: 'ko',
  ru: 'ru',
  ht: 'fr-HT', // Haitian Creole has no CLDR number data; French (Haiti) matches usage.
  hi: 'hi-IN-u-nu-deva',
  ne: 'ne-NP-u-nu-deva',
};

// Cache formatters — building an Intl.NumberFormat per interpolation is wasteful
// and this runs on every rendered number.
const numberFormatters = {};
const formatNumber = (value, lng) => {
  const locale = NUMBER_LOCALES[lng] || lng || 'en-US';
  if (!numberFormatters[locale]) {
    try {
      numberFormatters[locale] = new Intl.NumberFormat(locale);
    } catch {
      // An unrecognized locale string throws; fall back to English so a bad
      // code never crashes rendering.
      numberFormatters[locale] = new Intl.NumberFormat('en-US');
    }
  }
  return numberFormatters[locale].format(value);
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
    // Route EVERY interpolation through the formatter (not just ones written as
    // "{{x, number}}"), so we can localize numbers app-wide without editing each
    // string. See the interpolator override below for what that formatting does.
    alwaysFormat: true,
  },
});

// Localize every interpolated number ({{count}}, {{pct}}, {{miles}}, …) to the
// active language: Devanagari digits for Hindi/Nepali, locale-correct grouping
// and separators for the rest (fr "12 480", es "12.480").
//
// Why override the interpolator here instead of passing `format` to init():
// i18next v21+ replaces interpolation.format with its own formatter service on
// init, so a `format` option is silently dropped. We wrap that service instead —
// bare numbers get our locale formatting; anything with an explicit format
// (e.g. "{{x, number}}") still goes to the built-in formatter; non-numbers
// (names, phone numbers stored as literal text) pass through untouched.
const builtinFormatter = i18n.services.formatter;
i18n.services.interpolator.format = (value, format, lng, options) => {
  if (typeof value === 'number' && !format) return formatNumber(value, lng);
  if (format) return builtinFormatter.format(value, format, lng, options);
  return value;
};

export default i18n;
