<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" />

    <div class="page-head">
      <div>
        <h1>Bookings</h1>
        <p class="sub">Tokens for a day, in the order patients booked.</p>
      </div>
      <div class="actions">
        <Select v-model="scheduleSlug" :options="catalog.schedules.value" optionLabel="display_name" optionValue="slug"
                placeholder="Schedule" ariaLabel="Schedule" @change="load" />
        <DatePicker v-model="day" dateFormat="dd/mm/yy" showIcon ariaLabel="Date" @update:modelValue="load" />
        <Button icon="pi pi-refresh" severity="secondary" outlined aria-label="Refresh" :loading="loading" @click="load" />
      </div>
    </div>

    <div v-if="!catalog.schedules.value.length && !loading" class="panel empty">
      <i class="pi pi-calendar-clock" aria-hidden="true" />No schedules yet. Create one under Schedules.
    </div>
    <div v-else-if="!windows.length" class="panel empty">
      <i class="pi pi-ticket" aria-hidden="true" />{{ loading ? 'Loading…' : 'No time windows on this day.' }}
    </div>

    <section v-for="w in windows" :key="w.window_id" class="panel window-block">
      <div class="window-head">
        <strong>{{ [w.who, w.where].filter(Boolean).join(' · ') }}</strong>
        <span>{{ w.start }}–{{ w.end }}</span>
        <Tag :value="`${w.booked} / ${w.max_tokens} booked`" :severity="w.booked >= w.max_tokens ? 'warn' : 'info'" />
        <Tag v-if="w.status !== 'active'" value="window inactive" severity="secondary" />
      </div>
      <DataTable :value="w.bookings" dataKey="id" size="small" :rowClass="(b) => (b.status === 'cancelled' ? 'muted' : '')">
        <template #empty><span class="muted">No bookings yet.</span></template>
        <Column field="token_no" header="Token" style="width: 80px" />
        <Column v-for="label in answerLabels(w)" :key="label" :header="label">
          <template #body="{ data }">{{ displayValue(null, data.answers[label]) }}</template>
        </Column>
        <Column header="Status" style="width: 120px">
          <template #body="{ data }"><Tag :value="data.status" :severity="data.status === 'booked' ? 'success' : 'secondary'" /></template>
        </Column>
        <Column style="width: 70px">
          <template #body="{ data }">
            <Button v-if="data.status === 'booked'" icon="pi pi-times" text rounded severity="danger"
                    aria-label="Cancel booking" v-tooltip.top="'Cancel booking'" @click="cancel(data)" />
          </template>
        </Column>
      </DataTable>
    </section>
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import TenantNav from '@/components/layout/TenantNav.vue'
import { useCatalog } from '@/composables/useCatalog'
import { useNotify } from '@/composables/useNotify'
import { schedulesApi } from '@/services/api'
import { displayValue, toApiValue } from '@/utils/format'

const props = defineProps({ tenantCode: { type: String, required: true } })

const notify = useNotify()
const confirm = useConfirm()
const catalog = useCatalog(props.tenantCode)

const scheduleSlug = ref(null)
const day = ref(new Date())
const windows = ref([])
const loading = ref(true)

// Answer columns: every label any booking of the window has (patient name, phone, ...).
const answerLabels = (w) => [...new Set(w.bookings.flatMap((b) => Object.keys(b.answers)))]

async function load() {
  if (!scheduleSlug.value || !day.value) return
  loading.value = true
  try {
    windows.value = (await schedulesApi.bookings(props.tenantCode, scheduleSlug.value, { date: toApiValue('date', day.value) })).windows
  } catch (e) {
    notify.error('Could not load bookings', e)
  } finally {
    loading.value = false
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
        await schedulesApi.cancelBooking(props.tenantCode, scheduleSlug.value, booking.id)
        notify.success('Booking cancelled')
        load()
      } catch (e) {
        notify.error('Could not cancel', e)
      }
    }
  })
}

onMounted(async () => {
  try {
    await catalog.refresh()
    scheduleSlug.value = catalog.schedules.value[0]?.slug || null
    await load()
  } catch (e) {
    notify.error('Could not load schedules', e)
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
</style>
