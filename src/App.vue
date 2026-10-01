<template>
  <AppHeader v-if="!route.meta.public && !route.meta.guest" />
  <router-view />
  <Toast position="bottom-right" />
  <ConfirmDialog />
  <div v-if="pageBusy" class="page-busy" role="status" aria-live="polite">
    <i class="pi pi-spin pi-spinner" aria-hidden="true" /><span>Please wait…</span>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'
import { pageBusy } from '@/services/http'

const route = useRoute()
</script>

<style>
/* Covers the page while a request the user started waits for the server (services/http.js). */
.page-busy {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: rgba(255, 255, 255, 0.35);
  cursor: progress;
  font-weight: 600;
}

.page-busy .pi {
  font-size: 1.6rem;
}

@media (prefers-color-scheme: dark) {
  .page-busy {
    background: rgba(0, 0, 0, 0.35);
  }
}
</style>
