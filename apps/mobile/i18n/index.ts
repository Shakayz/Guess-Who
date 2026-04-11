import 'intl-pluralrules'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@imposter/shared/i18n/en'
import fr from '@imposter/shared/i18n/fr'
import ar from '@imposter/shared/i18n/ar'
import es from './es'
import it from './it'
import pt from './pt'
import zh from './zh'

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
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
