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

// A stored value as text for tables (dates localised, booleans as Yes/No, empty as a dash).
export function displayValue(dataType, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (dataType === 'boolean') return value ? 'Yes' : 'No'
  if (dataType === 'datetime') {
    return new Date(value).toLocaleString(appConfig.locale, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }
  if (dataType === 'date') {
    return new Date(`${value}T00:00:00`).toLocaleDateString(appConfig.locale, {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }
  if (dataType === 'time') return String(value).slice(0, 5)
  return value
}

// A field from the API (public form, or a definition's fields) in the shape FormRenderer uses.
export function rendererField(f) {
  const o = f.options_config || {}
  return {
    key: String(f.id), id: f.id, display_label: f.display_label, data_type: String(f.data_type).toLowerCase(),
    is_mandatory: f.is_mandatory === true || f.is_mandatory === 'Y', max_length: f.max_length,
    placeholder: f.placeholder || '', help_text: f.help_text || '',
    source: f.source || o.source || 'static', options: f.options || o.options || [],
    list_id: o.list_id ?? null, list_slug: f.list_slug ?? null, match_field_id: o.match_field_id ?? null,
    depends_on_field_id: f.depends_on_field_id ?? o.depends_on_field_id ?? null,
    slot: f.slot || null,
    verify_otp: !!(f.verify_otp ?? o.verify_otp)   // public form: confirm the number with a code (S4)
  }
}
