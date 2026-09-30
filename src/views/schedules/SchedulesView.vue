<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" />

    <div class="page-head">
      <div>
        <h1>Schedules</h1>
        <p class="sub">When each doctor (or anyone in a list) can be booked: weekly time windows with a token limit, and leave.</p>
      </div>
      <Button v-if="can(tenantCode, 'timings.manage')" label="New schedule" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="panel">
      <DataTable :value="catalog.schedules.value" :loading="loading" dataKey="id" rowHover
                 :rowClass="() => 'clickable-row'" @row-click="(e) => open(e.data)">
        <template #empty>
          <div class="empty">
            <i class="pi pi-calendar-clock" aria-hidden="true" />
            No schedules yet. First create lists (for example Doctors and Branches), then a schedule.
          </div>
        </template>
        <Column header="Schedule">
          <template #body="{ data }"><strong>{{ data.display_name }}</strong><div class="mono muted">{{ data.slug }}</div></template>
        </Column>
        <Column header="Who"><template #body="{ data }">{{ data.who_list.name }}</template></Column>
        <Column header="Where"><template #body="{ data }">{{ data.where_list?.name || '—' }}</template></Column>
        <Column header="Booking range"><template #body="{ data }">Today + {{ data.days_ahead }} days</template></Column>
        <Column header="Time zone"><template #body="{ data }"><span class="muted">{{ data.timezone }}</span></template></Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="showCreate" modal header="New schedule" :style="{ width: '460px' }">
      <Message v-if="error" severity="error" class="mb">{{ error }}</Message>
      <form class="form-grid" @submit.prevent="create">
        <div class="field">
          <label for="s-name">Name<span class="required-star">*</span></label>
          <InputText id="s-name" v-model="draft.display_name" fluid autofocus placeholder="OPD hours" />
        </div>
        <div class="field">
          <label for="s-who">Who is booked<span class="required-star">*</span></label>
          <Select id="s-who" v-model="draft.who_list" :options="catalog.lists.value" optionLabel="display_name"
                  optionValue="slug" placeholder="For example Doctors" fluid />
        </div>
        <div class="field">
          <label for="s-where">Where (optional)</label>
          <Select id="s-where" v-model="draft.where_list" :options="catalog.lists.value" optionLabel="display_name"
                  optionValue="slug" placeholder="For example Branches" showClear fluid />
          <small class="hint">Leave empty for a single-location clinic. Who and where cannot change later.</small>
        </div>
        <div class="field">
          <label for="s-days">Patients can book up to (days ahead)</label>
          <InputNumber inputId="s-days" v-model="draft.days_ahead" :min="0" :max="365" :useGrouping="false" fluid />
        </div>
      </form>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create" icon="pi pi-check" :loading="saving" @click="create" />
      </template>
    </Dialog>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import TenantNav from '@/components/layout/TenantNav.vue'
import { useCatalog } from '@/composables/useCatalog'
import { useNotify } from '@/composables/useNotify'
import { ROUTES } from '@/router'
import { schedulesApi } from '@/services/api'
import { can } from '@/services/auth'

const props = defineProps({ tenantCode: { type: String, required: true } })

const router = useRouter()
const notify = useNotify()
const catalog = useCatalog(props.tenantCode)

const loading = ref(true)
const showCreate = ref(false)
const saving = ref(false)
const error = ref('')
const draft = reactive({ display_name: '', who_list: null, where_list: null, days_ahead: 7 })

const open = (schedule) => router.push({ name: ROUTES.SCHEDULE, params: { tenantCode: props.tenantCode, slug: schedule.slug } })

function openCreate() {
  Object.assign(draft, { display_name: '', who_list: null, where_list: null, days_ahead: 7 })
  error.value = ''
  showCreate.value = true
}

async function create() {
  saving.value = true
  error.value = ''
  try {
    const { schedule } = await schedulesApi.create(props.tenantCode, draft)
    await catalog.refresh()
    showCreate.value = false
    open(schedule)
  } catch (e) {
    error.value = Object.values(e.data?.errors || {})[0] || e.message
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await catalog.refresh()
  } catch (e) {
    notify.error('Could not load schedules', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.mb {
  margin-bottom: 1rem;
}
</style>
