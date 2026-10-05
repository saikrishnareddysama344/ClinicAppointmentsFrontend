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
        <Button v-if="canEntry" label="New entry" icon="pi pi-plus" @click="entryOpen = true" />
        <SelectButton v-model="sourceFilter" :options="SOURCES" optionLabel="label" optionValue="value"
                      :allowEmpty="false" aria-label="Booked by" />
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
      <DataTable :value="shown(w)" dataKey="id" size="small" :rowClass="rowClass">
        <template #empty><span class="muted">No bookings yet.</span></template>
        <Column header="#" style="width: 50px"><template #body="{ data }">{{ position(w, data) }}</template></Column>
        <Column field="token_no" header="Token" style="width: 70px" />
        <Column v-for="col in answerColumns(w)" :key="col.field_id" :header="col.label">
          <template #body="{ data }">{{ answer(data, col) }}</template>
        </Column>
        <Column header="Visit" style="width: 170px">
          <template #body="{ data }">
            <Tag :value="visitLabel(data)" :severity="data.visit_type === 'revisit' ? 'info' : 'secondary'" />
            <div v-if="data.visit_type === 'revisit' && data.valid_until" class="muted small">
              valid till {{ displayValue('date', data.valid_until) }}</div>
          </template>
        </Column>
        <Column header="Amount" style="width: 140px">
          <template #body="{ data }">
            <span :class="{ due: needsPayment(data) }">{{ data.status === 'cancelled' && data.paid ? 'Paid – cancelled' : amountLabel(data) }}</span>
          </template>
        </Column>
        <Column header="Booked by" style="width: 150px"><template #body="{ data }">{{ data.booked_by_text }}</template></Column>
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
        <Column style="width: 250px">
          <template #body="{ data }">
            <div v-if="data.status === 'booked'" class="row-actions">
              <Button v-if="canDo('payment') && needsPayment(data)" icon="pi pi-wallet" text rounded severity="success"
                      aria-label="Payment received" v-tooltip.top="'Payment received'" @click="paying = data" />
              <Button v-else-if="canDo('payment') && canDo('change_amount') && data.paid" icon="pi pi-pencil" text rounded
                      aria-label="Change amount" v-tooltip.top="'Change amount'" @click="paying = data" />
              <template v-if="canDo('queue')">
                <Button v-for="a in visitActions(data)" :key="a.status" :icon="a.icon" text rounded :severity="a.severity"
                        :aria-label="a.label" v-tooltip.top="a.label" @click="setVisit(data, a.status)" />
              </template>
              <Button v-if="printChoices(data).length" icon="pi pi-print" text rounded aria-label="Print"
                      :disabled="needsPayment(data)"
                      v-tooltip.top="needsPayment(data) ? 'Mark the payment received first' : 'Print'"
                      @click="openPrintMenu($event, data)" />
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

    <EntryDialog v-model:visible="entryOpen" :tenantCode="tenantCode" @saved="entered" />
    <PaymentDialog v-if="setup" :tenantCode="tenantCode" :slug="setup.slug" :booking="paying"
                   :canChange="canDo('change_amount')" @close="paying = null" @paid="paid"
                   @changed="(b) => { paying = b; load() }" />
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useRoute } from 'vue-router'
import PaymentDialog from '@/components/bookings/PaymentDialog.vue'
import EntryDialog from '@/components/forms/EntryDialog.vue'
import TenantNav from '@/components/layout/TenantNav.vue'
import { autoPrintBooking, loadClinic, needsPayment } from '@/composables/useClinic'
import { useNotify } from '@/composables/useNotify'
import { ROUTES } from '@/router'
import { schedulesApi } from '@/services/api'
import { can, hasPageLike, isAdmin } from '@/services/auth'
import { displayValue, toApiValue } from '@/utils/format'
import { printBooking } from '@/utils/print'
import { amountLabel, visitLabel } from '@/utils/visit'

const props = defineProps({ tenantCode: { type: String, required: true } })
const t = props.tenantCode
const canDo = (action) => can(t, 'bookings', action)

const VISIT = {
  waiting: { label: 'waiting', severity: 'info' },
  arrived: { label: 'arrived', severity: 'success' },
  not_attended: { label: 'not attended', severity: 'warn' },
  done: { label: 'done', severity: 'secondary' }
}
const SOURCES = [{ value: 'all', label: 'All' }, { value: 'link', label: 'Online' }, { value: 'qr', label: 'QR' },
  { value: 'staff', label: 'At clinic' }]
const PRINTS = { receipt: 'Receipt', op: 'OP sheet' }

const notify = useNotify()
const confirm = useConfirm()

const setup = ref(null)
const settings = ref({})
// ?date=YYYY-MM-DD (from Doctor timings, By date) opens that day.
const queryDate = useRoute().query.date
const day = ref(/^\d{4}-\d{2}-\d{2}$/.test(queryDate || '') ? new Date(`${queryDate}T00:00:00`) : new Date())
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
const sourceFilter = ref('all')
const shown = (w) => (sourceFilter.value === 'all' ? w.bookings : w.bookings.filter((b) => b.source === sourceFilter.value))

// ---------- new entry and payment ----------
const canEntry = computed(() => hasPageLike(t, 'form:', 'add'))
const entryOpen = ref(false)
const paying = ref(null)

// After a desk entry: just the token; payment is taken from the booking's row. A free visit prints at once
// if the clinic auto-prints (with something due, printing waits for the payment).
function entered(result) {
  notify.success(result.booking ? `Token ${result.booking.token_no} booked` : 'Saved')
  load()
  if (result.booking && !needsPayment(result.booking)) {
    autoPrintBooking(t, result.booking).catch((e) => notify.error('Could not print', e))
  }
}

function paid(booking) {
  paying.value = null
  notify.success('Payment saved')
  load()
  autoPrintBooking(t, booking).catch((e) => notify.error('Could not print', e))
}

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

const startPrint = (booking, kinds) => doPrint(booking, kinds)

async function doPrint(booking, kinds) {
  try {
    const data = await schedulesApi.print(t, setup.value.slug, booking.id, kinds)
    printBooking(data, kinds)
    load()
  } catch (e) {
    notify.error('Could not print', e)
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

.due {
  color: var(--p-orange-600, #c2410c);
  font-weight: 600;
}

.small {
  font-size: 0.8rem;
}

.mb {
  margin-bottom: 1rem;
}
</style>
