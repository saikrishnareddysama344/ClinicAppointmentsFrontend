<template>
  <main class="public-page">
    <div class="public-card">
      <div v-if="state === 'loading'" class="public-state">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        <p>Loading form…</p>
      </div>

      <div v-else-if="state === 'error'" class="public-state">
        <i class="pi pi-exclamation-circle" aria-hidden="true" />
        <h1>Form not available</h1>
        <p>{{ errorMessage }}</p>
      </div>

      <template v-else>
        <header class="public-head">
          <p class="tenant-name">{{ form.tenant_name }}</p>
          <h1>{{ form.title }}</h1>
        </header>

        <div v-if="!form.accepting_submissions" class="public-state">
          <i class="pi pi-lock" aria-hidden="true" />
          <p>This form is not accepting responses right now. Please contact {{ form.tenant_name }} directly.</p>
        </div>

        <div v-else-if="state === 'done'" class="public-state success" role="status">
          <i class="pi pi-check-circle" aria-hidden="true" />
          <h2>Thank you!</h2>
          <p>{{ successMessage }}</p>
          <div v-if="booking" class="token-card">
            <span class="token-label">Your token</span>
            <span class="token-no">{{ booking.token_no }}</span>
            <span>{{ [booking.who, booking.where].filter(Boolean).join(' · ') }}</span>
            <span>{{ displayValue('date', booking.date) }}, {{ booking.start }}–{{ booking.end }}</span>
          </div>
          <Button label="Submit another response" severity="secondary" outlined @click="startAgain" />
        </div>

        <template v-else>
          <Message v-if="formError" severity="error" class="mb">{{ formError }}</Message>

          <!-- Hidden from people; bots fill it in and their submission is ignored. -->
          <div class="hp" aria-hidden="true">
            <label :for="form.honeypot_field">Leave this empty</label>
            <input :id="form.honeypot_field" v-model="honeypot" type="text" tabindex="-1" autocomplete="off" />
          </div>

          <FormRenderer
            ref="renderer"
            :fields="fields"
            :staticSource="form.static_source"
            :defaultTextLength="form.limits.default_text_length"
            :defaultPhoneLength="form.limits.default_phone_length"
            :externalErrors="serverErrors"
            :submitting="submitting"
            :optionsLoader="loadOptions"
            :slotApi="slotApi"
            :refreshKey="refreshKey"
            submitLabel="Submit"
            @submitted="submit"
          />
        </template>
      </template>
    </div>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import FormRenderer from '@/components/forms/FormRenderer.vue'
import { publicApi } from '@/services/api'
import { displayValue, rendererField, toApiValue } from '@/utils/format'

const props = defineProps({
  tenantCode: { type: String, required: true },
  formSlug: { type: String, required: true }
})

const state = ref('loading') // loading | ready | done | error
const form = ref(null)
const errorMessage = ref('')
const successMessage = ref('')
const formError = ref('')
const submitting = ref(false)
const honeypot = ref('')
const serverErrors = reactive({})
const renderer = ref(null)

const booking = ref(null)
const refreshKey = ref(0)   // bumped after a failed booking, so the times reload

const fields = computed(() => (form.value?.fields || []).map(rendererField))

// Dropdowns fed by a list, and the appointment picker, load their choices from the API.
const loadOptions = async (field, parentValue) =>
  (await publicApi.options(props.tenantCode, props.formSlug, field.id, { depends_value: parentValue })).options
const slotApi = (field) => ({
  options: async (part, whereId) =>
    (await publicApi.options(props.tenantCode, props.formSlug, field.id, { part, where_id: whereId })).options,
  availability: (params) => publicApi.availability(props.tenantCode, props.formSlug, field.id, params)
})

function clearServerErrors() {
  for (const key of Object.keys(serverErrors)) delete serverErrors[key]
  formError.value = ''
}

async function load() {
  try {
    form.value = (await publicApi.getForm(props.tenantCode, props.formSlug)).form
    document.title = `${form.value.title} · ${form.value.tenant_name}`
    state.value = 'ready'
  } catch (e) {
    errorMessage.value = e.httpStatus === 404
      ? 'This link is not valid, or the form has not been published yet.'
      : e.message
    state.value = 'error'
  }
}

async function submit(answers) {
  clearServerErrors()
  const values = {}
  for (const field of fields.value) {
    values[field.key] = toApiValue(field.data_type, answers[field.key])
  }

  submitting.value = true
  try {
    const result = await publicApi.submit(props.tenantCode, props.formSlug, {
      values,
      [form.value.honeypot_field]: honeypot.value
    })
    successMessage.value = result.message
    booking.value = result.booking || null
    state.value = 'done'
  } catch (e) {
    Object.assign(serverErrors, e.data?.field_errors || {})
    formError.value = e.message
    if (e.httpStatus === 403) form.value = { ...form.value, accepting_submissions: false }
    if (e.httpStatus === 409) refreshKey.value++
  } finally {
    submitting.value = false
  }
}

function startAgain() {
  clearServerErrors()
  honeypot.value = ''
  state.value = 'ready'
  renderer.value?.reset()
}

onMounted(load)
</script>

<style scoped>
.public-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 2rem 1rem 3rem;
}

.public-card {
  width: 100%;
  max-width: 560px;
  background: var(--p-content-background);
  border: 1px solid var(--p-content-border-color);
  border-radius: 12px;
  padding: 1.5rem;
  align-self: flex-start;
}

.public-head {
  margin-bottom: 1.25rem;
}

.tenant-name {
  margin: 0 0 0.25rem;
  color: var(--p-primary-color);
  font-weight: 600;
  font-size: 0.9rem;
}

.public-head h1 {
  margin: 0;
  font-size: 1.4rem;
}

.public-state {
  text-align: center;
  padding: 1.5rem 0.5rem;
  color: var(--p-text-muted-color);
}

.public-state i {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.75rem;
}

.public-state.success i {
  color: var(--p-green-500);
}

.public-state h1,
.public-state h2 {
  color: var(--p-text-color);
  margin: 0 0 0.5rem;
}

.mb {
  margin-bottom: 1rem;
}

.token-card {
  display: inline-flex;
  flex-direction: column;
  gap: 0.2rem;
  margin: 0.5rem 0 1.25rem;
  padding: 1rem 1.5rem;
  border: 1px solid var(--p-primary-color);
  border-radius: 12px;
  color: var(--p-text-color);
}

.token-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--p-text-muted-color);
}

.token-no {
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--p-primary-color);
  line-height: 1.1;
}

/* Honeypot: off-screen, not display:none (some bots skip hidden inputs). */
.hp {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  overflow: hidden;
}
</style>
