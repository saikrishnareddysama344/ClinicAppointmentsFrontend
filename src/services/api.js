// All backend endpoints, grouped by area. Views never build URLs themselves.
// Tenants are addressed by their code; forms, lists and schedules by their link name (slug).
import { request } from './http'
import { appConfig } from '@/config/env'

const enc = encodeURIComponent

// ?a=1&b=2, skipping empty values.
export const qs = (params = {}) => {
  const pairs = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  return pairs.length ? `?${new URLSearchParams(pairs)}` : ''
}

export const tenantsApi = {
  list: () => request('GET', '/v1/tenants'),
  get: (tenantCode) => request('GET', `/v1/tenants/${enc(tenantCode)}`),
  create: (payload) => request('POST', '/v1/tenants', payload)
}

// Forms and lists share the same endpoints; only the path and the name of their rows differ.
export const KINDS = Object.freeze({
  form: { path: 'forms', rows: 'submissions', label: 'Form', plural: 'Forms' },
  list: { path: 'lists', rows: 'rows', label: 'List', plural: 'Lists' }
})

function definitionsApi(kind) {
  const { path, rows } = KINDS[kind]
  const base = (t) => `/v1/tenants/${enc(t)}/${path}`
  const one = (t, slug) => `${base(t)}/${enc(slug)}`
  return {
    list: (t) => request('GET', base(t)),
    create: (t, payload) => request('POST', base(t), payload),
    get: (t, slug) => request('GET', one(t, slug)),
    save: (t, slug, payload) => request('PUT', one(t, slug), payload),
    remove: (t, slug) => request('DELETE', one(t, slug)),
    publish: (t, slug) => request('POST', `${one(t, slug)}/publish`),
    updateShare: (t, slug, payload) => request('PUT', `${one(t, slug)}/share`, payload),
    rows: (t, slug, params) => request('GET', `${one(t, slug)}/${rows}${qs(params)}`),
    addRow: (t, slug, values) => request('POST', `${one(t, slug)}/${rows}`, { values }),
    updateRow: (t, slug, id, values) => request('PUT', `${one(t, slug)}/${rows}/${id}`, { values }),
    setRowStatus: (t, slug, id, active) => request('PUT', `${one(t, slug)}/${rows}/${id}/status`, { active }),
    options: (t, slug, params) => request('GET', `${one(t, slug)}/options${qs(params)}`),
    // Plain link: the browser downloads the file itself.
    csvUrl: (t, slug) => `${appConfig.apiBaseUrl}${one(t, slug)}/${rows}.csv`
  }
}

export const definitionApis = { form: definitionsApi('form'), list: definitionsApi('list') }
export const formsApi = definitionApis.form
export const listsApi = definitionApis.list

export const schedulesApi = (() => {
  const base = (t) => `/v1/tenants/${enc(t)}/schedules`
  const one = (t, slug) => `${base(t)}/${enc(slug)}`
  return {
    list: (t) => request('GET', base(t)),
    create: (t, payload) => request('POST', base(t), payload),
    get: (t, slug) => request('GET', one(t, slug)),
    update: (t, slug, payload) => request('PUT', one(t, slug), payload),
    windows: (t, slug) => request('GET', `${one(t, slug)}/windows`),
    saveWindow: (t, slug, payload, id) =>
      request(id ? 'PUT' : 'POST', `${one(t, slug)}/windows${id ? `/${id}` : ''}`, payload),
    leaves: (t, slug, params) => request('GET', `${one(t, slug)}/leaves${qs(params)}`),
    addLeave: (t, slug, payload) => request('POST', `${one(t, slug)}/leaves`, payload),
    // part: 'windows' | 'leaves'
    setStatus: (t, slug, part, id, active) => request('PUT', `${one(t, slug)}/${part}/${id}/status`, { active }),
    bookings: (t, slug, params) => request('GET', `${one(t, slug)}/bookings${qs(params)}`),
    cancelBooking: (t, slug, id) => request('PUT', `${one(t, slug)}/bookings/${id}/cancel`)
  }
})()

export const publicApi = (() => {
  const base = (t, slug) => `/v1/public/${enc(t)}/${enc(slug)}`
  return {
    getForm: (t, slug) => request('GET', base(t, slug)),
    submit: (t, slug, payload) => request('POST', `${base(t, slug)}/submissions`, payload),
    // List dropdowns: {depends_value}. Appointment slots: {part: 'where' | 'who', where_id}.
    options: (t, slug, fieldId, params) => request('GET', `${base(t, slug)}/fields/${fieldId}/options${qs(params)}`),
    availability: (t, slug, fieldId, params) =>
      request('GET', `${base(t, slug)}/fields/${fieldId}/availability${qs(params)}`)
  }
})()

export const metaApi = {
  builder: () => request('GET', '/v1/meta/builder'),
  dataTypes: () => request('GET', '/v1/getDataTypes'),
  health: () => request('GET', '/v1/health')
}
