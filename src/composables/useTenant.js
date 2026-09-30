// A tenant's details, fetched once per tenant code and shared by every page of that tenant.
import { tenantsApi } from '@/services/api'

const cache = {}

export function loadTenant(code) {
  cache[code] ||= tenantsApi.get(code).then((r) => r.tenant).catch((e) => {
    delete cache[code]
    throw e
  })
  return cache[code]
}

// Call after changes that alter what the tenant list shows (e.g. form counts).
export const forgetTenant = (code) => delete cache[code]
