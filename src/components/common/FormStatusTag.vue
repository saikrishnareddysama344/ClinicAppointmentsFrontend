<template>
  <Tag :value="meta.label" :severity="meta.severity" :icon="meta.icon" />
</template>

<script setup>
import { computed } from 'vue'
import { FORM_STATUS } from '@/constants/formStatus'

const props = defineProps({
  status: { type: String, required: true }
})

const STATUS_META = {
  [FORM_STATUS.PUBLISHED]: { label: 'Published', severity: 'success', icon: 'pi pi-check' },
  [FORM_STATUS.CHANGES_PENDING]: { label: 'Unpublished changes', severity: 'warn', icon: 'pi pi-exclamation-circle' },
  [FORM_STATUS.DRAFT]: { label: 'Draft', severity: 'secondary', icon: 'pi pi-pencil' }
}

const meta = computed(() => STATUS_META[props.status] || STATUS_META[FORM_STATUS.DRAFT])
</script>
