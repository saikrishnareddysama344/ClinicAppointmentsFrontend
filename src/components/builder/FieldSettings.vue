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

      <div class="row-inline">
        <label for="f-mandatory" class="strong">Mandatory</label>
        <ToggleSwitch inputId="f-mandatory" v-model="field.is_mandatory" />
      </div>

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
          <Select id="f-source" v-model="field.source" :options="sourceOptions" optionLabel="label"
                  optionValue="value" fluid />
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

        <div v-else class="lock-note">
          <i class="pi pi-info-circle" aria-hidden="true" />
          <span>Options will load from the tenant's {{ field.source }} once that data is built. The setting is saved now.</span>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { DROPDOWN_TYPE } from '@/constants/fieldTypes'

// The field object is owned by useFormBuilder; this panel edits it in place.
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
  columnPreview: { type: Function, required: true }
})

const emit = defineEmits(['type-change'])

const locked = computed(() => !!props.field?.column_name)

const columnName = computed(() =>
  props.field?.column_name || props.columnPreview(props.field?.display_label) || 'field_ID (set when published)'
)

const sourceOptions = computed(() =>
  props.dropdownSources.map((s) => ({ value: s.value, label: s.available ? s.label : `${s.label} (coming later)` }))
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
