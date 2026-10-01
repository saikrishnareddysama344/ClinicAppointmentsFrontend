// State and actions for editing one form or list. The view only handles layout,
// notifications and confirmations. A list is published by the backend on every save.
import { computed, reactive, ref } from 'vue'
import { definitionApis } from '@/services/api'
import { DROPDOWN_TYPE, LIST_SOURCE, NEW_DROPDOWN_OPTIONS, SLOT_TYPE } from '@/constants/fieldTypes'
import { FLAG_YES, FORM_STATUS } from '@/constants/formStatus'
import { useBuilderConfig } from './useBuilderConfig'

let keySeed = 0
const nextKey = () => `k${++keySeed}`

// Builder visibility switches (only the ones that are on are sent).
const VISIBILITY_OFF = Object.freeze({ hide_public: false, hide_table: false, retired: false })

export function useBuilder(tenantCode, slug, kind = 'form') {
  const config = useBuilderConfig()
  const api = definitionApis[kind]

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
      options: Array.isArray(options.options) ? [...options.options] : [],
      is_display: !!apiField.is_display,
      // dropdown from a list (optionally depending on an earlier dropdown)
      list_id: options.list_id ?? null,
      depends_on_field_id: options.depends_on_field_id ?? null,
      match_field_id: options.match_field_id ?? null,
      // appointment slot
      schedule_id: options.schedule_id ?? null,
      contact_field_id: options.contact_field_id ?? null,
      name_field_id: options.name_field_id ?? null,
      // hidden on the public form / in the table, or retired (see FieldSettings)
      visibility: { ...VISIBILITY_OFF, ...(apiField.visibility || {}) }
    }
  }

  function optionsConfig(field) {
    if (field.data_type === SLOT_TYPE) {
      return { schedule_id: field.schedule_id, contact_field_id: field.contact_field_id || null,
        name_field_id: field.name_field_id || null }
    }
    if (field.data_type !== DROPDOWN_TYPE) return null
    if (field.source === LIST_SOURCE) {
      const config = { source: LIST_SOURCE, list_id: field.list_id }
      if (field.depends_on_field_id) {
        Object.assign(config, { depends_on_field_id: field.depends_on_field_id, match_field_id: field.match_field_id })
      }
      return config
    }
    return { source: field.source, options: field.options.map((o) => o.trim()).filter(Boolean) }
  }

  function toPayload(field) {
    const payload = {
      display_label: field.display_label.trim(),
      data_type: field.data_type,
      is_mandatory: field.is_mandatory,
      max_length: config.isLengthType(field.data_type) ? field.max_length ?? null : null,
      placeholder: field.placeholder.trim() || null,
      help_text: field.help_text.trim() || null,
      options_config: optionsConfig(field),
      visibility: Object.fromEntries(Object.keys(VISIBILITY_OFF)
        .filter((k) => field.visibility[k] && (kind === 'form' || k !== 'hide_public')).map((k) => [k, true]))
    }
    if (field.id) payload.id = field.id
    if (kind === 'list') payload.is_display = field.is_display
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
      applyForm((await api.get(tenantCode, slug))[kind])
    } finally {
      loading.value = false
    }
  }

  // Returns true when saved; on validation errors, marks the fields and rethrows.
  async function save() {
    clearErrors()
    saving.value = true
    try {
      applyForm((await api.save(tenantCode, slug, payload.value))[kind])
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
      const result = await api.publish(tenantCode, slug)
      applyForm((await api.get(tenantCode, slug))[kind])
      return result
    } finally {
      publishing.value = false
    }
  }

  // ---------- editing ----------

  function blankField(type) {
    return {
      key: nextKey(), id: null, column_name: null, display_label: '', data_type: type, is_mandatory: type === SLOT_TYPE,
      max_length: null, placeholder: '', help_text: '', source: config.staticSource.value,
      options: type === DROPDOWN_TYPE ? [...NEW_DROPDOWN_OPTIONS] : [],
      is_display: kind === 'list' && !fields.value.some((f) => f.is_display) && config.isDisplayType(type),
      list_id: null, depends_on_field_id: null, match_field_id: null, schedule_id: null, contact_field_id: null,
      name_field_id: null,
      visibility: { ...VISIBILITY_OFF }
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
      visibility: { ...source.visibility },
      display_label: `${source.display_label} copy`, is_display: false }
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
    if (field.data_type === SLOT_TYPE) field.is_mandatory = true
    if (!config.isDisplayType(field.data_type)) field.is_display = false
  }

  // Lists have exactly one display column: choosing one clears the others.
  function setDisplay(field) {
    for (const f of fields.value) f.is_display = f === field
  }

  async function setAccepting(accepting) {
    const result = await api.updateShare(tenantCode, slug, { accepting_submissions: accepting })
    form.value = { ...form.value, accepting_submissions: result[kind].accepting_submissions }
  }

  return {
    kind, config, form, formName, fields, selectedKey, selected, fieldErrors, generalErrors,
    loading, saving, publishing, dirty, isDraft, canPublish,
    load, save, publish, setAccepting, addField, move, duplicate, remove, onTypeChange, setDisplay, nameProblem
  }
}
