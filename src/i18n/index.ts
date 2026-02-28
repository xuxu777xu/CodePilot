import en, { type TranslationKey } from './en';
import zh from './zh';

export type { TranslationKey };

export type Locale = 'en' | 'zh';

/**
 * Module-level locale state, kept in sync with I18nProvider via setCurrentLocale().
 * Allows non-React code (singletons, utility functions) to use the user-chosen locale.
 */
let currentLocale: Locale | null = null;

/** Called by I18nProvider whenever the locale changes. */
export function setCurrentLocale(locale: Locale): void {
  currentLocale = locale;
}

/** Returns the active locale — prefers the UI-set value, falls back to navigator detection. */
export function detectLocale(): Locale {
  if (currentLocale) return currentLocale;
  if (typeof navigator !== 'undefined' && navigator.language.startsWith('zh')) return 'zh';
  return 'en';
}

export const SUPPORTED_LOCALES: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
];

const dictionaries: Record<Locale, Record<TranslationKey, string>> = {
  en,
  zh,
};

/**
 * Translate a key with optional parameter interpolation.
 * Fallback chain: target locale → English → raw key.
 */
export function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale] ?? en;
  let text = dict[key] ?? en[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}
