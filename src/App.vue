<template>
  <AppHeader v-if="!route.meta.public && !route.meta.guest" />
  <router-view />
  <Toast position="bottom-right" />
  <ConfirmDialog />
</template>

<script setup>
import { useRoute } from 'vue-router'
import AppHeader from '@/components/layout/AppHeader.vue'

const route = useRoute()
</script>
