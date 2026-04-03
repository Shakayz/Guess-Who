import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './en'

// Dynamically import non-English translations only when needed.
// Vite will split each language into its own async chunk (~2-3 KB each).
const loadLanguage = async (lng: string) => {
  const base = lng.split('-')[0] // 'fr-FR' → 'fr'
  if (base === 'en' || i18n.hasResourceBundle(base, 'translation')) return
  try {
    const supported = ['fr', 'ar', 'es', 'it', 'pt', 'zh', 'de']
    if (!supported.includes(base)) return
    const mod = await import(`./${base}`)
    i18n.addResourceBundle(base, 'translation', mod.default, true, true)
  } catch {
    // fallback to English silently
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    partialBundledLanguages: true,
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

// Load the detected language immediately, then re-load on every switch
loadLanguage(i18n.language)
i18n.on('languageChanged', loadLanguage)

export default i18n
