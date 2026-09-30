<template>
  <main class="page">
    <div class="page-head">
      <div>
        <h1>Tenants</h1>
        <p class="sub">Each tenant is a clinic business with its own database schema.</p>
      </div>
      <Button label="New tenant" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="panel">
      <DataTable :value="tenants" :loading="loading" dataKey="id" rowHover
                 :rowClass="() => 'clickable-row'" @row-click="(e) => openTenant(e.data)">
        <template #empty>
          <div class="empty">
            <i class="pi pi-building" aria-hidden="true" />
            No tenants yet. Create the first clinic to start building forms.
          </div>
        </template>
        <Column field="name" header="Name">
          <template #body="{ data }"><strong>{{ data.name }}</strong></template>
        </Column>
        <Column field="code" header="Code">
          <template #body="{ data }"><span class="mono">{{ data.code }}</span></template>
        </Column>
        <Column field="schema_name" header="Schema">
          <template #body="{ data }"><span class="mono">{{ data.schema_name }}</span></template>
        </Column>
        <Column field="form_count" header="Forms" style="width: 90px" />
        <Column header="Created" style="width: 190px">
          <template #body="{ data }"><span class="muted">{{ formatEpoch(data.created_at) }}</span></template>
        </Column>
        <Column style="width: 60px">
          <template #body><i class="pi pi-angle-right muted" aria-hidden="true" /></template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="showCreate" modal header="New tenant" :style="{ width: '460px' }">
      <form class="form-grid" @submit.prevent="createTenant">
        <div class="field">
          <label for="tenant-name">Clinic business name<span class="required-star">*</span></label>
          <InputText id="tenant-name" v-model="draft.name" fluid autofocus @input="syncCode" />
          <small v-if="errors.name" class="error">{{ errors.name }}</small>
        </div>
        <div class="field">
          <label for="tenant-code">Code<span class="required-star">*</span></label>
          <InputText id="tenant-code" v-model="draft.code" fluid class="mono" @input="codeEdited = true" />
          <small class="hint">Lowercase letters, numbers and hyphens. Used in links later.</small>
          <small v-if="errors.code" class="error">{{ errors.code }}</small>
        </div>
      </form>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create tenant" icon="pi pi-check" :loading="saving" @click="createTenant" />
      </template>
    </Dialog>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotify } from '@/composables/useNotify'
import { ROUTES } from '@/router'
import { tenantsApi } from '@/services/api'
import { formatEpoch, tenantCodeFromName } from '@/utils/format'

const router = useRouter()
const notify = useNotify()

const tenants = ref([])
const loading = ref(false)
const showCreate = ref(false)
const saving = ref(false)
const codeEdited = ref(false)
const draft = reactive({ name: '', code: '' })
const errors = reactive({ name: '', code: '' })

function syncCode() {
  if (!codeEdited.value) draft.code = tenantCodeFromName(draft.name)
}

async function load() {
  loading.value = true
  try {
    tenants.value = (await tenantsApi.list()).tenants
  } catch (e) {
    notify.error('Could not load tenants', e)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(draft, { name: '', code: '' })
  Object.assign(errors, { name: '', code: '' })
  codeEdited.value = false
  showCreate.value = true
}

async function createTenant() {
  Object.assign(errors, { name: '', code: '' })
  saving.value = true
  try {
    const { tenant } = await tenantsApi.create({ name: draft.name, code: draft.code })
    showCreate.value = false
    notify.success('Tenant created', `Schema ${tenant.schema_name} is ready.`)
    router.push({ name: ROUTES.FORMS, params: { tenantCode: tenant.code } })
  } catch (e) {
    if (e.data?.errors) Object.assign(errors, e.data.errors)
    else notify.error('Could not create tenant', e)
  } finally {
    saving.value = false
  }
}

function openTenant(tenant) {
  router.push({ name: ROUTES.FORMS, params: { tenantCode: tenant.code } })
}

onMounted(load)
</script>
