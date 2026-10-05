<template>
  <!-- The clinic's logo next to its name; nothing when the clinic has none or the picture fails to load. -->
  <img v-if="src && !failed" :src="src" alt="" class="clinic-logo" :style="{ height: `${size}px`, maxWidth: `${size * 3}px` }"
       @error="failed = true" />
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { logoUrl } from '@/utils/logo'

const props = defineProps({
  path: { type: String, default: null },   // the API's "logo" address
  size: { type: Number, default: 24 }
})
const src = computed(() => logoUrl(props.path))
const failed = ref(false)
watch(src, () => { failed.value = false })
</script>

<style scoped>
.clinic-logo {
  object-fit: contain;
  vertical-align: middle;
  flex: none;
}
</style>
