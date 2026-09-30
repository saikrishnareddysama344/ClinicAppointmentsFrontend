// All backend endpoints, grouped by area. Views never build URLs themselves.
// Tenants are addressed by their code, forms by their link name (slug).
import { request } from './http'
import { appConfig } from '@/config/env'

const enc = encodeURIComponent
const formPath = (tenantCode, formSlug) => `/v1/tenants/${enc(tenantCode)}/forms/${enc(formSlug)}`

export const tenantsApi = {
  list: () => request('GET', '/v1/tenants'),
  get: (tenantCode) => request('GET', `/v1/tenants/${enc(tenantCode)}`),
  create: (payload) => request('POST', '/v1/tenants', payload)
}

export const formsApi = {
  listForTenant: (tenantCode) => request('GET', `/v1/tenants/${enc(tenantCode)}/forms`),
  create: (tenantCode, payload) => request('POST', `/v1/tenants/${enc(tenantCode)}/forms`, payload),
  get: (tenantCode, formSlug) => request('GET', formPath(tenantCode, formSlug)),
  save: (tenantCode, formSlug, payload) => request('PUT', formPath(tenantCode, formSlug), payload),
  remove: (tenantCode, formSlug) => request('DELETE', formPath(tenantCode, formSlug)),
  publish: (tenantCode, formSlug) => request('POST', `${formPath(tenantCode, formSlug)}/publish`),
  updateShare: (tenantCode, formSlug, payload) => request('PUT', `${formPath(tenantCode, formSlug)}/share`, payload)
}

export const submissionsApi = {
  list: (tenantCode, formSlug, page, pageSize) =>
    request('GET', `${formPath(tenantCode, formSlug)}/submissions?page=${page}&page_size=${pageSize}`),
  // Plain link: the browser downloads the file itself.
  csvUrl: (tenantCode, formSlug) => `${appConfig.apiBaseUrl}${formPath(tenantCode, formSlug)}/submissions.csv`
}

export const publicApi = {
  getForm: (tenantCode, formSlug) => request('GET', `/v1/public/${enc(tenantCode)}/${enc(formSlug)}`),
  submit: (tenantCode, formSlug, payload) =>
    request('POST', `/v1/public/${enc(tenantCode)}/${enc(formSlug)}/submissions`, payload)
}

export const metaApi = {
  builder: () => request('GET', '/v1/meta/builder'),
  dataTypes: () => request('GET', '/v1/getDataTypes'),
  health: () => request('GET', '/v1/health')
}
