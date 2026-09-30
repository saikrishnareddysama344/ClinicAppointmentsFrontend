<template>
  <section class="panel" aria-label="Field settings">
    <div class="builder-col-head"><span>Field settings</span></div>

    <div v-if="!field" class="empty">Select a field to edit its settings.</div>

    <div v-else class="editor-body form-grid">
      <Message v-if="errors?.length" severity="error">
        <div v-for="(err, i) in errors" :key="i">{{ err }}</div>
      </Message>

      <div class="field">
        <label for="f-label">Label<span class="required-star">*</span></label>
        <InputText id="f-label" v-model="field.display_label" fluid :maxlength="limits.max_label_length" />
        <small class="hint">
          Column name: <span class="mono">{{ columnName }}</span>
        </small>
        <small v-if="nameProblem" class="error">{{ nameProblem }}</small>
      </div>

      <div class="field">
        <label for="f-type">Type</label>
        <Select id="f-type" v-model="field.data_type" :options="dataTypes" optionLabel="display_name"
                optionValue="type_key" :disabled="locked" fluid @change="emit('type-change', field)" />
      </div>

      <div v-if="locked" class="lock-note">
        <i class="pi pi-lock" aria-hidden="true" />
        <span>This field is published, so its type and max length are locked. Label, order, mandatory, hints and options can still change.</span>
      </div>

      <div v-if="field.data_type !== SLOT_TYPE" class="row-inline">
        <label for="f-mandatory" class="strong">Mandatory</label>
        <ToggleSwitch inputId="f-mandatory" v-model="field.is_mandatory" />
      </div>

      <div v-if="kind === 'list' && isDisplayType(field.data_type)" class="row-inline">
        <label for="f-display" class="strong">Display column</label>
        <ToggleSwitch inputId="f-display" :modelValue="field.is_display" @update:modelValue="emit('set-display', field)" />
      </div>
      <small v-if="kind === 'list' && field.is_display" class="hint">
        Shown instead of the id wherever a row of this list is chosen or displayed.
      </small>

      <div v-if="isLengthType(field.data_type)" class="field">
        <label for="f-max">Max length</label>
        <InputNumber inputId="f-max" v-model="field.max_length" :min="1" :max="limits.max_text_length"
                     :useGrouping="false" :disabled="locked" :placeholder="String(defaultLength(field.data_type))"
                     fluid />
        <small class="hint">Leave empty for the default ({{ defaultLength(field.data_type) }}).</small>
      </div>

      <div class="field">
        <label for="f-placeholder">Placeholder</label>
        <InputText id="f-placeholder" v-model="field.placeholder" fluid maxlength="255" />
      </div>

      <div class="field">
        <label for="f-help">Help text</label>
        <InputText id="f-help" v-model="field.help_text" fluid maxlength="500" placeholder="Shown under the field" />
      </div>

      <template v-if="field.data_type === DROPDOWN_TYPE">
        <div class="field">
          <label for="f-source">Options come from</label>
          <Select id="f-source" v-model="field.source" :options="dropdownSources" optionLabel="label"
                  optionValue="value" :disabled="locked" fluid />
        </div>

        <div v-if="field.source === staticSource" class="field">
          <label>Options <span class="muted">({{ field.options.length }} / {{ limits.max_dropdown_options }})</span></label>
          <div ref="optionsList" class="options-list">
            <div v-for="(option, i) in field.options" :key="i" class="option-row">
              <InputText v-model="field.options[i]" fluid :maxlength="limits.max_option_length"
                         :aria-label="`Option ${i + 1}`" @keydown.enter.prevent="addOption(i + 1)" />
              <Button icon="pi pi-times" text rounded severity="secondary" aria-label="Remove option"
                      @click="field.options.splice(i, 1)" />
            </div>
          </div>
          <div>
            <Button label="Add option" icon="pi pi-plus" text size="small"
                    :disabled="field.options.length >= limits.max_dropdown_options" @click="addOption()" />
          </div>
          <small class="hint">Press Enter in an option to add the next one.</small>
        </div>

        <template v-else-if="field.source === LIST_SOURCE">
          <div class="field">
            <label for="f-list">List<span class="required-star">*</span></label>
            <Select id="f-list" v-model="field.list_id" :options="lists" optionLabel="display_name" optionValue="id"
                    :disabled="locked" placeholder="Choose a list" fluid />
            <small class="hint">Only lists saved with a display column appear here. The row id is stored.</small>
          </div>
          <div v-if="parents.length" class="field">
            <label for="f-depends">Only show options matching</label>
            <Select id="f-depends" v-model="field.depends_on_field_id" :options="parents" optionLabel="display_label"
                    optionValue="id" placeholder="(no filter)" showClear fluid />
          </div>
          <div v-if="field.depends_on_field_id" class="field">
            <label for="f-match">Through the column</label>
            <Select id="f-match" v-model="field.match_field_id" :options="matchColumns" optionLabel="display_label"
                    optionValue="id" placeholder="Column of the list that refers to it" fluid />
            <small v-if="!matchColumns.length" class="error">
              The chosen list has no column that refers to the same list as that dropdown.
            </small>
          </div>
        </template>
      </template>

      <template v-if="field.data_type === SLOT_TYPE">
        <div class="field">
          <label for="f-schedule">Schedule<span class="required-star">*</span></label>
          <Select id="f-schedule" v-model="field.schedule_id" :options="schedules" optionLabel="display_name"
                  optionValue="id" :disabled="locked" placeholder="Choose a schedule" fluid />
          <small class="hint">Patients pick {{ scheduleParts }}, a date, and a time window, and get a token.</small>
        </div>
        <div class="field">
          <label for="f-contact">One booking per phone number</label>
          <Select id="f-contact" v-model="field.contact_field_id" :options="phoneFields" optionLabel="display_label"
                  optionValue="id" placeholder="(no check)" showClear fluid />
          <small class="hint">Stops the same phone booking the same person twice on one day. Save new fields first.</small>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { DROPDOWN_TYPE, LIST_SOURCE, SLOT_TYPE } from '@/constants/fieldTypes'

// The field object is owned by useBuilder; this panel edits it in place.
const props = defineProps({
  field: { type: Object, default: null },
  errors: { type: Array, default: () => [] },
  nameProblem: { type: String, default: '' },
  dataTypes: { type: Array, default: () => [] },
  dropdownSources: { type: Array, default: () => [] },
  staticSource: { type: String, required: true },
  limits: { type: Object, default: () => ({}) },
  isLengthType: { type: Function, required: true },
  defaultLength: { type: Function, required: true },
  columnPreview: { type: Function, required: true },
  isDisplayType: { type: Function, default: () => false },
  kind: { type: String, default: 'form' },
  // All fields of the form/list (for dependent dropdowns and the phone check)
  siblings: { type: Array, default: () => [] },
  // From useCatalog: usable lists, schedules, and a loader for a list's columns
  lists: { type: Array, default: () => [] },
  schedules: { type: Array, default: () => [] },
  listDefinition: { type: Function, default: async () => null }
})

const emit = defineEmits(['type-change', 'set-display'])

const index = computed(() => props.siblings.indexOf(props.field))
// Earlier saved dropdowns fed by a list: a dependent dropdown can filter on one of them.
const parents = computed(() => props.siblings.slice(0, Math.max(index.value, 0))
  .filter((f) => f.id && f.data_type === DROPDOWN_TYPE && f.source === LIST_SOURCE && f.list_id))
const phoneFields = computed(() => props.siblings.filter((f) => f.id && f.data_type === 'phone'))
const scheduleParts = computed(() => {
  const s = props.schedules.find((x) => x.id === props.field?.schedule_id)
  return s ? [s.where_list?.name, s.who_list.name].filter(Boolean).join(', ') : 'who (and where)'
})

// Columns of the chosen list that refer to the same list as the parent dropdown.
const matchColumns = ref([])
watch(() => [props.field?.list_id, props.field?.depends_on_field_id], async () => {
  const f = props.field
  const parent = parents.value.find((p) => p.id === f?.depends_on_field_id)
  matchColumns.value = []
  if (!parent) return
  const definition = await props.listDefinition(f.list_id)
  matchColumns.value = (definition?.fields || []).filter((c) =>
    c.options_config?.source === LIST_SOURCE && c.options_config.list_id === parent.list_id)
  if (!matchColumns.value.some((c) => c.id === f.match_field_id)) f.match_field_id = matchColumns.value[0]?.id ?? null
}, { immediate: true })

const locked = computed(() => !!props.field?.column_name)

const columnName = computed(() =>
  props.field?.column_name || props.columnPreview(props.field?.display_label) || 'field_ID (set when published)'
)

const optionsList = ref(null)

// Adds an empty option and puts the cursor in it, so typing goes into the new row.
async function addOption(at) {
  const options = props.field.options
  const index = at ?? options.length
  options.splice(index, 0, '')
  await nextTick()
  optionsList.value?.querySelectorAll('input')[index]?.focus()
}
</script>

<style scoped>
.strong {
  font-weight: 600;
}
</style>
