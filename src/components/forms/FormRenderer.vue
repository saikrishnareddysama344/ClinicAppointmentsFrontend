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
        :disabled="!!otpOf(field).token"
        fluid
      />

      <div v-if="needsOtp(field)" class="otp">
        <template v-if="otpOf(field).token">
          <span class="verified"><i class="pi pi-check-circle" aria-hidden="true" /> Verified</span>
          <Button label="Change number" text size="small" @click="resetOtp(field)" />
        </template>
        <template v-else>
          <Button v-if="!otpOf(field).sent" label="Send code" icon="pi pi-send" size="small" severity="secondary"
                  :loading="otpOf(field).busy" @click="sendOtp(field)" />
          <template v-else>
            <InputText v-model="otpOf(field).code" inputmode="numeric" maxlength="6" placeholder="6-digit code"
                       :aria-label="`Code for ${field.display_label}`" class="code" />
            <Button label="Verify" size="small" :loading="otpOf(field).busy" @click="verifyOtp(field)" />
            <Button label="Send by SMS instead" text size="small" @click="sendOtp(field, 'sms')" />
          </template>
          <small v-if="otpOf(field).message" class="hint">{{ otpOf(field).message }}</small>
        </template>
      </div>

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

      <Select
        v-else-if="kind(field) === 'dropdown' && !isList(field)"
        :inputId="inputId(field)"
        v-model="values[field.key]"
        :options="optionList(field).filter(Boolean)"
        :placeholder="field.placeholder || 'Select'"
        :invalid="!!fieldError(field)"
        showClear
        fluid
      />

      <!-- Options from a list: stored as the row id, shown by the list's display column. -->
      <Select
        v-else-if="kind(field) === 'dropdown'"
        :inputId="inputId(field)"
        v-model="values[field.key]"
        :options="listOptions[field.key] || []"
        optionLabel="label"
        optionValue="id"
        :filter="(listOptions[field.key] || []).length > 8"
        :disabled="!optionsLoader || !!waitingFor(field)"
        :placeholder="!optionsLoader ? 'Options load from the list' : waitingFor(field)
          ? `Choose ${waitingFor(field).display_label} first`
          : loadingOptions[field.key] ? 'Loading…' : field.placeholder || 'Select'"
        :invalid="!!fieldError(field)"
        showClear
        fluid
      />

      <SlotPicker v-else-if="kind(field) === 'slot'" v-model="values[field.key]" :field="field"
                  :api="slotApi ? slotApi(field) : null" :refreshKey="refreshKey" />

      <small v-if="field.help_text" class="hint">{{ field.help_text }}</small>
      <small v-if="fieldError(field)" class="error">{{ fieldError(field) }}</small>
    </div>

    <div v-if="!fields.length" class="empty">Add fields to see the preview.</div>

    <Button v-else type="submit" :label="submitLabel" icon="pi pi-send" :loading="submitting" />
  </form>
</template>

<script setup>
import { computed, nextTick, reactive, watch } from 'vue'
import SlotPicker from './SlotPicker.vue'
import {
  EMAIL_PATTERN, INPUT_KIND_BY_INPUT_TYPE, INPUT_KIND_BY_TYPE, LIST_SOURCE, PHONE_PATTERN, WHOLE_NUMBER_TYPES
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
  submitting: { type: Boolean, default: false },
  // (field, parentValue) => Promise<[{id, label}]>, for dropdowns whose options come from a list
  optionsLoader: { type: Function, default: null },
  // (field) => { options(part, whereId), availability(params) }, for appointment slots
  slotApi: { type: Function, default: null },
  // Starting answers keyed like the fields, e.g. when editing a list row
  initialValues: { type: Object, default: () => ({}) },
  // Labels of starting list-dropdown values (a row that is now inactive is not in the options)
  initialLabels: { type: Object, default: () => ({}) },
  // Bump to reload appointment times (e.g. after "this window is full")
  refreshKey: { type: Number, default: 0 },
  // Desk entry: a list dropdown with a single choice (e.g. a role limited to one branch) is chosen already
  autoFill: { type: Boolean, default: false },
  // Public form: { send(phone, channel), verify(phone, code) -> token } for phone fields with "Verify by OTP"
  otpApi: { type: Object, default: null }
})

const emit = defineEmits(['submitted'])

const values = reactive({})
const errors = reactive({})

// ---------- OTP (public form): a phone field marked "Verify by OTP" needs a code before submitting ----------
const otp = reactive({})   // field.key -> { sent, code, token, busy, message }
const needsOtp = (field) => !!props.otpApi && !!field.verify_otp
const otpOf = (field) => (otp[field.key] ||= { sent: false, code: '', token: null, busy: false, message: '' })
function resetOtp(field) {
  Object.assign(otpOf(field), { sent: false, code: '', token: null, message: '' })
}
async function sendOtp(field, channel) {
  const o = otpOf(field)
  if (isEmpty(values[field.key])) {
    errors[field.key] = 'Enter the mobile number first.'
    return
  }
  Object.assign(o, { busy: true, message: '' })
  try {
    o.message = (await props.otpApi.send(values[field.key], channel)).message
    o.sent = true
  } catch (e) {
    o.message = e.message
  } finally {
    o.busy = false
  }
}
async function verifyOtp(field) {
  const o = otpOf(field)
  Object.assign(o, { busy: true, message: '' })
  try {
    o.token = (await props.otpApi.verify(values[field.key], o.code)).token
    delete errors[field.key]
  } catch (e) {
    o.message = e.message
  } finally {
    o.busy = false
  }
}
// Tokens of the verified numbers, keyed by field id (sent with the submission)
const otpTokens = () => Object.fromEntries(props.fields.filter((f) => needsOtp(f) && otpOf(f).token).map((f) => [f.id, otpOf(f).token]))

let initialPass = true   // true while the starting answers are being applied
// Keys compared by value: the parent may rebuild the same fields (e.g. slot details arriving later), which
// must not wipe what was already typed.
watch(() => [props.fields.map((f) => f.key).join('\u0000'), props.initialValues], () => reset(), { immediate: true })

// ---------- dropdowns fed by lists (optionally depending on an earlier dropdown) ----------
const listOptions = reactive({})
const loadingOptions = reactive({})

const isList = (field) => optionSource(field) === LIST_SOURCE
const parentOf = (field) => field.depends_on_field_id
  ? props.fields.find((f) => f.id != null && f.id === field.depends_on_field_id) : null
// The parent dropdown the patient still has to choose, if any.
const waitingFor = (field) => {
  const parent = parentOf(field)
  return parent && isEmpty(values[parent.key]) ? parent : null
}

// initial: loading for the starting answers. Then a value missing from the options (an inactive row)
// is kept and shown with its label; later, when the parent changes, it is cleared instead.
async function loadOptions(field, initial) {
  const parent = parentOf(field)
  if (!props.optionsLoader || waitingFor(field)) {
    listOptions[field.key] = []
  } else {
    loadingOptions[field.key] = true
    try {
      listOptions[field.key] = await props.optionsLoader(field, parent ? values[parent.key] : null)
    } catch {
      listOptions[field.key] = []
    } finally {
      loadingOptions[field.key] = false
    }
  }
  const value = values[field.key]
  if (!isEmpty(value) && !listOptions[field.key].some((o) => o.id === value)) {
    if (initial) listOptions[field.key] = [{ id: value, label: props.initialLabels[field.key] ?? `#${value}` }, ...listOptions[field.key]]
    else values[field.key] = null
  }
  // Only one choice (e.g. a role limited to one branch): chosen already.
  if (props.autoFill && isEmpty(values[field.key]) && listOptions[field.key].length === 1) {
    values[field.key] = listOptions[field.key][0].id
  }
}

// One entry per list dropdown: its key and its parent's current value. Reload what changed.
const dependencies = computed(() => props.fields.filter(isList)
  .map((f) => `${f.key}:${parentOf(f) ? values[parentOf(f).key] ?? '' : ''}`))
watch(dependencies, (now, before = []) => {
  const seen = new Set(before.map((e) => e.split(':')[0]))
  for (const entry of now.filter((e) => !before.includes(e))) {
    const field = props.fields.find((f) => f.key === entry.split(':')[0])
    if (field) loadOptions(field, initialPass || !seen.has(field.key))
  }
}, { immediate: true })

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

// Back to the starting answers, e.g. after a successful submission.
function reset() {
  for (const key of Object.keys(values)) delete values[key]
  for (const key of Object.keys(errors)) delete errors[key]
  Object.assign(values, props.initialValues)
  initialPass = true
  nextTick(() => { initialPass = false })   // after the option reloads this causes
}

defineExpose({ reset, otpTokens })

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

    if (type === 'slot' && props.slotApi && !value?.window_id) {
      message = 'Choose a date and a time window.'
    } else if (type === 'slot') {
      message = ''
    } else if (field.is_mandatory && (type === 'boolean' ? value !== true : isEmpty(value))) {
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
  const unverified = props.fields.filter((f) => needsOtp(f) && !otpOf(f).token)
  unverified.forEach((f) => { errors[f.key] = 'Verify this number with the code we send.' })
  if (validate() && !unverified.length) emit('submitted', { ...values })
}
</script>

<style scoped>
.otp {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.4rem;
}

.otp .code {
  width: 8rem;
}

.verified {
  color: var(--p-green-600, #16a34a);
  font-weight: 600;
}
</style>
