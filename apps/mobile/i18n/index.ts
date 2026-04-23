import 'intl-pluralrules'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'
import en from '@red-handed/shared/i18n/en'
import fr from '@red-handed/shared/i18n/fr'
import ar from '@red-handed/shared/i18n/ar'
import es from './es'
import it from './it'
import pt from './pt'
import zh from './zh'
import de from './de'
import ru from './ru'
import hi from './hi'
import { LANGUAGES } from './languages'

const SUPPORTED = new Set(LANGUAGES.map((l) => l.code))

// Pick the device's preferred language on first launch. `getLocales()` is
// ordered by the user's preference list (e.g. iOS: Settings → Language),
// so we walk it top-to-bottom and take the first one we ship a pack for.
// Falls back to 'en' if nothing matches — keeps behaviour deterministic
// when the device reports an exotic locale like 'sw' or 'fi'.
export function detectDeviceLanguage(): string {
  try {
    const locales = Localization.getLocales()
    for (const l of locales) {
      const base = (l.languageCode ?? '').toLowerCase()
      if (base && SUPPORTED.has(base)) return base
    }
  } catch {
    // Localization can throw on some Android configs; just fall through.
  }
  return 'en'
}

const detectedLanguage = detectDeviceLanguage()

i18n
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
      ru: { translation: ru },
      hi: { translation: hi },
    },
    lng: detectedLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
