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
          <Button label="QR code" icon="pi pi-qrcode" severity="secondary" outlined @click="openQr" />
        </div>
        <small class="hint">Share this with patients, for example on WhatsApp or Instagram, or print the QR poster.</small>
      </div>
      <div class="share-accepting">
        <label for="share-accepting" class="strong">Accepting responses</label>
        <ToggleSwitch inputId="share-accepting" :modelValue="accepting" :disabled="busy || !canShare"
                      @update:modelValue="(v) => emit('toggle-accepting', v)" />
        <small class="hint">{{ accepting ? 'Anyone with the link can submit.' : 'The link shows a closed message.' }}</small>
      </div>
    </div>

    <Dialog v-model:visible="qr.open" modal header="QR code for patients" :style="{ width: '440px' }">
      <div class="form-grid">
        <div v-if="branches.length" class="field">
          <label for="qr-branch">Branch (optional)</label>
          <Select inputId="qr-branch" v-model="qr.branch" :options="branches" optionLabel="label" optionValue="id"
                  showClear placeholder="Any branch" fluid @change="makeQr" />
          <small class="hint">A branch's QR opens the form with that branch already chosen.</small>
        </div>
        <div class="qr-box" aria-label="QR code">
          <img v-if="qr.url" :src="qr.url" alt="QR code for the booking link" />
          <i v-else class="pi pi-spin pi-spinner" aria-hidden="true" />
        </div>
        <div class="mono small">{{ qrLink }}</div>
      </div>
      <template #footer>
        <Button label="Download SVG" icon="pi pi-download" severity="secondary" text @click="save('svg')" />
        <Button label="Download PNG" icon="pi pi-download" severity="secondary" text @click="save('png')" />
        <Button label="Print poster" icon="pi pi-print" @click="poster" />
      </template>
    </Dialog>
  </section>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useNotify } from '@/composables/useNotify'
import { loadClinic } from '@/composables/useClinic'
import { appConfig } from '@/config/env'
import { listsApi, metaApi } from '@/services/api'
import { posterHtml, printSheets } from '@/utils/print'

const props = defineProps({
  tenantCode: { type: String, required: true },
  formSlug: { type: String, required: true },
  accepting: { type: Boolean, default: true },
  busy: { type: Boolean, default: false },
  canShare: { type: Boolean, default: true }
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

// ---- QR code: the same public link, marked "src=qr" (and a branch) so reports can tell them apart.
const qr = reactive({ open: false, branch: null, url: '' })
const branches = ref([])
const clinic = ref(null)
const qrLink = computed(() => `${link.value}?src=qr${qr.branch ? `&branch=${qr.branch}` : ''}`)

async function openQr() {
  qr.open = true
  try {
    clinic.value = await loadClinic(props.tenantCode)
    const where = clinic.value.booking?.where_list
    branches.value = where ? (await listsApi.options(props.tenantCode, where.slug)).options : []
  } catch {
    branches.value = []
  }
  makeQr()
}

async function makeQr() {
  if (qr.url) URL.revokeObjectURL(qr.url)
  qr.url = ''
  try {
    qr.url = URL.createObjectURL(await metaApi.qr(qrLink.value, 'svg', 8))
  } catch (e) {
    notify.error('Could not make the QR code', e)
  }
}

async function save(format) {
  try {
    const blob = await metaApi.qr(qrLink.value, format, format === 'png' ? 12 : 8)
    const url = URL.createObjectURL(blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: `${props.formSlug}-qr.${format}` })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    notify.error('Could not download', e)
  }
}

async function poster() {
  try {
    const svg = await (await metaApi.qr(qrLink.value, 'svg', 10)).text()
    const branch = branches.value.find((b) => b.id === qr.branch)?.label
    printSheets([[posterHtml({ clinic: clinic.value?.clinic || { name: '' }, link: qrLink.value, qrSvg: svg,
      languageLine: clinic.value?.print_settings?.language_line, branch })]], 'A4', 'QR poster')
  } catch (e) {
    notify.error('Could not print the poster', e)
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

.qr-box {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 240px;
}

.qr-box img {
  width: 240px;
  height: 240px;
}

.small {
  font-size: 0.8rem;
  word-break: break-all;
}
</style>
