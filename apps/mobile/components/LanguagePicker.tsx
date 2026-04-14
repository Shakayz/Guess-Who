import React, { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native'
import { useTranslation } from 'react-i18next'

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
] as const

export function LanguagePicker() {
  const { i18n, t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0]

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-800/80 border border-neutral-700/50"
        activeOpacity={0.7}
      >
        <Text style={{ fontSize: 14 }}>{current.flag}</Text>
        <Text className="text-white text-xs font-bold uppercase">{current.code}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setVisible(false)}
          className="flex-1 bg-black/60 items-center justify-center"
        >
          <View
            className="bg-neutral-900 rounded-2xl border border-neutral-700 overflow-hidden"
            style={{ width: 280 }}
          >
            <View className="px-5 py-4 border-b border-neutral-800">
              <Text className="text-white font-bold text-base text-center">
                {t('auth.language', { defaultValue: 'Language' })}
              </Text>
            </View>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    i18n.changeLanguage(item.code)
                    setVisible(false)
                  }}
                  className={`flex-row items-center gap-3 px-5 py-3.5 ${item.code === current.code ? 'bg-violet-900/40' : ''}`}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 20 }}>{item.flag}</Text>
                  <Text className="text-white text-sm flex-1">{item.label}</Text>
                  {item.code === current.code && (
                    <View className="w-2 h-2 rounded-full bg-violet-400" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}
