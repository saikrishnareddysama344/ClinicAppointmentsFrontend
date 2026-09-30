<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" :crumbs="[
      { label: 'Schedules', to: { name: ROUTES.SCHEDULES, params: { tenantCode } } },
      { label: schedule?.display_name || slug }]" />

    <div class="page-head">
      <div>
        <h1>{{ schedule?.display_name || 'Schedule' }}</h1>
        <p v-if="schedule" class="sub">
          Who: <strong>{{ schedule.who_list.name }}</strong>
          <template v-if="schedule.where_list"> · Where: <strong>{{ schedule.where_list.name }}</strong></template>
          · Bookable today + {{ schedule.days_ahead }} days · {{ schedule.timezone }}
        </p>
      </div>
      <div class="actions">
        <SelectButton v-model="tab" :options="['Windows', 'Leave']" :allowEmpty="false" aria-label="Section" />
        <Button :label="tab === 'Windows' ? 'Add window' : 'Add leave'" icon="pi pi-plus" :disabled="!schedule"
                @click="tab === 'Windows' ? editWindow(null) : openLeave()" />
      </div>
    </div>

    <div v-if="tab === 'Windows'" class="panel">
      <DataTable :value="windows" :loading="loading" dataKey="id" :rowClass="(w) => (w.status === 'active' ? '' : 'muted')">
        <template #empty>
          <div class="empty"><i class="pi pi-clock" aria-hidden="true" />No windows yet, for example Monday 09:00–12:00, 20 tokens.</div>
        </template>
        <Column header="Day"><template #body="{ data }">{{ weekdays[data.weekday] }}</template></Column>
        <Column field="who" :header="schedule?.who_list.name" />
        <Column v-if="schedule?.where_list" field="where" :header="schedule.where_list.name" />
        <Column header="Time"><template #body="{ data }">{{ data.start_time }}–{{ data.end_time }}</template></Column>
        <Column field="max_tokens" header="Max tokens" />
        <Column header="Status">
          <template #body="{ data }"><Tag :value="data.status" :severity="data.status === 'active' ? 'success' : 'secondary'" /></template>
        </Column>
        <Column style="width: 110px">
          <template #body="{ data }">
            <div class="actions">
              <Button icon="pi pi-pencil" text rounded aria-label="Edit window" @click="editWindow(data)" />
              <Button :icon="data.status === 'active' ? 'pi pi-eye-slash' : 'pi pi-eye'" text rounded
                      :aria-label="data.status === 'active' ? 'Deactivate window' : 'Reactivate window'"
                      @click="setStatus('windows', data, data.status !== 'active')" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <div v-else class="panel">
      <DataTable :value="leaves" :loading="loading" dataKey="id">
        <template #empty>
          <div class="empty"><i class="pi pi-calendar-times" aria-hidden="true" />No upcoming leave or holidays.</div>
        </template>
        <Column header="Date"><template #body="{ data }">{{ displayValue('date', data.leave_date) }}</template></Column>
        <Column :header="schedule?.who_list.name"><template #body="{ data }">{{ data.who || 'Everyone' }}</template></Column>
        <Column v-if="schedule?.where_list" :header="schedule.where_list.name">
          <template #body="{ data }">{{ data.where || 'All' }}</template>
        </Column>
        <Column header="Covers"><template #body="{ data }">{{ data.window_id ? windowLabel(data.window_id) : 'Whole day' }}</template></Column>
        <Column field="reason" header="Reason" />
        <Column style="width: 70px">
          <template #body="{ data }">
            <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Remove leave"
                    @click="setStatus('leaves', data, false)" />
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="win.open" modal :header="win.id ? 'Edit window' : 'Add window'" :style="{ width: '440px' }">
      <Message v-if="win.error" severity="error" class="mb">{{ win.error }}</Message>
      <form class="form-grid" @submit.prevent="saveWindow">
        <div class="field">
          <label for="w-who">{{ schedule?.who_list.name }}</label>
          <Select inputId="w-who" v-model="win.who_id" :options="options.who" optionLabel="label" optionValue="id" filter fluid />
        </div>
        <div v-if="schedule?.where_list" class="field">
          <label for="w-where">{{ schedule.where_list.name }}</label>
          <Select inputId="w-where" v-model="win.where_id" :options="options.where" optionLabel="label" optionValue="id" fluid />
        </div>
        <div class="field">
          <label for="w-day">Day</label>
          <Select inputId="w-day" v-model="win.weekday" :options="weekdayOptions" optionLabel="label" optionValue="value" fluid />
        </div>
        <div class="row-inline">
          <div class="field grow"><label for="w-start">From</label><InputText id="w-start" v-model="win.start_time" type="time" fluid /></div>
          <div class="field grow"><label for="w-end">To</label><InputText id="w-end" v-model="win.end_time" type="time" fluid /></div>
        </div>
        <div class="field">
          <label for="w-max">Max tokens</label>
          <InputNumber inputId="w-max" v-model="win.max_tokens" :min="1" :useGrouping="false" fluid />
        </div>
      </form>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="win.open = false" />
        <Button label="Save" icon="pi pi-check" :loading="win.saving" @click="saveWindow" />
      </template>
    </Dialog>

    <Dialog v-model:visible="leave.open" modal header="Add leave" :style="{ width: '440px' }">
      <Message v-if="leave.error" severity="error" class="mb">{{ leave.error }}</Message>
      <form class="form-grid" @submit.prevent="saveLeave">
        <div class="field">
          <label for="l-date">Date</label>
          <DatePicker inputId="l-date" v-model="leave.day" dateFormat="dd/mm/yy" showIcon fluid />
        </div>
        <div class="field">
          <label for="l-who">{{ schedule?.who_list.name }} (empty = everyone)</label>
          <Select inputId="l-who" v-model="leave.who_id" :options="options.who" optionLabel="label" optionValue="id" showClear fluid />
        </div>
        <div v-if="schedule?.where_list" class="field">
          <label for="l-where">{{ schedule.where_list.name }} (empty = all)</label>
          <Select inputId="l-where" v-model="leave.where_id" :options="options.where" optionLabel="label" optionValue="id" showClear fluid />
        </div>
        <div class="field">
          <label for="l-window">Only this window (empty = whole day)</label>
          <Select inputId="l-window" v-model="leave.window_id" :options="leaveWindows" optionLabel="label" optionValue="id" showClear fluid />
        </div>
        <div class="field">
          <label for="l-reason">Reason</label>
          <InputText id="l-reason" v-model="leave.reason" maxlength="200" fluid placeholder="Conference, festival…" />
        </div>
      </form>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="leave.open = false" />
        <Button label="Add" icon="pi pi-check" :loading="leave.saving" @click="saveLeave" />
      </template>
    </Dialog>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import TenantNav from '@/components/layout/TenantNav.vue'
import { useCatalog } from '@/composables/useCatalog'
import { useNotify } from '@/composables/useNotify'
import { ROUTES } from '@/router'
import { schedulesApi } from '@/services/api'
import { displayValue, toApiValue } from '@/utils/format'

const props = defineProps({
  tenantCode: { type: String, required: true },
  slug: { type: String, required: true }
})

const notify = useNotify()
const catalog = useCatalog(props.tenantCode)
const t = props.tenantCode

const schedule = ref(null)
const windows = ref([])
const leaves = ref([])
const weekdays = ref([])
const options = reactive({ who: [], where: [] })
const loading = ref(true)
const tab = ref('Windows')

const weekdayOptions = computed(() => weekdays.value.map((label, value) => ({ label, value })))
const windowLabel = (id) => {
  const w = windows.value.find((x) => x.id === id)
  return w ? `${weekdays.value[w.weekday]} ${w.start_time}–${w.end_time}` : `Window ${id}`
}

async function load() {
  loading.value = true
  try {
    const today = toApiValue('date', new Date())
    const [s, w, l] = await Promise.all([schedulesApi.get(t, props.slug), schedulesApi.windows(t, props.slug),
      schedulesApi.leaves(t, props.slug, { from: today }), catalog.load()])
    schedule.value = s.schedule
    windows.value = w.windows
    weekdays.value = w.weekdays
    leaves.value = l.leaves
    options.who = await catalog.listOptions(s.schedule.who_list.id)
    options.where = s.schedule.where_list ? await catalog.listOptions(s.schedule.where_list.id) : []
  } catch (e) {
    notify.error('Could not load the schedule', e)
  } finally {
    loading.value = false
  }
}

// ---------- windows ----------
const win = reactive({ open: false, id: null, error: '', saving: false })

function editWindow(w) {
  Object.assign(win, { open: true, error: '', id: w?.id || null, who_id: w?.who_id ?? null, where_id: w?.where_id ?? null,
    weekday: w?.weekday ?? 0, start_time: w?.start_time || '09:00', end_time: w?.end_time || '12:00',
    max_tokens: w?.max_tokens ?? 20 })
}

async function saveWindow() {
  Object.assign(win, { saving: true, error: '' })
  try {
    const { id, who_id, where_id, weekday, start_time, end_time, max_tokens } = win
    await schedulesApi.saveWindow(t, props.slug, { who_id, where_id, weekday, start_time, end_time, max_tokens }, id)
    win.open = false
    notify.success('Window saved')
    load()
  } catch (e) {
    win.error = Object.values(e.data?.errors || {}).join(' ') || e.message
  } finally {
    win.saving = false
  }
}

// ---------- leave ----------
const leave = reactive({ open: false, error: '', saving: false })
const leaveWindows = computed(() => windows.value
  .filter((w) => w.status === 'active' && (!leave.who_id || w.who_id === leave.who_id)
    && (!leave.where_id || w.where_id === leave.where_id)
    && (!leave.day || w.weekday === (leave.day.getDay() + 6) % 7))
  .map((w) => ({ id: w.id, label: `${w.who}${w.where ? ` · ${w.where}` : ''} · ${w.start_time}–${w.end_time}` })))

function openLeave() {
  Object.assign(leave, { open: true, error: '', day: null, who_id: null, where_id: null, window_id: null, reason: '' })
}

async function saveLeave() {
  Object.assign(leave, { saving: true, error: '' })
  try {
    await schedulesApi.addLeave(t, props.slug, { leave_date: toApiValue('date', leave.day), who_id: leave.who_id,
      where_id: leave.where_id, window_id: leave.window_id, reason: leave.reason })
    leave.open = false
    notify.success('Leave added')
    load()
  } catch (e) {
    leave.error = e.message
  } finally {
    leave.saving = false
  }
}

async function setStatus(part, row, active) {
  try {
    await schedulesApi.setStatus(t, props.slug, part, row.id, active)
    notify.success(part === 'leaves' ? 'Leave removed' : active ? 'Window active' : 'Window deactivated')
    load()
  } catch (e) {
    notify.error('Could not change it', e)
  }
}

onMounted(load)
</script>

<style scoped>
.mb {
  margin-bottom: 1rem;
}

.grow {
  flex: 1;
}
</style>
