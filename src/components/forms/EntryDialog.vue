<template>
  <Dialog :visible="visible" modal :header="form ? `New entry: ${form.display_name}` : 'New entry'"
          :style="{ width: '560px' }" :breakpoints="{ '600px': '96vw' }" @update:visible="close">
    <div v-if="!form" class="picks">
      <div v-if="loading" class="muted">Loading…</div>
      <div v-else-if="!forms.length" class="muted">Your role cannot add entries to any form.</div>
      <template v-else>
        <p class="muted">Which form?</p>
        <Button v-for="f in forms" :key="f.id" :label="f.display_name" icon="pi pi-file-edit" severity="secondary"
                outlined @click="open(f)" />
      </template>
    </div>
    <template v-else>
      <Message v-if="error" severity="error" class="mb">{{ error }}</Message>
      <div v-if="loading" class="muted">Loading…</div>
      <FormRenderer v-else :key="round" :fields="fields" :optionsLoader="listOptions" :slotApi="slotApi" autoFill
                    :staticSource="config.staticSource.value || 'static'"
                    :defaultTextLength="config.limits.value.default_text_length || 255"
                    :defaultPhoneLength="config.limits.value.default_phone_length || 20"
                    :externalErrors="errors" :submitting="saving" submitLabel="Save" @submitted="save" />
      <Button v-if="forms.length > 1" label="Choose another form" icon="pi pi-arrow-left" text size="small"
              @click="form = null" />
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import FormRenderer from '@/components/forms/FormRenderer.vue'
import { useBuilderConfig } from '@/composables/useBuilderConfig'
import { formsApi, listsApi } from '@/services/api'
import { rendererField, toApiValue } from '@/utils/format'

// Staff fill a form the way patients do (no builder): the forms this role may add to, then the form.
// Emits saved(result) with {row, booking?} after a successful save.
const props = defineProps({
  tenantCode: { type: String, required: true },
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible', 'saved'])

const config = useBuilderConfig()
const forms = ref([])
const form = ref(null)
const definition = ref(null)
const slotInfo = ref({})
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const errors = ref({})
const round = ref(0)   // a new key empties the form after saving
const t = props.tenantCode

// The fields this role fills in: every field it may edit (never retired ones).
const fields = computed(() => (definition.value?.fields || [])
  .filter((f) => f.column_name && !f.visibility?.retired && f.access === 'edit')
  .map((f) => rendererField({ ...f, slot: slotInfo.value[f.id] })))

const listOptions = (field, parentValue) => listsApi.options(t, field.list_slug,
  field.depends_on_field_id ? { filter_field_id: field.match_field_id, filter_value: parentValue } : {})
  .then((r) => r.options)
const slotApi = (field) => ({
  options: async (part, whereId) => (await formsApi.slot(t, form.value.slug, field.id, { part, where_id: whereId })).options,
  availability: (params) => formsApi.slot(t, form.value.slug, field.id, params)
})

watch(() => props.visible, async (shown) => {
  if (!shown) return
  error.value = ''
  loading.value = true
  try {
    await config.load()
    forms.value = (await formsApi.forEntry(t)).forms.filter((f) => f.status !== 'draft')
    if (forms.value.length === 1) await open(forms.value[0])
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}, { immediate: true })

async function open(f) {
  form.value = f
  loading.value = true
  error.value = ''
  errors.value = {}
  try {
    definition.value = (await formsApi.get(t, f.slug)).form
    const slots = definition.value.fields.filter((x) => x.data_type === 'slot' && x.access === 'edit')
    slotInfo.value = Object.fromEntries(await Promise.all(slots.map(async (x) =>   // who / where names
      [x.id, (await formsApi.slot(t, f.slug, x.id)).slot])))
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
async function save(answers) {
  saving.value = true
  error.value = ''
  errors.value = {}
  try {
    const values = Object.fromEntries(fields.value.map((f) => [f.key, toApiValue(f.data_type, answers[f.key])]))
    const result = await formsApi.addRow(t, form.value.slug, values)
    round.value++
    emit('saved', result)
    close(false)
  } catch (e) {
    errors.value = e.data?.field_errors || {}
    error.value = e.message
  } finally {
    saving.value = false
  }
}

function close(value) {
  if (!value && forms.value.length !== 1) form.value = null
  emit('update:visible', value)
}
</script>

<style scoped>
.picks {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mb {
  margin-bottom: 1rem;
}
</style>
