export interface AppLanguage {
  code: string
  label: string
  country: string
}

export const LANGUAGES: AppLanguage[] = [
  { code: 'en', label: 'English', country: 'gb' },
  { code: 'fr', label: 'Français', country: 'fr' },
  { code: 'ar', label: 'العربية', country: 'sa' },
  { code: 'es', label: 'Español', country: 'es' },
  { code: 'it', label: 'Italiano', country: 'it' },
  { code: 'pt', label: 'Português', country: 'br' },
  { code: 'zh', label: '中文', country: 'cn' },
  { code: 'de', label: 'Deutsch', country: 'de' },
  { code: 'ru', label: 'Русский', country: 'ru' },
  { code: 'hi', label: 'हिन्दी', country: 'in' },
]

export const DEFAULT_LANGUAGE = LANGUAGES[0]

export function findLanguage(code: string | undefined | null): AppLanguage {
  if (!code) return DEFAULT_LANGUAGE
  const base = code.split('-')[0]
  return LANGUAGES.find((l) => l.code === base) ?? DEFAULT_LANGUAGE
}
