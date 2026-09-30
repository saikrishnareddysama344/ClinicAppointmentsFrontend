<template>
  <header class="app-header">
    <router-link :to="{ name: ROUTES.TENANTS }" class="brand">
      <i class="pi pi-th-large" aria-hidden="true" />
      {{ appConfig.title }}
    </router-link>
    <span class="tag-line">{{ appConfig.subtitle }}</span>
    <span class="spacer" />
    <span class="api-status" :class="apiState" v-tooltip.bottom="apiTooltip">
      <i class="pi pi-circle-fill" aria-hidden="true" /> API
    </span>
  </header>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { appConfig } from '@/config/env'
import { ROUTES } from '@/router'
import { metaApi } from '@/services/api'

const apiState = ref('checking')

const apiTooltip = computed(() => ({
  ok: 'API and database are reachable',
  down: 'API or database is not reachable. Start it with backend\\manage.bat, or run its Health check.',
  checking: 'Checking API...'
})[apiState.value])

onMounted(async () => {
  try {
    await metaApi.health()
    apiState.value = 'ok'
  } catch {
    apiState.value = 'down'
  }
})
</script>

<style scoped>
.spacer {
  flex: 1;
}

.api-status {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

.api-status i {
  font-size: 0.55rem;
}

.api-status.ok i {
  color: var(--p-green-500);
}

.api-status.down i {
  color: var(--p-red-500);
}

.api-status.checking i {
  color: var(--p-surface-400);
}
</style>
