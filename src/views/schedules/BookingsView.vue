<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" />

    <div class="page-head">
      <div>
        <h1>Bookings</h1>
        <p class="sub">
          The day's queue for each doctor's timing. Mark patients as they come; a patient marked not attended
          moves to the end of that list.
          <template v-if="filtered"> Only the bookings your role allows are shown.</template>
        </p>
      </div>
      <div class="actions">
        <DatePicker v-model="day" dateFormat="dd/mm/yy" showIcon ariaLabel="Date" @update:modelValue="load" />
        <Button icon="pi pi-refresh" severity="secondary" outlined aria-label="Refresh" :loading="loading" @click="load" />
      </div>
    </div>

    <div v-if="!loading && !setup" class="panel empty">
      <i class="pi pi-calendar-clock" aria-hidden="true" />Booking is not set up yet.
      <router-link v-if="isAdmin(tenantCode)" :to="{ name: ROUTES.SETTINGS, params: { tenantCode } }">Open Clinic settings</router-link>
    </div>
    <div v-else-if="!windows.length" class="panel empty">
      <i class="pi pi-ticket" aria-hidden="true" />{{ loading ? 'Loading…' : 'No doctor timings on this day.' }}
    </div>

    <section v-for="w in windows" :key="w.window_id" class="panel window-block">
      <div class="window-head">
        <strong>{{ [w.who, w.where].filter(Boolean).join(' · ') }}</strong>
        <span>{{ w.start }}–{{ w.end }}</span>
        <Tag :value="`${w.booked} / ${w.max_tokens} booked`" :severity="w.booked >= w.max_tokens ? 'warn' : 'info'" />
        <Tag v-if="w.closed" value="Session ended" severity="secondary" />
        <Tag v-if="w.status !== 'active'" value="timing inactive" severity="secondary" />
        <span v-if="serving(w)" class="serving">Now: token <b>{{ serving(w).token_no }}</b></span>
        <span class="grow" />
        <Button v-if="canDo('end_session')" :label="w.closed ? 'Reopen session' : 'End session'"
                :icon="w.closed ? 'pi pi-replay' : 'pi pi-stop-circle'" size="small" severity="secondary" outlined
                @click="w.closed ? reopen(w) : endSession(w)" />
      </div>
      <DataTable :value="w.bookings" dataKey="id" size="small" :rowClass="rowClass">
        <template #empty><span class="muted">No bookings yet.</span></template>
        <Column header="#" style="width: 50px"><template #body="{ data }">{{ position(w, data) }}</template></Column>
        <Column field="token_no" header="Token" style="width: 70px" />
        <Column v-for="col in answerColumns(w)" :key="col.field_id" :header="col.label">
          <template #body="{ data }">{{ answer(data, col) }}</template>
        </Column>
        <Column header="OP no." style="width: 140px"><template #body="{ data }">{{ data.op_number || '—' }}</template></Column>
        <Column header="Status" style="width: 170px">
          <template #body="{ data }">
            <Tag v-if="data.status === 'cancelled'" value="cancelled" severity="secondary" />
            <template v-else>
              <Tag :value="VISIT[data.visit_status].label" :severity="VISIT[data.visit_status].severity" />
              <small v-if="data.moved_count" class="muted"> moved ×{{ data.moved_count }}</small>
            </template>
          </template>
        </Column>
        <Column style="width: 210px">
          <template #body="{ data }">
            <div v-if="data.status === 'booked'" class="row-actions">
              <template v-if="canDo('queue')">
                <Button v-for="a in visitActions(data)" :key="a.status" :icon="a.icon" text rounded :severity="a.severity"
                        :aria-label="a.label" v-tooltip.top="a.label" @click="setVisit(data, a.status)" />
              </template>
              <Button v-if="printChoices(data).length" icon="pi pi-print" text rounded aria-label="Print"
                      v-tooltip.top="'Print'" @click="openPrintMenu($event, data)" />
              <Button v-if="canDo('cancel')" icon="pi pi-times" text rounded severity="danger"
                      aria-label="Cancel booking" v-tooltip.top="'Cancel booking'" @click="cancel(data)" />
            </div>
            <Button v-else-if="printChoices(data).length" icon="pi pi-print" text rounded aria-label="Print"
                    v-tooltip.top="'Print'" @click="openPrintMenu($event, data)" />
          </template>
        </Column>
      </DataTable>
    </section>

    <Menu ref="printMenu" :model="menuItems" popup />

    <Dialog v-model:visible="bill.open" modal header="Bill" :style="{ width: '460px' }">
      <p class="muted">Token {{ bill.booking?.token_no }} · {{ bill.booking?.who }}</p>
      <Message v-if="bill.error" severity="error" class="mb">{{ bill.error }}</Message>
      <div v-for="(line, i) in bill.lines" :key="i" class="bill-line">
        <InputText v-model="line.label" placeholder="Item" maxlength="60" :aria-label="`Item ${i + 1}`" class="grow" />
        <InputNumber v-model="line.amount" :min="0" :maxFractionDigits="2" placeholder="Amount"
                     :inputId="`bill-amount-${i}`" :ariaLabel="`Amount ${i + 1}`" inputClass="amount" />
        <Button icon="pi pi-trash" text rounded severity="secondary" :disabled="bill.lines.length === 1"
                :aria-label="`Remove line ${i + 1}`" @click="bill.lines.splice(i, 1)" />
      </div>
      <Button label="Add line" icon="pi pi-plus" text size="small" :disabled="bill.lines.length >= 10"
              @click="bill.lines.push({ label: '', amount: null })" />
      <div class="bill-foot">
        <SelectButton v-model="bill.mode" :options="PAYMENT_MODES" optionLabel="label" optionValue="value"
                      :allowEmpty="false" aria-label="Payment mode" />
        <strong>Total {{ billTotal.toFixed(2) }}</strong>
      </div>
      <template #footer>
        <Button v-if="!settings.bill_required || bill.booking?.bill" label="Print without bill" severity="secondary" text
                @click="doPrint(bill.booking, bill.kinds, null)" />
        <Button label="Save and print" icon="pi pi-print" :loading="bill.saving"
                @click="doPrint(bill.booking, bill.kinds, cleanBill())" />
      </template>
    </Dialog>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import TenantNav from '@/components/layout/TenantNav.vue'
import { loadClinic } from '@/composables/useClinic'
import { useNotify } from '@/composables/useNotify'
import { ROUTES } from '@/router'
import { schedulesApi } from '@/services/api'
import { can, isAdmin } from '@/services/auth'
import { displayValue, toApiValue } from '@/utils/format'
import { printBooking } from '@/utils/print'

const props = defineProps({ tenantCode: { type: String, required: true } })
const t = props.tenantCode
const canDo = (action) => can(t, 'bookings', action)

const VISIT = {
  waiting: { label: 'waiting', severity: 'info' },
  arrived: { label: 'arrived', severity: 'success' },
  not_attended: { label: 'not attended', severity: 'warn' },
  done: { label: 'done', severity: 'secondary' }
}
const PAYMENT_MODES = ['cash', 'upi', 'card', 'other'].map((value) => ({ value, label: value.toUpperCase() }))
const PRINTS = { receipt: 'Receipt', op: 'OP sheet' }

const notify = useNotify()
const confirm = useConfirm()

const setup = ref(null)
const settings = ref({})
const day = ref(new Date())
const windows = ref([])
const filtered = ref(false)
const loading = ref(true)
const date = () => toApiValue('date', day.value)

// ---------- the list ----------
async function load() {
  if (!setup.value || !day.value) return
  loading.value = true
  try {
    const body = await schedulesApi.bookings(t, setup.value.slug, { date: date() })
    windows.value = body.windows
    filtered.value = body.filtered
  } catch (e) {
    notify.error('Could not load bookings', e)
  } finally {
    loading.value = false
  }
}

// Answer columns: every field any booking of the window has (patient name, age, ...).
function answerColumns(w) {
  const seen = new Map()
  w.bookings.forEach((b) => b.answers.forEach((a) => seen.has(a.field_id) || seen.set(a.field_id, a)))
  return [...seen.values()]
}
const answer = (booking, col) => {
  const a = booking.answers.find((x) => x.field_id === col.field_id)
  return displayValue(a?.data_type, a?.value)
}
const active = (w) => w.bookings.filter((b) => b.status === 'booked')
const position = (w, b) => (b.status === 'booked' ? active(w).indexOf(b) + 1 : '')
const serving = (w) => active(w).find((b) => b.visit_status === 'arrived')
const rowClass = (b) => (b.status === 'cancelled' || b.visit_status === 'done' ? 'muted' : '')

// ---------- queue ----------
function visitActions(b) {
  const s = b.visit_status
  return [
    s !== 'arrived' && s !== 'done' && { status: 'arrived', label: 'Arrived', icon: 'pi pi-user-plus', severity: 'success' },
    (s === 'waiting' || s === 'arrived') && { status: 'not_attended', label: 'Not attended (to the end)', icon: 'pi pi-user-minus', severity: 'warn' },
    s === 'arrived' && { status: 'done', label: 'Done', icon: 'pi pi-check', severity: 'secondary' },
    s === 'done' && { status: 'arrived', label: 'Back to arrived', icon: 'pi pi-undo', severity: 'secondary' }
  ].filter(Boolean)
}

async function setVisit(booking, status) {
  try {
    await schedulesApi.setVisit(t, setup.value.slug, booking.id, status)
    load()
  } catch (e) {
    notify.error('Could not save', e)
  }
}

function endSession(w) {
  confirm.require({
    header: `End ${w.who}'s session ${w.start}–${w.end}?`,
    message: 'No more bookings for this timing today, and patients still waiting are marked not attended. You can reopen it.',
    icon: 'pi pi-stop-circle',
    rejectProps: { label: 'Keep open', severity: 'secondary', text: true },
    acceptProps: { label: 'End session' },
    accept: async () => {
      try {
        notify.success((await schedulesApi.endSession(t, setup.value.slug, w.window_id, date())).message)
        load()
      } catch (e) {
        notify.error('Could not end the session', e)
      }
    }
  })
}

async function reopen(w) {
  try {
    await schedulesApi.reopenSession(t, setup.value.slug, w.window_id, date())
    notify.success('Session reopened')
    load()
  } catch (e) {
    notify.error('Could not reopen', e)
  }
}

function cancel(booking) {
  confirm.require({
    header: `Cancel token ${booking.token_no}?`,
    message: 'The place becomes free for someone else. Token numbers are not reused.',
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Keep', severity: 'secondary', text: true },
    acceptProps: { label: 'Cancel booking', severity: 'danger' },
    accept: async () => {
      try {
        await schedulesApi.cancelBooking(t, setup.value.slug, booking.id)
        notify.success('Booking cancelled')
        load()
      } catch (e) {
        notify.error('Could not cancel', e)
      }
    }
  })
}

// ---------- printing ----------
const printMenu = ref()
const menuItems = ref([])

// What this role and the clinic's settings allow for a booking, the clinic's first choice first.
function printChoices(b) {
  const s = settings.value
  const kinds = [s.receipt && canDo('print_receipt') && 'receipt',
    s.op_sheet && canDo('print_op') && b.status === 'booked' && 'op'].filter(Boolean)
  const choices = kinds.map((k) => [k])
  if (kinds.length === 2) choices.push(kinds)
  const first = { receipt: 'receipt', op: 'op', both: kinds.join() }[s.print_what]
  return choices.sort((a, b2) => (b2.join() === first) - (a.join() === first))
}

function openPrintMenu(event, booking) {
  menuItems.value = printChoices(booking).map((kinds) => ({
    label: kinds.map((k) => PRINTS[k]).join(' + '),
    icon: 'pi pi-print',
    command: () => startPrint(booking, kinds)
  }))
  printMenu.value.toggle(event)
}

const bill = reactive({ open: false, booking: null, kinds: [], lines: [], mode: 'cash', error: '', saving: false })
const billTotal = computed(() => bill.lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0))

function startPrint(booking, kinds) {
  if (kinds.includes('receipt') && canDo('bill') && booking.status === 'booked') {
    const old = booking.bill
    Object.assign(bill, { open: true, booking, kinds, error: '', mode: old?.mode || 'cash',
      lines: old ? old.lines.map((l) => ({ label: l.label, amount: Number(l.amount) })) : [{ label: 'Consultation fee', amount: null }] })
    return
  }
  doPrint(booking, kinds, null)
}

function cleanBill() {
  return { mode: bill.mode, lines: bill.lines.filter((l) => l.label || l.amount != null)
    .map((l) => ({ label: l.label.trim(), amount: l.amount ?? 0 })) }
}

async function doPrint(booking, kinds, billData) {
  Object.assign(bill, { saving: true, error: '' })
  try {
    const data = await schedulesApi.print(t, setup.value.slug, booking.id, kinds, billData)
    bill.open = false
    printBooking(data, kinds)
    load()
  } catch (e) {
    if (bill.open) bill.error = e.message
    else notify.error('Could not print', e)
  } finally {
    bill.saving = false
  }
}

onMounted(async () => {
  try {
    const clinic = await loadClinic(t)
    setup.value = clinic.booking
    settings.value = clinic.print_settings || {}
    await load()
  } catch (e) {
    notify.error('Could not load the clinic', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.window-block {
  margin-bottom: 1rem;
}

.window-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.serving b {
  font-size: 1.2em;
}

.grow {
  flex: 1;
}

.row-actions {
  display: flex;
  gap: 0.1rem;
}

.bill-line {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.bill-line :deep(.amount) {
  width: 110px;
}

.bill-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.75rem;
}

.mb {
  margin-bottom: 1rem;
}
</style>
