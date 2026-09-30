// State and actions for editing one form. The view only handles layout,
// notifications and confirmations.
import { computed, reactive, ref } from 'vue'
import { formsApi } from '@/services/api'
import { DROPDOWN_TYPE, NEW_DROPDOWN_OPTIONS } from '@/constants/fieldTypes'
import { FLAG_YES, FORM_STATUS } from '@/constants/formStatus'
import { useBuilderConfig } from './useBuilderConfig'

let keySeed = 0
const nextKey = () => `k${++keySeed}`

export function useFormBuilder(tenantCode, formSlug) {
  const config = useBuilderConfig()

  const form = ref(null)
  const formName = ref('')
  const fields = ref([])
  const selectedKey = ref(null)
  const snapshot = ref('')
  const fieldErrors = reactive({})
  const generalErrors = ref([])
  const loading = ref(true)
  const saving = ref(false)
  const publishing = ref(false)

  // ---------- conversions between API rows and editable fields ----------

  function toLocal(apiField) {
    const options = apiField.options_config || {}
    return {
      key: nextKey(),
      id: apiField.id,
      column_name: apiField.column_name || null,
      display_label: apiField.display_label || '',
      data_type: String(apiField.data_type || '').toLowerCase(),
      is_mandatory: apiField.is_mandatory === FLAG_YES,
      max_length: apiField.max_length ?? null,
      placeholder: apiField.placeholder || '',
      help_text: apiField.help_text || '',
      source: options.source || config.staticSource.value,
      options: Array.isArray(options.options) ? [...options.options] : []
    }
  }

  function toPayload(field) {
    const payload = {
      display_label: field.display_label.trim(),
      data_type: field.data_type,
      is_mandatory: field.is_mandatory,
      max_length: config.isLengthType(field.data_type) ? field.max_length ?? null : null,
      placeholder: field.placeholder.trim() || null,
      help_text: field.help_text.trim() || null,
      options_config: null
    }
    if (field.id) payload.id = field.id
    if (field.data_type === DROPDOWN_TYPE) {
      payload.options_config = field.source === config.staticSource.value
        ? { source: field.source, options: field.options.map((o) => o.trim()).filter(Boolean) }
        : { source: field.source }
    }
    return payload
  }

  const payload = computed(() => ({
    display_name: formName.value.trim(),
    fields: fields.value.map(toPayload)
  }))

  const dirty = computed(() => !!form.value && JSON.stringify(payload.value) !== snapshot.value)
  const selected = computed(() => fields.value.find((f) => f.key === selectedKey.value) || null)
  const isDraft = computed(() => form.value?.status === FORM_STATUS.DRAFT)
  const canPublish = computed(() => !!form.value && fields.value.length > 0
    && (dirty.value || form.value.status !== FORM_STATUS.PUBLISHED))

  // Column names that would clash, checked before saving.
  const columnCounts = computed(() => {
    const counts = {}
    for (const f of fields.value) {
      const name = f.column_name || config.columnPreview(f.display_label)
      if (name) counts[name] = (counts[name] || 0) + 1
    }
    return counts
  })

  function nameProblem(field) {
    if (!field || field.column_name) return ''
    const name = config.columnPreview(field.display_label)
    if (!name) return ''
    if (config.isReserved(name)) return `"${name}" is reserved. Choose another label.`
    if (columnCounts.value[name] > 1) return `Another field also becomes "${name}". Use a different label.`
    return ''
  }

  // ---------- load / save / publish ----------

  function clearErrors() {
    for (const key of Object.keys(fieldErrors)) delete fieldErrors[key]
    generalErrors.value = []
  }

  function applyForm(apiForm) {
    const previousIndex = fields.value.findIndex((f) => f.key === selectedKey.value)
    form.value = apiForm
    formName.value = apiForm.display_name
    fields.value = apiForm.fields.map(toLocal)
    selectedKey.value = fields.value[Math.max(previousIndex, 0)]?.key ?? null
    snapshot.value = JSON.stringify(payload.value)
    clearErrors()
  }

  async function load() {
    loading.value = true
    try {
      await config.load()
      applyForm((await formsApi.get(tenantCode, formSlug)).form)
    } finally {
      loading.value = false
    }
  }

  // Returns true when saved; on validation errors, marks the fields and rethrows.
  async function save() {
    clearErrors()
    saving.value = true
    try {
      applyForm((await formsApi.save(tenantCode, formSlug, payload.value)).form)
      return true
    } catch (e) {
      for (const [index, messages] of Object.entries(e.data?.field_errors || {})) {
        const field = fields.value[Number(index)]
        if (field) fieldErrors[field.key] = messages
      }
      generalErrors.value = e.data?.errors || []
      const firstBad = fields.value.find((f) => fieldErrors[f.key]?.length)
      if (firstBad) selectedKey.value = firstBad.key
      throw e
    } finally {
      saving.value = false
    }
  }

  async function publish() {
    publishing.value = true
    try {
      const result = await formsApi.publish(tenantCode, formSlug)
      applyForm((await formsApi.get(tenantCode, formSlug)).form)
      return result
    } finally {
      publishing.value = false
    }
  }

  // ---------- editing ----------

  function blankField(type) {
    return {
      key: nextKey(), id: null, column_name: null, display_label: '', data_type: type, is_mandatory: false,
      max_length: null, placeholder: '', help_text: '', source: config.staticSource.value,
      options: type === DROPDOWN_TYPE ? [...NEW_DROPDOWN_OPTIONS] : []
    }
  }

  function addField(type) {
    const field = blankField(type)
    field.display_label = `${config.typeName(type)} ${fields.value.length + 1}`
    fields.value.push(field)
    selectedKey.value = field.key
  }

  function move(index, step) {
    const target = index + step
    if (target < 0 || target >= fields.value.length) return
    const list = fields.value
    ;[list[index], list[target]] = [list[target], list[index]]
  }

  function duplicate(index) {
    const source = fields.value[index]
    const copy = { ...source, key: nextKey(), id: null, column_name: null, options: [...source.options],
      display_label: `${source.display_label} copy` }
    fields.value.splice(index + 1, 0, copy)
    selectedKey.value = copy.key
  }

  function remove(index) {
    const [removed] = fields.value.splice(index, 1)
    delete fieldErrors[removed.key]
    if (selectedKey.value === removed.key) {
      selectedKey.value = fields.value[Math.min(index, fields.value.length - 1)]?.key ?? null
    }
  }

  function onTypeChange(field) {
    if (field.data_type === DROPDOWN_TYPE && field.source === config.staticSource.value && !field.options.length) {
      field.options = [...NEW_DROPDOWN_OPTIONS]
    }
    if (!config.isLengthType(field.data_type)) field.max_length = null
  }

  async function setAccepting(accepting) {
    const result = await formsApi.updateShare(tenantCode, formSlug, { accepting_submissions: accepting })
    form.value = { ...form.value, accepting_submissions: result.form.accepting_submissions }
  }

  return {
    config, form, formName, fields, selectedKey, selected, fieldErrors, generalErrors,
    loading, saving, publishing, dirty, isDraft, canPublish,
    load, save, publish, setAccepting, addField, move, duplicate, remove, onTypeChange, nameProblem
  }
}
