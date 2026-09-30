<template>
  <form class="preview-form" novalidate @submit.prevent="submit">
    <div v-for="field in fields" :key="field.key" class="field">
      <label v-if="kind(field) !== 'boolean'" :for="inputId(field)">
        {{ field.display_label || 'Untitled field' }}<span v-if="field.is_mandatory" class="required-star">*</span>
      </label>

      <InputText
        v-if="['text', 'email', 'phone'].includes(kind(field))"
        :id="inputId(field)"
        v-model="values[field.key]"
        :type="kind(field) === 'email' ? 'email' : kind(field) === 'phone' ? 'tel' : 'text'"
        :maxlength="maxLengthFor(field)"
        :placeholder="field.placeholder || ''"
        :invalid="!!fieldError(field)"
        fluid
      />

      <Textarea
        v-else-if="kind(field) === 'textarea'"
        :id="inputId(field)"
        v-model="values[field.key]"
        :placeholder="field.placeholder || ''"
        :invalid="!!fieldError(field)"
        rows="3"
        autoResize
        fluid
      />

      <InputNumber
        v-else-if="kind(field) === 'number'"
        :inputId="inputId(field)"
        v-model="values[field.key]"
        :placeholder="field.placeholder || ''"
        :useGrouping="false"
        :maxFractionDigits="isWholeNumber(field) ? 0 : 4"
        :invalid="!!fieldError(field)"
        fluid
      />

      <DatePicker
        v-else-if="kind(field) === 'date'"
        :inputId="inputId(field)"
        v-model="values[field.key]"
        dateFormat="dd/mm/yy"
        :placeholder="field.placeholder || 'dd/mm/yyyy'"
        showIcon
        :invalid="!!fieldError(field)"
        fluid
      />

      <DatePicker
        v-else-if="kind(field) === 'time'"
        :inputId="inputId(field)"
        v-model="values[field.key]"
        timeOnly
        hourFormat="12"
        :placeholder="field.placeholder || 'hh:mm'"
        :invalid="!!fieldError(field)"
        fluid
      />

      <div v-else-if="kind(field) === 'boolean'" class="row-inline" style="justify-content: flex-start">
        <Checkbox :inputId="inputId(field)" v-model="values[field.key]" binary :invalid="!!fieldError(field)" />
        <label :for="inputId(field)">
          {{ field.display_label || 'Untitled field' }}<span v-if="field.is_mandatory" class="required-star">*</span>
        </label>
      </div>

      <template v-else-if="kind(field) === 'dropdown'">
        <Select
          v-if="optionSource(field) === staticSource"
          :inputId="inputId(field)"
          v-model="values[field.key]"
          :options="optionList(field).filter(Boolean)"
          :placeholder="field.placeholder || 'Select'"
          :invalid="!!fieldError(field)"
          showClear
          fluid
        />
        <Select
          v-else
          :inputId="inputId(field)"
          :options="[]"
          :placeholder="`Options will load from ${optionSource(field)}`"
          disabled
          fluid
        />
      </template>

      <small v-if="field.help_text" class="hint">{{ field.help_text }}</small>
      <small v-if="fieldError(field)" class="error">{{ fieldError(field) }}</small>
    </div>

    <div v-if="!fields.length" class="empty">Add fields to see the preview.</div>

    <Button v-else type="submit" :label="submitLabel" icon="pi pi-send" :loading="submitting" />
  </form>
</template>

<script setup>
import { reactive, watch } from 'vue'
import {
  EMAIL_PATTERN, INPUT_KIND_BY_INPUT_TYPE, INPUT_KIND_BY_TYPE, PHONE_PATTERN, WHOLE_NUMBER_TYPES
} from '@/constants/fieldTypes'

const props = defineProps({
  fields: { type: Array, required: true },
  // type_key -> input_field_type, from /v1/getDataTypes
  inputTypes: { type: Object, default: () => ({}) },
  // These three come from GET /v1/meta/builder (see useBuilderConfig).
  staticSource: { type: String, required: true },
  defaultTextLength: { type: Number, required: true },
  defaultPhoneLength: { type: Number, required: true },
  submitLabel: { type: String, default: 'Submit' },
  // Errors from the server, keyed like the fields (field.key)
  externalErrors: { type: Object, default: () => ({}) },
  submitting: { type: Boolean, default: false }
})

const emit = defineEmits(['submitted'])

const values = reactive({})
const errors = reactive({})

watch(
  () => props.fields.map((f) => f.key),
  () => {
    for (const key of Object.keys(values)) delete values[key]
    for (const key of Object.keys(errors)) delete errors[key]
  }
)

function kind(field) {
  const key = String(field.data_type || '').toLowerCase()
  return INPUT_KIND_BY_TYPE[key]
    || INPUT_KIND_BY_INPUT_TYPE[String(props.inputTypes[key] || '').toLowerCase()]
    || 'text'
}

function maxLengthFor(field) {
  return field.max_length || (kind(field) === 'phone' ? props.defaultPhoneLength : props.defaultTextLength)
}

function isWholeNumber(field) {
  return WHOLE_NUMBER_TYPES.includes(String(field.data_type).toLowerCase())
}

function optionSource(field) {
  return field.source || field.options_config?.source || props.staticSource
}

function optionList(field) {
  return field.options || field.options_config?.options || []
}

function fieldError(field) {
  return errors[field.key] || props.externalErrors[field.key] || ''
}

// Clears all answers, e.g. after a successful submission.
function reset() {
  for (const key of Object.keys(values)) delete values[key]
  for (const key of Object.keys(errors)) delete errors[key]
}

defineExpose({ reset })

function inputId(field) {
  return `preview-${field.key}`
}

function isEmpty(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

function validate() {
  let ok = true
  for (const field of props.fields) {
    const value = values[field.key]
    const type = kind(field)
    let message = ''

    if (field.is_mandatory && (type === 'boolean' ? value !== true : isEmpty(value))) {
      message = type === 'boolean' ? 'Please tick this box.' : 'This field is required.'
    } else if (!isEmpty(value) && type === 'email' && !EMAIL_PATTERN.test(value)) {
      message = 'Enter a valid email address.'
    } else if (!isEmpty(value) && type === 'phone' && !PHONE_PATTERN.test(value)) {
      message = 'Enter a valid phone number.'
    }

    errors[field.key] = message
    if (message) ok = false
  }
  return ok
}

function submit() {
  if (validate()) emit('submitted', { ...values })
}
</script>
