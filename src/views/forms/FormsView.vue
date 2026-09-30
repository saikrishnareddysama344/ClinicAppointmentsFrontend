<template>
  <main class="page">
    <nav class="crumbs" aria-label="Breadcrumb">
      <router-link :to="{ name: ROUTES.TENANTS }">Tenants</router-link>
      <i class="pi pi-angle-right" aria-hidden="true" />
      <span>{{ tenant?.name || '…' }}</span>
    </nav>

    <div class="page-head">
      <div>
        <h1>{{ tenant?.name || 'Forms' }}</h1>
        <p v-if="tenant" class="sub">
          Code <span class="mono">{{ tenant.code }}</span> · Schema <span class="mono">{{ tenant.schema_name }}</span>
        </p>
      </div>
      <Button label="New form" icon="pi pi-plus" :disabled="!tenant" @click="openCreate" />
    </div>

    <div class="panel">
      <DataTable :value="forms" :loading="loading" dataKey="id" rowHover
                 :rowClass="() => 'clickable-row'" @row-click="(e) => openBuilder(e.data)">
        <template #empty>
          <div class="empty">
            <i class="pi pi-file-edit" aria-hidden="true" />
            No forms yet. Create one, for example "Appointment booking".
          </div>
        </template>
        <Column field="display_name" header="Form">
          <template #body="{ data }">
            <strong>{{ data.display_name }}</strong>
            <div class="mono muted">{{ data.slug }}</div>
          </template>
        </Column>
        <Column field="field_count" header="Fields" style="width: 80px" />
        <Column header="Status" style="width: 200px">
          <template #body="{ data }">
            <FormStatusTag :status="data.status" />
            <div v-if="data.status !== FORM_STATUS.DRAFT && data.accepting_submissions !== FLAG_YES"
                 class="muted closed-note">Not accepting responses</div>
          </template>
        </Column>
        <Column header="Updated" style="width: 180px">
          <template #body="{ data }"><span class="muted">{{ formatEpoch(data.updated_at) }}</span></template>
        </Column>
        <Column style="width: 130px">
          <template #body="{ data }">
            <div class="actions" @click.stop>
              <Button icon="pi pi-pencil" text rounded aria-label="Open builder" v-tooltip.top="'Open builder'"
                      @click="openBuilder(data)" />
              <Button v-if="data.status !== FORM_STATUS.DRAFT" icon="pi pi-inbox" text rounded
                      aria-label="Submissions" v-tooltip.top="'Submissions'" @click="openSubmissions(data)" />
              <Button v-if="data.status === FORM_STATUS.DRAFT" icon="pi pi-trash" text rounded severity="danger"
                      aria-label="Delete draft" v-tooltip.top="'Delete draft'" @click="confirmDelete(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="showCreate" modal header="New form" :style="{ width: '460px' }">
      <form class="form-grid" @submit.prevent="createForm">
        <div class="field">
          <label for="form-name">Form name<span class="required-star">*</span></label>
          <InputText id="form-name" v-model="draft.name" fluid autofocus placeholder="Appointment booking"
                     @input="syncSlug" />
          <small v-if="errors.display_name" class="error">{{ errors.display_name }}</small>
        </div>
        <div class="field">
          <label for="form-slug">Link name</label>
          <InputText id="form-slug" v-model="draft.slug" fluid class="mono" placeholder="appointment-booking"
                     @input="slugEdited = true" />
          <small class="hint">Used in the form's links: /f/{{ tenantCode }}/{{ draft.slug || '…' }}. It cannot change later.</small>
          <small v-if="errors.slug" class="error">{{ errors.slug }}</small>
        </div>
      </form>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="showCreate = false" />
        <Button label="Create and open builder" icon="pi pi-arrow-right" iconPos="right" :loading="saving"
                @click="createForm" />
      </template>
    </Dialog>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import FormStatusTag from '@/components/common/FormStatusTag.vue'
import { useNotify } from '@/composables/useNotify'
import { FLAG_YES, FORM_STATUS } from '@/constants/formStatus'
import { ROUTES } from '@/router'
import { formsApi, tenantsApi } from '@/services/api'
import { formatEpoch, tenantCodeFromName } from '@/utils/format'

const props = defineProps({
  tenantCode: { type: String, required: true }
})

const router = useRouter()
const notify = useNotify()
const confirm = useConfirm()

const tenant = ref(null)
const forms = ref([])
const loading = ref(false)
const showCreate = ref(false)
const saving = ref(false)
const slugEdited = ref(false)
const draft = reactive({ name: '', slug: '' })
const errors = reactive({ display_name: '', slug: '' })

function syncSlug() {
  if (!slugEdited.value) draft.slug = tenantCodeFromName(draft.name).slice(0, 50)
}

async function load() {
  loading.value = true
  try {
    const [tenantResult, formsResult] = await Promise.all([
      tenantsApi.get(props.tenantCode),
      formsApi.listForTenant(props.tenantCode)
    ])
    tenant.value = tenantResult.tenant
    forms.value = formsResult.forms
  } catch (e) {
    notify.error('Could not load forms', e)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  Object.assign(draft, { name: '', slug: '' })
  Object.assign(errors, { display_name: '', slug: '' })
  slugEdited.value = false
  showCreate.value = true
}

async function createForm() {
  Object.assign(errors, { display_name: '', slug: '' })
  saving.value = true
  try {
    const { form } = await formsApi.create(props.tenantCode, { display_name: draft.name, slug: draft.slug })
    showCreate.value = false
    router.push({ name: ROUTES.FORM_BUILDER, params: { tenantCode: props.tenantCode, formSlug: form.slug } })
  } catch (e) {
    if (e.data?.errors) Object.assign(errors, e.data.errors)
    else notify.error('Could not create form', e)
  } finally {
    saving.value = false
  }
}

function openBuilder(form) {
  router.push({ name: ROUTES.FORM_BUILDER, params: { tenantCode: props.tenantCode, formSlug: form.slug } })
}

function openSubmissions(form) {
  router.push({ name: ROUTES.SUBMISSIONS, params: { tenantCode: props.tenantCode, formSlug: form.slug } })
}

function confirmDelete(form) {
  confirm.require({
    header: 'Delete draft form?',
    message: `"${form.display_name}" and its fields will be removed. This cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancel', severity: 'secondary', text: true },
    acceptProps: { label: 'Delete', severity: 'danger' },
    accept: async () => {
      try {
        await formsApi.remove(props.tenantCode, form.slug)
        notify.success('Draft deleted')
        await load()
      } catch (e) {
        notify.error('Could not delete', e)
      }
    }
  })
}

onMounted(load)
</script>

<style scoped>
.closed-note {
  font-size: 0.78rem;
  margin-top: 0.25rem;
}
</style>
