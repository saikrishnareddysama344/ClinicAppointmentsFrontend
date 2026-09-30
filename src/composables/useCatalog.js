// A tenant's lists and schedules, for pickers in the builder and for list dropdowns in admin
// screens. Loaded once per tenant; call refresh() after lists or schedules change.
import { ref } from 'vue'
import { listsApi, schedulesApi } from '@/services/api'

const cache = {}

export function useCatalog(tenantCode) {
  const entry = (cache[tenantCode] ||= { lists: ref([]), schedules: ref([]), definitions: {}, loading: null })

  function load() {
    // A user without permission to see lists or schedules simply gets none.
    const allowed = (call, empty) => call.catch((e) => (e.httpStatus === 403 ? empty : Promise.reject(e)))
    entry.loading ||= Promise.all([allowed(listsApi.list(tenantCode), { lists: [] }),
      allowed(schedulesApi.list(tenantCode), { schedules: [] })])
      .then(([l, s]) => {
        entry.lists.value = l.lists.filter((x) => x.display_field_id)   // only usable lists
        entry.schedules.value = s.schedules
      })
      .catch((e) => {
        entry.loading = null
        throw e
      })
    return entry.loading
  }

  function refresh() {
    entry.loading = null
    entry.definitions = {}
    return load()
  }

  const listById = (id) => entry.lists.value.find((l) => l.id === id)

  // A list's full definition (its columns), e.g. to pick the column a dependent dropdown matches on.
  function listDefinition(id) {
    const list = listById(id)
    if (!list) return Promise.resolve(null)
    entry.definitions[id] ||= listsApi.get(tenantCode, list.slug).then((r) => r.list)
    return entry.definitions[id]
  }

  // Active rows of a list as [{id, label}] (params: q, filter_field_id, filter_value).
  async function listOptions(id, params) {
    const list = listById(id)
    return list ? (await listsApi.options(tenantCode, list.slug, params)).options : []
  }

  return { lists: entry.lists, schedules: entry.schedules, load, refresh, listById, listDefinition, listOptions }
}
