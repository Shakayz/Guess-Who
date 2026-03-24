import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@imposter/shared/i18n/en'
import fr from '@imposter/shared/i18n/fr'
import ar from '@imposter/shared/i18n/ar'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      ar: { translation: ar },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
