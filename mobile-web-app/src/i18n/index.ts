/**
 * i18next internationalization setup for Kissan Rehnuma.
 *
 * Supports: English (en), Urdu (ur), Sindhi (sd)
 *
 * Translations are pre-generated from en.json using Azure Translator API
 * via the translate_strings.py script. At runtime, i18next loads the
 * appropriate JSON file based on the user's saved language preference.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation JSON files
import en from './en.json';
import ur from './ur.json';
import sd from './sd.json';

export const SUPPORTED_LANGUAGES = ['en', 'ur', 'sd'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Map language code to display name (used in Settings).
 */
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  ur: 'اردو',
  sd: 'سنڌي',
};

/**
 * Whether a language is RTL (right-to-left).
 */
export function isRTL(lang: string): boolean {
  return lang === 'ur' || lang === 'sd';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
    sd: { translation: sd },
  },
  lng: 'en', // default — App.tsx will call changeLanguage() after loading saved preference
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already handles escaping
  },
  compatibilityJSON: 'v4',
});

export default i18n;
