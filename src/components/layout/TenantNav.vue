<template>
  <nav class="crumbs" aria-label="Breadcrumb">
    <template v-if="showTenants">
      <router-link :to="{ name: ROUTES.TENANTS }">Tenants</router-link>
      <i class="pi pi-angle-right" aria-hidden="true" />
    </template>
    <router-link :to="{ name: section.route, params: { tenantCode } }">{{ tenant?.name || tenantCode }}</router-link>
    <template v-for="(crumb, i) in crumbs" :key="i">
      <i class="pi pi-angle-right" aria-hidden="true" />
      <router-link v-if="crumb.to" :to="crumb.to">{{ crumb.label }}</router-link>
      <span v-else>{{ crumb.label }}</span>
    </template>
  </nav>
  <div class="tenant-tabs" role="tablist">
    <router-link v-for="tab in tabs" :key="tab.route" role="tab" class="tenant-tab"
                 :class="{ active: tab.route === section.route }" :to="{ name: tab.route, params: { tenantCode } }">
      <i :class="tab.icon" aria-hidden="true" /> {{ tab.label }}
    </router-link>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CLINIC_TABS, ROUTES } from '@/router'
import { loadTenant } from '@/composables/useTenant'
import { can, clinics, isPlatformAdmin } from '@/services/auth'

const props = defineProps({
  tenantCode: { type: String, required: true },
  // Extra breadcrumb items after the tenant: [{ label, to? }]
  crumbs: { type: Array, default: () => [] }
})

// Only the tabs this user may open; the clinic list only for people who have more than one clinic.
const tabs = computed(() => CLINIC_TABS.filter((t) => can(props.tenantCode, t.permission)))
const showTenants = computed(() => isPlatformAdmin.value || clinics.value.length > 1)

const tenant = ref(null)
watch(() => props.tenantCode, async (code) => {
  tenant.value = await loadTenant(code).catch(() => null)
}, { immediate: true })

const route = useRoute()
const section = computed(() => {
  const name = String(route.name || '')
  return CLINIC_TABS.find((t) => t.match.some((m) => name.startsWith(m)) || name === t.route) || CLINIC_TABS[0]
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
