import { appConfig } from '@/config/env'

export function formatEpoch(seconds) {
  if (!seconds) return ''
  return new Date(Number(seconds) * 1000).toLocaleString(appConfig.locale, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

// Mirrors backend app/core/identifiers.py slugify(), so the builder can show the column name.
export function previewColumnName(label, maxLength) {
  let name = String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!name) return null
  if (/^[0-9]/.test(name)) name = `f_${name}`
  return name.slice(0, maxLength).replace(/_+$/, '')
}

export function tenantCodeFromName(name) {
  return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

const pad = (n) => String(n).padStart(2, '0')

// Converts an answer from the form inputs into what the API expects:
// dates as YYYY-MM-DD, times as HH:MM, text trimmed, empty as null.
export function toApiValue(dataType, value) {
  if (value === undefined || value === null) return null
  if (value instanceof Date) {
    return dataType === 'time'
      ? `${pad(value.getHours())}:${pad(value.getMinutes())}`
      : `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  return value
}
