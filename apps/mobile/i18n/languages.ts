export interface AppLanguage {
  code: string
  label: string
  country: string
  flag: string
}

export const LANGUAGES: AppLanguage[] = [
  { code: 'en', label: 'English',  country: 'gb', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', country: 'fr', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية',  country: 'sa', flag: '🇸🇦' },
  { code: 'es', label: 'Español',  country: 'es', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', country: 'it', flag: '🇮🇹' },
  { code: 'pt', label: 'Português',country: 'br', flag: '🇧🇷' },
  { code: 'zh', label: '中文',      country: 'cn', flag: '🇨🇳' },
  { code: 'de', label: 'Deutsch',  country: 'de', flag: '🇩🇪' },
  { code: 'ru', label: 'Русский',  country: 'ru', flag: '🇷🇺' },
  { code: 'hi', label: 'हिन्दी',     country: 'in', flag: '🇮🇳' },
]

export const DEFAULT_LANGUAGE = LANGUAGES[0]

export function findLanguage(code: string | undefined | null): AppLanguage {
  if (!code) return DEFAULT_LANGUAGE
  const base = code.split('-')[0]
  return LANGUAGES.find((l) => l.code === base) ?? DEFAULT_LANGUAGE
}
