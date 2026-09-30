<template>
  <div class="slot-picker">
    <div v-if="!api" class="muted">The appointment picker appears on the public form.</div>

    <template v-else>
      <div class="slot-row">
        <Select v-if="info.where" v-model="pick.where_id" :options="wheres" optionLabel="label" optionValue="id"
                :placeholder="`Choose ${info.where}`" :ariaLabel="info.where" :loading="busy.where" fluid
                @change="onWhere" />
        <Select v-model="pick.who_id" :options="whos" optionLabel="label" optionValue="id"
                :placeholder="`Choose ${info.who || 'who'}`" :ariaLabel="info.who" :loading="busy.who"
                :disabled="!!info.where && !pick.where_id" fluid @change="loadWindows" />
        <DatePicker v-model="pick.day" :minDate="range.first" :maxDate="range.last" dateFormat="dd/mm/yy"
                    placeholder="Date" ariaLabel="Date" showIcon :disabled="!pick.who_id" fluid
                    @update:modelValue="loadWindows" />
      </div>

      <div v-if="pick.day && pick.who_id" class="windows" role="radiogroup" aria-label="Time window">
        <span v-if="busy.windows" class="muted"><i class="pi pi-spin pi-spinner" aria-hidden="true" /> Checking times…</span>
        <span v-else-if="!windows.length" class="muted">No time windows on this day. Try another date.</span>
        <button v-for="w in windows" :key="w.window_id" type="button" role="radio" class="window"
                :class="{ chosen: w.window_id === modelValue?.window_id }" :aria-checked="w.window_id === modelValue?.window_id"
                :disabled="!w.available" @click="choose(w)">
          <strong>{{ w.start }}–{{ w.end }}</strong>
          <small>{{ w.available ? `${w.remaining} left` : REASONS[w.reason] }}</small>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { toApiValue } from '@/utils/format'

// api: { options(part, whereId) -> [{id,label}], availability(params) -> {dates, windows} }
const props = defineProps({
  modelValue: { type: Object, default: null },
  field: { type: Object, required: true },
  api: { type: Object, default: null },
  // Changes after a failed booking (e.g. the window just filled up), to reload the times.
  refreshKey: { type: Number, default: 0 }
})
const emit = defineEmits(['update:modelValue'])

const REASONS = { full: 'Full', leave: 'Not available', ended: 'Ended' }
const info = computed(() => props.field.slot || {})
const range = computed(() => {
  const d = info.value.dates
  return d ? { first: new Date(`${d.first}T00:00:00`), last: new Date(`${d.last}T00:00:00`) } : {}
})

const pick = reactive({ where_id: null, who_id: null, day: null })
const wheres = ref([])
const whos = ref([])
const windows = ref([])
const busy = reactive({ where: false, who: false, windows: false })

async function run(key, work) {
  busy[key] = true
  try {
    return await work()
  } catch {
    return []
  } finally {
    busy[key] = false
  }
}

const clear = () => emit('update:modelValue', null)

async function loadWhos() {
  whos.value = await run('who', () => props.api.options('who', pick.where_id))
}

function onWhere() {
  pick.who_id = null
  windows.value = []
  clear()
  loadWhos()
}

async function loadWindows() {
  clear()
  windows.value = []
  if (!pick.day || !pick.who_id) return
  const params = { date: toApiValue('date', pick.day), who_id: pick.who_id, where_id: pick.where_id }
  windows.value = (await run('windows', () => props.api.availability(params))).windows || []
}

function choose(w) {
  emit('update:modelValue', { where_id: pick.where_id, who_id: pick.who_id,
    date: toApiValue('date', pick.day), window_id: w.window_id })
}

watch(() => props.api, async (api) => {
  if (!api) return
  if (info.value.where) wheres.value = await run('where', () => api.options('where'))
  else await loadWhos()
}, { immediate: true })

watch(() => props.refreshKey, loadWindows)
</script>

<style scoped>
.slot-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 0.5rem;
}

.windows {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.window {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  background: var(--p-content-background);
  color: var(--p-text-color);
  cursor: pointer;
  font: inherit;
}

.window small {
  color: var(--p-text-muted-color);
}

.window.chosen {
  border-color: var(--p-primary-color);
  box-shadow: 0 0 0 1px var(--p-primary-color);
}

.window:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
