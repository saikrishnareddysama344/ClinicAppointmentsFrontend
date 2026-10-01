<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" />

    <div class="page-head">
      <div>
        <h1>Clinic settings</h1>
        <p class="sub">Clinic details for printouts, who and where patients book, printing and the OP sheet.</p>
      </div>
      <SelectButton v-model="tab" :options="TABS" :allowEmpty="false" aria-label="Section" />
    </div>

    <div v-if="loading" class="panel empty">Loading…</div>

    <form v-else class="panel form-grid settings" @submit.prevent="save">
      <Message v-if="error" severity="error">{{ error }}</Message>

      <template v-if="tab === 'Clinic'">
        <div class="field">
          <label>Name</label>
          <div>{{ form.clinic.name }} <small class="muted">(changed by the app admin)</small></div>
        </div>
        <div class="field">
          <label for="c-address">Address</label>
          <Textarea id="c-address" v-model="form.clinic.address" rows="2" maxlength="300" fluid />
        </div>
        <div class="field">
          <label for="c-phone">Phone</label>
          <InputText id="c-phone" v-model="form.clinic.phone" maxlength="40" fluid />
        </div>
        <div class="field">
          <label for="c-note">Note at the bottom of receipts</label>
          <InputText id="c-note" v-model="form.clinic.receipt_note" maxlength="300" fluid placeholder="Please come 10 minutes early." />
        </div>
      </template>

      <template v-else-if="tab === 'Booking'">
        <Message v-if="!lists.length" severity="warn">
          Make a list first (for example Doctors, with a display column), then choose it here.
        </Message>
        <Message v-if="locked" severity="info">
          Doctors and branches cannot change any more: timings or appointment-slot fields already use them.
        </Message>
        <div class="field">
          <label for="b-who">Who is booked<span class="required-star">*</span></label>
          <Select inputId="b-who" v-model="form.booking.who_list" :options="lists" optionLabel="display_name" optionValue="slug"
                  placeholder="For example Doctors" :disabled="locked" fluid />
        </div>
        <div class="field">
          <label for="b-where">Where (optional)</label>
          <Select inputId="b-where" v-model="form.booking.where_list" :options="lists" optionLabel="display_name" optionValue="slug"
                  placeholder="For example Branches" showClear :disabled="locked" fluid />
        </div>
        <div class="row-inline">
          <div class="field grow">
            <label for="b-days">Patients can book up to (days ahead)</label>
            <InputNumber inputId="b-days" v-model="form.booking.days_ahead" :min="0" :max="365" :useGrouping="false" fluid />
          </div>
          <div class="field grow">
            <label for="b-tz">Time zone</label>
            <InputText id="b-tz" v-model="form.booking.timezone" fluid placeholder="Asia/Kolkata" />
          </div>
        </div>
        <div v-if="hasBooking" class="switch-row">
          <ToggleSwitch v-model="form.booking.is_active" inputId="b-active" />
          <label for="b-active">Booking open (switch off to stop all new bookings)</label>
        </div>
      </template>

      <template v-else-if="tab === 'Printing'">
        <div class="print-grid">
          <div class="print-block">
            <div class="switch-row">
              <ToggleSwitch v-model="form.print.receipt" inputId="p-receipt" />
              <label for="p-receipt"><strong>Receipt</strong></label>
            </div>
            <template v-if="form.print.receipt">
              <div class="field">
                <label for="p-rpaper">Paper</label>
                <Select inputId="p-rpaper" v-model="form.print.receipt_paper" :options="papers.receipt" fluid />
              </div>
              <div class="field">
                <label for="p-rcopies">Copies</label>
                <InputNumber inputId="p-rcopies" v-model="form.print.receipt_copies" :min="1" :max="3" showButtons fluid />
              </div>
              <div class="switch-row">
                <ToggleSwitch v-model="form.print.patient_receipt" inputId="p-patient" />
                <label for="p-patient">Patients can print / save their receipt after booking online</label>
              </div>
            </template>
          </div>
          <div class="print-block">
            <div class="switch-row">
              <ToggleSwitch v-model="form.print.op_sheet" inputId="p-op" />
              <label for="p-op"><strong>OP sheet</strong></label>
            </div>
            <template v-if="form.print.op_sheet">
              <div class="field">
                <label for="p-opaper">Paper</label>
                <Select inputId="p-opaper" v-model="form.print.op_paper" :options="papers.op" fluid />
              </div>
              <div class="field">
                <label for="p-ocopies">Copies</label>
                <InputNumber inputId="p-ocopies" v-model="form.print.op_copies" :min="1" :max="3" showButtons fluid />
              </div>
            </template>
          </div>
        </div>
        <div class="field">
          <label for="p-what">The Print button offers first</label>
          <SelectButton id="p-what" v-model="form.print.print_what" :options="PRINT_WHAT" optionLabel="label"
                        optionValue="value" :allowEmpty="false" />
        </div>
        <div class="switch-row">
          <ToggleSwitch v-model="form.print.auto_print" inputId="p-auto" />
          <label for="p-auto">Open the print dialog right after staff add a booking</label>
        </div>
        <div class="field">
          <label for="p-lang">Extra line on receipts and QR posters (any language)</label>
          <InputText id="p-lang" v-model="form.print.language_line" maxlength="150" fluid />
        </div>
      </template>

      <template v-else-if="tab === 'Fees & revisits'">
        <p class="hint">A paid consultation is valid for some days and some free (or cheaper) revisits with the
          same doctor. Another doctor is always a new consultation. Leave a doctor's value empty to use the default.</p>
        <Message v-if="!hasBooking" severity="info">Set up booking first to give each doctor their own fee.</Message>
        <div class="table-scroll">
        <table class="fees">
          <thead>
            <tr><th>Doctor</th><th>Consultation fee</th><th>Valid days</th><th>Free revisits</th><th>Revisit fee</th>
              <th>No revisits</th></tr>
          </thead>
          <tbody>
            <tr class="default-row">
              <td><strong>Clinic default</strong></td>
              <td v-for="k in FEE_KEYS" :key="k">
                <InputNumber v-model="form.fees.default[k]" :min="0" :max="FEE_MAX[k]" :useGrouping="false"
                             :ariaLabel="`Default ${FEE_LABELS[k]}`" inputClass="num" />
              </td>
              <td />
            </tr>
            <tr v-for="d in form.fees.doctors" :key="d.id">
              <td>{{ d.label }}</td>
              <td v-for="k in FEE_KEYS" :key="k">
                <InputNumber v-model="d[k]" :min="0" :max="FEE_MAX[k]" :useGrouping="false" placeholder="default"
                             :disabled="d.no_revisits && k !== 'fee'" :ariaLabel="`${d.label} ${FEE_LABELS[k]}`" inputClass="num" />
              </td>
              <td><Checkbox v-model="d.no_revisits" binary :inputId="`nr-${d.id}`" :ariaLabel="`${d.label} no revisits`" /></td>
            </tr>
          </tbody>
        </table>
        </div>
      </template>

      <template v-else>
        <div class="field">
          <label for="op-fields">Patient details on top (empty = every answer)</label>
          <MultiSelect inputId="op-fields" v-model="form.template.fields" :options="answerFields" optionLabel="label"
                       optionValue="id" display="chip" placeholder="Every answer" fluid />
        </div>
        <div class="part-title">Sections for the doctor</div>
        <div v-for="(s, i) in form.template.sections" :key="i" class="section-row">
          <InputText v-model="s.title" maxlength="40" placeholder="Title" :aria-label="`Section ${i + 1} title`" />
          <InputText :modelValue="(s.items || []).join(', ')" placeholder="Items (BP, Pulse, …)" class="grow"
                     :aria-label="`Section ${i + 1} items`"
                     @update:modelValue="s.items = $event.split(',').map((v) => v.trim()).filter(Boolean)" />
          <InputNumber v-model="s.lines" :min="0" :max="30" showButtons :ariaLabel="`Section ${i + 1} lines`"
                       inputClass="lines" suffix=" lines" />
          <Button icon="pi pi-arrow-up" text rounded :disabled="!i" :aria-label="`Move section ${i + 1} up`"
                  @click="form.template.sections.splice(i - 1, 0, ...form.template.sections.splice(i, 1))" />
          <Button icon="pi pi-trash" text rounded severity="secondary" :aria-label="`Remove section ${i + 1}`"
                  @click="form.template.sections.splice(i, 1)" />
        </div>
        <div class="actions">
          <Button label="Add section" icon="pi pi-plus" text size="small" :disabled="form.template.sections.length >= 15"
                  @click="form.template.sections.push({ title: '', lines: 3, items: [] })" />
          <Button label="Preview" icon="pi pi-eye" text size="small" @click="preview" />
        </div>
      </template>

      <div class="actions end">
        <Button type="submit" label="Save" icon="pi pi-check" :loading="saving" />
      </div>
    </form>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import TenantNav from '@/components/layout/TenantNav.vue'
import { forgetClinic } from '@/composables/useClinic'
import { useNotify } from '@/composables/useNotify'
import { clinicApi, listsApi, rolesApi } from '@/services/api'
import { opSheetHtml, printSheets } from '@/utils/print'

const props = defineProps({ tenantCode: { type: String, required: true } })
const t = props.tenantCode
const notify = useNotify()

const TABS = ['Clinic', 'Booking', 'Fees & revisits', 'Printing', 'OP sheet']
const FEE_KEYS = ['fee', 'days', 'revisits', 'revisit_fee']
const FEE_LABELS = { fee: 'consultation fee', days: 'valid days', revisits: 'free revisits', revisit_fee: 'revisit fee' }
const FEE_MAX = { fee: 10000000, days: 365, revisits: 20, revisit_fee: 10000000 }
const PRINT_WHAT = [{ value: 'both', label: 'Both' }, { value: 'receipt', label: 'Receipt' }, { value: 'op', label: 'OP sheet' }]
const tab = ref('Clinic')
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const lists = ref([])
const locked = ref(false)
const hasBooking = ref(false)
const papers = ref({ receipt: [], op: [] })
const answerFields = ref([])   // fields of forms with an appointment slot
const form = reactive({ clinic: {}, booking: {}, print: {}, template: { fields: [], sections: [] },
  fees: { default: {}, doctors: [] } })
const doctors = ref([])   // rows of the booking setup's "who" list

function fillFees(rules) {
  form.fees = {
    default: { ...rules.default },
    doctors: doctors.value.map((d) => {
      const own = rules.doctors[String(d.id)] || {}
      return { id: d.id, label: d.label, no_revisits: !!own.no_revisits,
        ...Object.fromEntries(FEE_KEYS.map((k) => [k, own[k] ?? null])) }
    })
  }
}

function fill(body) {
  const b = body.booking
  Object.assign(form, {
    clinic: { ...body.clinic },
    booking: { who_list: b?.who_list.slug || null, where_list: b?.where_list?.slug || null,
      days_ahead: b?.days_ahead ?? 14, timezone: b?.timezone || 'Asia/Kolkata', is_active: b ? b.is_active === 'Y' : true },
    print: { ...body.print_settings },
    template: JSON.parse(JSON.stringify(body.op_template))
  })
  lists.value = body.lists
  locked.value = body.locked
  hasBooking.value = Boolean(b)
  papers.value = body.paper_sizes
  fillFees(body.fee_rules)
}

async function load() {
  loading.value = true
  try {
    const [body, catalog] = await Promise.all([clinicApi.setup(t), rolesApi.catalog(t)])
    doctors.value = body.booking ? (await listsApi.options(t, body.booking.who_list.slug)).options : []
    fill(body)
    answerFields.value = (catalog.pages.find((p) => p.key === 'bookings')?.columns || [])
      .filter((c) => c.key !== 'contact').map((c) => ({ id: Number(c.key), label: c.label }))
  } catch (e) {
    notify.error('Could not load the settings', e)
  } finally {
    loading.value = false
  }
}

// Each tab saves its own part (the booking setup only once a doctors list is chosen).
function payload() {
  if (tab.value === 'Clinic') {
    const { address, phone, receipt_note } = form.clinic
    return { clinic: { address, phone, receipt_note } }
  }
  if (tab.value === 'Booking') {
    const b = { ...form.booking }
    if (locked.value) {
      delete b.who_list
      delete b.where_list
    }
    if (!hasBooking.value) delete b.is_active
    return { booking: b }
  }
  if (tab.value === 'Printing') return { print_settings: form.print }
  if (tab.value === 'Fees & revisits') {
    const own = (d) => Object.fromEntries([...FEE_KEYS.filter((k) => d[k] != null).map((k) => [k, d[k]]),
      ...(d.no_revisits ? [['no_revisits', true]] : [])])
    return { fee_rules: { default: form.fees.default,
      doctors: Object.fromEntries(form.fees.doctors.map((d) => [String(d.id), own(d)])) } }   // {} = use the default
  }
  return { op_template: form.template }
}

async function save() {
  saving.value = true
  error.value = ''
  try {
    const body = await clinicApi.saveSetup(t, payload())
    fill(body)
    forgetClinic(t)
    notify.success(body.message)
  } catch (e) {
    error.value = [e.message, ...Object.values(e.data?.errors || {})].join(' ')
  } finally {
    saving.value = false
  }
}

function preview() {
  const labels = answerFields.value.filter((f) => !form.template.fields.length || form.template.fields.includes(f.id))
  printSheets([[opSheetHtml({
    clinic: { name: form.clinic.name, address: form.clinic.address, phone: form.clinic.phone },
    booking: { op_number: 'OP/0000/000001', token_no: 7, date: new Date().toISOString().slice(0, 10), start: '10:00', end: '12:00',
      who: 'Doctor name', where: form.booking.where_list ? 'Branch name' : null },
    patient: labels.map((f) => ({ field_id: f.id, label: f.label.replace(/ \(.*\)$/, ''), value: '' })),
    op_template: { fields: [], sections: form.template.sections }
  }), 1]], form.print.op_paper, 'OP sheet preview')
}

onMounted(load)
</script>

<style scoped>
.settings {
  max-width: 760px;
}

.grow {
  flex: 1;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.print-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
}

.print-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 0.75rem;
}

.part-title {
  font-weight: 600;
}

.section-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.section-row :deep(.lines) {
  width: 90px;
}

.table-scroll {
  overflow-x: auto;
}

.fees {
  border-collapse: collapse;
  width: 100%;
}

.fees th,
.fees td {
  text-align: left;
  padding: 0.35rem 0.4rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.fees :deep(.num) {
  width: 7rem;
}

.default-row {
  background: var(--p-content-hover-background);
}

.end {
  justify-content: flex-end;
}
</style>
