import { expect } from '@playwright/test'

// Unique names so tests never collide, even when run repeatedly.
export function unique(label) {
  return `${label} ${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
}

export const linkName = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

// ---- API helpers (used by API tests and to set up UI tests) ----

export async function ok(response, expectedStatus) {
  const body = await response.json()
  expect(response.status(), JSON.stringify(body)).toBe(expectedStatus)
  return body
}

export async function createTenant(request, name) {
  return (await ok(await request.post('/v1/tenants', { data: { name } }), 201)).tenant
}

export async function createForm(request, tenantCode, displayName, extra = {}) {
  const res = await request.post(`/v1/tenants/${tenantCode}/forms`, { data: { display_name: displayName, ...extra } })
  return (await ok(res, 201)).form
}

export const formUrl = (tenantCode, slug) => `/v1/tenants/${tenantCode}/forms/${slug}`

export async function saveFields(request, tenantCode, slug, fields, extra = {}) {
  const res = await request.put(formUrl(tenantCode, slug), { data: { fields, ...extra } })
  return (await ok(res, 200)).form
}

export async function publish(request, tenantCode, slug) {
  return ok(await request.post(`${formUrl(tenantCode, slug)}/publish`), 200)
}

// Turns saved fields back into the payload shape (keeps ids so nothing is removed).
export function asPayload(savedFields) {
  return savedFields.map((f) => ({
    id: f.id,
    display_label: f.display_label,
    data_type: f.data_type,
    is_mandatory: f.is_mandatory === 'Y',
    max_length: f.max_length,
    placeholder: f.placeholder,
    help_text: f.help_text,
    options_config: f.options_config
  }))
}

export const BOOKING_FIELDS = [
  { display_label: 'Patient Name', data_type: 'string', is_mandatory: true, max_length: 50 },
  { display_label: 'Phone', data_type: 'phone', is_mandatory: true },
  { display_label: 'Email', data_type: 'email' },
  { display_label: 'Visit Date', data_type: 'date', is_mandatory: true },
  { display_label: 'Visit Time', data_type: 'time' },
  { display_label: 'Gender', data_type: 'dropdown', options_config: { source: 'static', options: ['Male', 'Female'] } },
  { display_label: 'Doctor', data_type: 'dropdown', is_mandatory: true, options_config: { source: 'doctors' } },
  { display_label: 'Age', data_type: 'integer' },
  { display_label: 'Weight', data_type: 'number' },
  { display_label: 'Consent', data_type: 'boolean', is_mandatory: true },
  { display_label: 'Notes', data_type: 'text' }
]
