// Every frontend setting in one place, read from Vite env variables (see .env.example).
const env = import.meta.env

export const appConfig = Object.freeze({
  title: env.VITE_APP_TITLE || 'BuildWise Admin',
  subtitle: env.VITE_APP_SUBTITLE || 'Platform console',
  apiBaseUrl: (env.VITE_API_BASE_URL || '').replace(/\/+$/, ''),
  // Address patients use for public form links. Empty = this site's own address.
  publicBaseUrl: (env.VITE_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
  locale: env.VITE_LOCALE || 'en-IN',
  toastLifeMs: Number(env.VITE_TOAST_LIFE_MS) || 4000,
  darkMode: (env.VITE_DARK_MODE || 'system').toLowerCase() === 'off' ? false : 'system'
})
