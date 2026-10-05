// A tenant's details, fetched once per tenant code and shared by every page of that tenant.
import { ref } from 'vue'
import { tenantsApi } from '@/services/api'

const cache = {}
// Goes up when a tenant's details change (e.g. its logo): pages showing them load again.
export const tenantsChanged = ref(0)

export function loadTenant(code) {
  cache[code] ||= tenantsApi.get(code).then((r) => r.tenant).catch((e) => {
    delete cache[code]
    throw e
  })
  return cache[code]
}

export function forgetTenant(code) {
  delete cache[code]
  tenantsChanged.value++
}
