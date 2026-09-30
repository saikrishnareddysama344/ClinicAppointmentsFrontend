<template>
  <nav class="crumbs" aria-label="Breadcrumb">
    <router-link :to="{ name: ROUTES.TENANTS }">Tenants</router-link>
    <i class="pi pi-angle-right" aria-hidden="true" />
    <router-link :to="{ name: section.route, params: { tenantCode } }">{{ tenant?.name || tenantCode }}</router-link>
    <template v-for="(crumb, i) in crumbs" :key="i">
      <i class="pi pi-angle-right" aria-hidden="true" />
      <router-link v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</router-link>
      <span v-else>{{ crumb.label }}</span>
    </template>
  </nav>
  <div class="tenant-tabs" role="tablist">
    <router-link v-for="tab in TABS" :key="tab.route" role="tab" class="tenant-tab"
                 :class="{ active: tab.route === section.route }" :to="{ name: tab.route, params: { tenantCode } }">
      <i :class="tab.icon" aria-hidden="true" /> {{ tab.label }}
    </router-link>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ROUTES } from '@/router'
import { loadTenant } from '@/composables/useTenant'

const props = defineProps({
  tenantCode: { type: String, required: true },
  // Extra breadcrumb items after the tenant: [{ label, to? }]
  crumbs: { type: Array, default: () => [] }
})

const TABS = [
  { label: 'Forms', icon: 'pi pi-file-edit', route: ROUTES.FORMS, match: ['form'] },
  { label: 'Lists', icon: 'pi pi-table', route: ROUTES.LISTS, match: ['list'] },
  { label: 'Schedules', icon: 'pi pi-calendar-clock', route: ROUTES.SCHEDULES, match: ['schedule'] },
  { label: 'Bookings', icon: 'pi pi-ticket', route: ROUTES.BOOKINGS, match: ['booking'] }
]

const tenant = ref(null)
watch(() => props.tenantCode, async (code) => {
  tenant.value = await loadTenant(code).catch(() => null)
}, { immediate: true })

const route = useRoute()
const section = computed(() => {
  const name = String(route.name || '')
  return TABS.find((t) => t.match.some((m) => name.startsWith(m)) || name === t.route) || TABS[0]
})

defineExpose({ tenant })
</script>

<style scoped>
.tenant-tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid var(--p-content-border-color);
  margin: -0.25rem 0 1rem;
  overflow-x: auto;
}

.tenant-tab {
  padding: 0.55rem 0.9rem;
  color: var(--p-text-muted-color);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  font-size: 0.92rem;
}

.tenant-tab.active {
  color: var(--p-primary-color);
  border-bottom-color: var(--p-primary-color);
  font-weight: 600;
}
</style>
