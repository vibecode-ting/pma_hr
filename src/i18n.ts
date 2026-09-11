/**
 * i18n.ts — Lightweight internationalization helper.
 *
 * Three locales: 'en' (default/fallback), 'my' (Burmese Unicode), 'zh-Hant' (Chinese Traditional).
 * No external library — just flat JSON objects and a t() lookup with 'en' fallback.
 *
 * Usage:
 *   import { t, setLocale, getLocale } from './i18n';
 *   document.getElementById('btn')!.textContent = t('login.submit');
 *   setLocale('my'); // switches all [data-i18n] elements and <html lang>
 *
 * Text nodes tagged with data-i18n="key" are re-rendered automatically on setLocale().
 * For dynamic strings with placeholders, use t('key', { count: 5 }).
 */

import type { Locale } from './types';
import en from './i18n/en.json';
import my from './i18n/my.json';
import zhHant from './i18n/zh-Hant.json';

type TranslationMap = Record<string, string>;

const translations: Record<Locale, TranslationMap> = {
  en: en as TranslationMap,
  my: my as TranslationMap,
  'zh-Hant': zhHant as TranslationMap,
};

const STORAGE_KEY = 'hr_portal_locale';
const SUPPORTED_LOCALES: Locale[] = ['en', 'my', 'zh-Hant'];

let _locale: Locale = 'en';

/**
 * Detect the best locale on first visit, based on browser language settings.
 * Falls back to 'en' if no match.
 */
function detectBrowserLocale(): Locale {
  const lang = navigator.language || '';
  if (lang.startsWith('my')) return 'my';
  if (lang.startsWith('zh')) return 'zh-Hant';
  return 'en';
}

/**
 * Initialize the i18n system: reads from localStorage, falls back to browser detection.
 * Call this once at app startup before rendering anything.
 */
export function initLocale(): void {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  const resolved: Locale =
    stored && SUPPORTED_LOCALES.includes(stored) ? stored : detectBrowserLocale();
  _locale = resolved;
  document.documentElement.lang = resolved;
}

/**
 * Get the current active locale.
 */
export function getLocale(): Locale {
  return _locale;
}

/**
 * Switch to a new locale: updates internal state, localStorage, <html lang>,
 * and re-renders all elements tagged with [data-i18n].
 */
export function setLocale(locale: Locale): void {
  if (!SUPPORTED_LOCALES.includes(locale)) return;
  _locale = locale;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
  applyAll();
  // Dispatch a custom event so other parts of the app can react
  document.dispatchEvent(new CustomEvent('localechange', { detail: { locale } }));
}

/**
 * Look up a translation key in the current locale, falling back to 'en'.
 * Supports simple {placeholder} substitution.
 *
 * @param key     The i18n key, e.g. 'login.submit'
 * @param params  Optional object of placeholder values, e.g. { count: 5 }
 * @returns       The translated string, with placeholders replaced
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const map = translations[_locale];
  const fallback = translations['en'];
  let str: string = map[key] ?? fallback[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }

  return str;
}

/**
 * Apply translations to all [data-i18n] elements in the document.
 * Elements may have:
 *   data-i18n="key"                     → sets textContent
 *   data-i18n-placeholder="key"         → sets placeholder attribute
 *   data-i18n-title="key"               → sets title attribute
 *   data-i18n-aria-label="key"          → sets aria-label attribute
 */
export function applyAll(): void {
  // Text content
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n!;
    el.textContent = t(key);
  });
  // Placeholder attribute (for inputs)
  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder!;
    el.placeholder = t(key);
  });
  // Title attribute (for tooltips)
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle!;
    el.title = t(key);
  });
  // aria-label
  document.querySelectorAll<HTMLElement>('[data-i18n-aria-label]').forEach((el) => {
    const key = el.dataset.i18nAriaLabel!;
    el.setAttribute('aria-label', t(key));
  });
}
