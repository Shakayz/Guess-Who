import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import en from './en'
import fr from './fr'
import ar from './ar'
import es from './es'
import it from './it'
import pt from './pt'
import zh from './zh'
import de from './de'

// All translations bundled directly — avoids async race conditions on language switch.
// Total overhead is ~30 KB, well within acceptable range for a game app.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ar: { translation: ar },
      es: { translation: es },
      it: { translation: it },
      pt: { translation: pt },
      zh: { translation: zh },
      de: { translation: de },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  })

export default i18n
