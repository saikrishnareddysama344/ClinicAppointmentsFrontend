<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" />

    <div class="page-head">
      <div>
        <h1>{{ meta.plural }}</h1>
        <p class="sub">{{ intro }}</p>
      </div>
      <Button v-if="canDo('create')" :label="`New ${label}`" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="panel">
      <DataTable :value="items" :loading="loading" dataKey="id" rowHover
                 :rowClass="() => 'clickable-row'" @row-click="(e) => (isBuilder ? openBuilder(e.data) : e.data.status !== FORM_STATUS.DRAFT && canRows(e.data) && openRows(e.data))">
        <template #empty>
          <div class="empty">
            <i class="pi pi-file-edit" aria-hidden="true" />
            No {{ label }}s yet. {{ example }}
          </div>
        </template>
        <Column field="display_name" :header="meta.label">
          <template #body="{ data }">
            <strong>{{ data.display_name }}</strong>
            <div class="mono muted">{{ data.slug }}</div>
          </template>
        </Column>
        <Column field="field_count" header="Fields" style="width: 80px" />
        <Column v-if="kind === 'form'" header="Status" style="width: 200px">
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
              <Button v-if="isBuilder" icon="pi pi-pencil" text rounded aria-label="Open builder" v-tooltip.top="'Open builder'"
                      @click="openBuilder(data)" />
              <Button v-if="data.status !== FORM_STATUS.DRAFT && canRows(data)" :icon="kind === 'form' ? 'pi pi-inbox' : 'pi pi-table'"
                      text rounded :aria-label="rowsLabel" v-tooltip.top="rowsLabel" @click="openRows(data)" />
              <Button v-if="data.status === FORM_STATUS.DRAFT && canDo('delete')" icon="pi pi-trash" text rounded severity="danger"
                      aria-label="Delete draft" v-tooltip.top="'Delete draft'" @click="confirmDelete(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="showCreate" modal :header="`New ${label}`" :style="{ width: '460px' }">
      <form class="form-grid" @submit.prevent="createForm">
        <div class="field">
          <label for="form-name">{{ meta.label }} name<span class="required-star">*</span></label>
          <InputText id="form-name" v-model="draft.name" fluid autofocus :placeholder="kind === 'form' ? 'Appointment booking' : 'Doctors'"
                     @input="syncSlug" />
          <small v-if="kind === 'list'" class="hint">For example Doctors, Branches or Services. Any form can use it.</small>
          <small v-if="errors.display_name" class="error">{{ errors.display_name }}</small>
        </div>
        <!-- Only forms need a chosen link name (it is the public link); a list's is made from its name. -->
        <div v-if="kind === 'form'" class="field">
          <label for="form-slug">Link name</label>
          <InputText id="form-slug" v-model="draft.slug" fluid class="mono" placeholder="appointment-booking"
                     @input="slugEdited = true" />
          <small class="hint">Used in links<template v-if="kind === 'form'">: /f/{{ tenantCode }}/{{ draft.slug || '…' }}</template>. It cannot change later.</small>
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
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import FormStatusTag from '@/components/common/FormStatusTag.vue'
import TenantNav from '@/components/layout/TenantNav.vue'
import { useNotify } from '@/composables/useNotify'
import { FLAG_YES, FORM_STATUS } from '@/constants/formStatus'
import { KIND_ROUTES } from '@/router'
import { definitionApis, KINDS } from '@/services/api'
import { can } from '@/services/auth'
import { formatEpoch, tenantCodeFromName } from '@/utils/format'

// Forms and lists: the same page, for either kind.
const props = defineProps({
  tenantCode: { type: String, required: true },
  kind: { type: String, default: 'form' }
})
// The builder page ("forms" / "lists") and each one's own rows page ("form:12" / "list:7").
const canDo = (action) => can(props.tenantCode, `${props.kind}s`, action)
const isBuilder = computed(() => canDo('view'))
const canRows = (item) => can(props.tenantCode, `${props.kind}:${item.id}`)

const router = useRouter()
const notify = useNotify()
const confirm = useConfirm()

const meta = computed(() => KINDS[props.kind])
const label = computed(() => meta.value.label.toLowerCase())
const api = computed(() => definitionApis[props.kind])
const rowsLabel = computed(() => (props.kind === 'form' ? 'Submissions' : 'Rows'))
const intro = computed(() => props.kind === 'form'
  ? 'Forms collect answers, for example appointment requests. Publish one to get its public link.'
  : 'Lists hold your own data, for example branches, doctors or services. Form dropdowns can use them.')
const example = computed(() => props.kind === 'form' ? 'Create one, for example "Appointment booking".'
  : 'Create one, for example "Branches" or "Doctors".')

const items = ref([])
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
    items.value = (await api.value.list(props.tenantCode))[`${props.kind}s`]
  } catch (e) {
    notify.error(`Could not load ${label.value}s`, e)
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

const go = (target, item) => router.push({ name: KIND_ROUTES[props.kind][target],
  params: { tenantCode: props.tenantCode, slug: item.slug } })
const openBuilder = (item) => go('builder', item)
const openRows = (item) => go('rows', item)

async function createForm() {
  Object.assign(errors, { display_name: '', slug: '' })
  saving.value = true
  try {
    const result = await api.value.create(props.tenantCode,
      { display_name: draft.name, ...(props.kind === 'form' ? { slug: draft.slug } : {}) })
    showCreate.value = false
    openBuilder(result[props.kind])
  } catch (e) {
    if (e.data?.errors) Object.assign(errors, e.data.errors)
    else notify.error(`Could not create ${label.value}`, e)
  } finally {
    saving.value = false
  }
}

function confirmDelete(item) {
  confirm.require({
    header: `Delete draft ${label.value}?`,
    message: `"${item.display_name}" and its fields will be removed. This cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: 'Cancel', severity: 'secondary', text: true },
    acceptProps: { label: 'Delete', severity: 'danger' },
    accept: async () => {
      try {
        await api.value.remove(props.tenantCode, item.slug)
        notify.success('Draft deleted')
        await load()
      } catch (e) {
        notify.error('Could not delete', e)
      }
    }
  })
}

watch(() => [props.tenantCode, props.kind], load, { immediate: true })
</script>

<style scoped>
.closed-note {
  font-size: 0.78rem;
  margin-top: 0.25rem;
}
</style>
