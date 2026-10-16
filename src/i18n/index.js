// Minimal i18n: reactive locale, t(key, params) with {placeholder} interpolation,
// fallback to English, persisted choice, browser language as default.
import { ref, watchEffect } from 'vue'
import de from './de.js'
import en from './en.js'
import fr from './fr.js'
import it from './it.js'

export const MESSAGES = { de, en, fr, it }
export const LOCALES = [
  { code: 'de', label: 'Deutsch', short: 'DE' },
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'it', label: 'Italiano', short: 'IT' },
  { code: 'en', label: 'English', short: 'EN' },
]
const KEY = 'adgen.locale'

function detect() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && MESSAGES[saved]) return saved
  } catch { /* ignore */ }
  for (const l of navigator.languages || [navigator.language || 'en']) {
    const code = String(l).slice(0, 2).toLowerCase()
    if (MESSAGES[code]) return code
  }
  return 'en'
}

export const locale = ref(detect())

export function setLocale(code) {
  if (!MESSAGES[code]) return
  locale.value = code
  try { localStorage.setItem(KEY, code) } catch { /* ignore */ }
}

watchEffect(() => {
  if (typeof document !== 'undefined') document.documentElement.lang = locale.value
})

const lookup = (dict, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict)

/** t('pdf.title'), t('toast.saved', { size: 12 }) */
export function t(key, params) {
  let s = lookup(MESSAGES[locale.value], key) ?? lookup(en, key) ?? key
  if (params) s = s.replace(/\{(\w+)\}/g, (m, p) => (params[p] ?? m))
  return s
}

/** Locale-aware number/date helpers */
export const fmtDate = (ts) => new Date(ts).toLocaleString(`${locale.value}-CH`, { dateStyle: 'medium', timeStyle: 'short' })
