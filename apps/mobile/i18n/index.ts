import 'intl-pluralrules'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
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
    lng: 'en',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })

export default i18n
