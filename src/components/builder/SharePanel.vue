<template>
  <section class="panel share-panel" aria-label="Share form">
    <div class="share-row">
      <div class="share-link">
        <label for="share-link" class="strong">Public link</label>
        <div class="link-row">
          <InputText id="share-link" :modelValue="link" readonly fluid class="mono" @focus="(e) => e.target.select()" />
          <Button icon="pi pi-copy" severity="secondary" outlined aria-label="Copy link" v-tooltip.top="'Copy link'"
                  @click="copy" />
          <Button icon="pi pi-external-link" severity="secondary" outlined aria-label="Open form"
                  v-tooltip.top="'Open form'" as="a" :href="link" target="_blank" rel="noopener" />
        </div>
        <small class="hint">Share this with patients, for example on WhatsApp or Instagram.</small>
      </div>
      <div class="share-accepting">
        <label for="share-accepting" class="strong">Accepting responses</label>
        <ToggleSwitch inputId="share-accepting" :modelValue="accepting" :disabled="busy"
                      @update:modelValue="(v) => emit('toggle-accepting', v)" />
        <small class="hint">{{ accepting ? 'Anyone with the link can submit.' : 'The link shows a closed message.' }}</small>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useNotify } from '@/composables/useNotify'
import { appConfig } from '@/config/env'

const props = defineProps({
  tenantCode: { type: String, required: true },
  formSlug: { type: String, required: true },
  accepting: { type: Boolean, default: true },
  busy: { type: Boolean, default: false }
})

const emit = defineEmits(['toggle-accepting'])
const notify = useNotify()

const link = computed(() => {
  const base = appConfig.publicBaseUrl || window.location.origin
  return `${base}/f/${encodeURIComponent(props.tenantCode)}/${encodeURIComponent(props.formSlug)}`
})

async function copy() {
  try {
    await navigator.clipboard.writeText(link.value)
    notify.success('Link copied')
  } catch {
    notify.info('Copy the link', 'Select the link text and press Ctrl+C.')
  }
}
</script>

<style scoped>
.share-panel {
  padding: 1rem;
  margin-bottom: 1rem;
}

.share-row {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  align-items: flex-start;
}

.share-link {
  flex: 1;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.link-row {
  display: flex;
  gap: 0.4rem;
}

.share-accepting {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 200px;
}

.strong {
  font-weight: 600;
  font-size: 0.875rem;
}
</style>
