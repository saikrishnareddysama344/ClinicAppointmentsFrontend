<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" />

    <div class="page-head">
      <div>
        <h1>Roles</h1>
        <p class="sub">A role says which pages someone sees, which buttons they get, which columns they can see
          or change and which rows. Give roles to users on the Users tab; several roles add up.</p>
      </div>
      <Button label="New role" icon="pi pi-plus" @click="open(null)" />
    </div>

    <div class="panel">
      <DataTable :value="roles" :loading="loading" dataKey="id">
        <Column header="Role">
          <template #body="{ data }">
            <strong>{{ data.name }}</strong>
            <Tag v-if="data.is_system" value="Built in" severity="secondary" class="ml" />
            <div v-if="data.description" class="muted">{{ data.description }}</div>
          </template>
        </Column>
        <Column header="Pages">
          <template #body="{ data }">
            <span v-if="data.is_system" class="muted">Everything in this clinic</span>
            <span v-else>{{ pageNames(data) || '—' }}</span>
          </template>
        </Column>
        <Column field="user_count" header="Users" style="width: 80px" />
        <Column style="width: 150px">
          <template #body="{ data }">
            <div v-if="!data.is_system" class="actions">
              <Button icon="pi pi-pencil" text rounded aria-label="Edit role" @click="open(data)" />
              <Button icon="pi pi-copy" text rounded aria-label="Copy role" v-tooltip.top="'Copy'" @click="open(data, true)" />
              <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Delete role" @click="remove(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="editor.open" modal maximizable :header="editor.id ? 'Edit role' : 'New role'"
            :style="{ width: '860px' }" :breakpoints="{ '900px': '96vw' }">
      <Message v-if="editor.error" severity="error" class="mb">{{ editor.error }}</Message>
      <div class="form-grid">
        <div class="row-inline">
          <div class="field grow">
            <label for="role-name">Name<span class="required-star">*</span></label>
            <InputText id="role-name" v-model="editor.name" maxlength="100" fluid autofocus placeholder="Front desk" />
          </div>
          <div class="field grow">
            <label for="role-description">Description</label>
            <InputText id="role-description" v-model="editor.description" maxlength="255" fluid />
          </div>
        </div>
        <div v-for="group in groups" :key="group.title" class="group">
          <div class="group-title">{{ group.title }}</div>
          <PageAccessEditor v-for="p in group.pages" :key="p.key" :page="p" :spec="editor.pages[p.key]"
                            :operators="operators" :refOptions="refOptions" />
        </div>
        <small class="hint">Columns left hidden never reach this role's screens, downloads or printouts.
          New columns added later start hidden.</small>
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="editor.open = false" />
        <Button label="Save" icon="pi pi-check" :loading="editor.saving" @click="save" />
      </template>
    </Dialog>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import PageAccessEditor from '@/components/roles/PageAccessEditor.vue'
import TenantNav from '@/components/layout/TenantNav.vue'
import { useNotify } from '@/composables/useNotify'
import { listsApi, rolesApi } from '@/services/api'

const props = defineProps({ tenantCode: { type: String, required: true } })
const t = props.tenantCode
const notify = useNotify()
const confirm = useConfirm()

const roles = ref([])
const catalog = ref([])
const operators = ref({})
const loading = ref(true)

const GROUPS = [
  { title: 'Front desk', types: ['bookings', 'timings'] },
  { title: 'Form submissions', types: ['form'] },
  { title: 'List rows', types: ['list'] },
  { title: 'Building forms and lists', types: ['forms', 'lists'] }
]
const groups = computed(() => GROUPS.map((g) => ({ ...g, pages: catalog.value.filter((p) => g.types.includes(p.type)) }))
  .filter((g) => g.pages.length))
const pageNames = (role) => Object.keys(role.pages || {})
  .map((key) => catalog.value.find((p) => p.key === key)?.label).filter(Boolean).join(', ')

// Rows of lists for doctor / branch style filters, loaded once each.
const refRows = reactive({})
function refOptions(slug) {
  if (!slug) return []
  if (!(slug in refRows)) {
    refRows[slug] = []
    listsApi.options(t, slug).then((b) => { refRows[slug] = b.options }).catch(() => {})
  }
  return refRows[slug]
}

async function load() {
  loading.value = true
  try {
    const [r, c] = await Promise.all([rolesApi.list(t), rolesApi.catalog(t)])
    roles.value = r.roles
    catalog.value = c.pages
    operators.value = c.operators
  } catch (e) {
    notify.error('Could not load roles', e)
  } finally {
    loading.value = false
  }
}

// ---------- editor ----------
const editor = reactive({ open: false, pages: {} })

function specFor(page, saved) {
  const columns = Object.fromEntries((page.columns || []).map((c) => [c.key, saved?.columns?.[c.key] || 'hidden']))
  const filter = (saved?.filter || []).map((c) => ({ column: c.column, op: c.op, value: c.value ?? null }))
  return { on: Boolean(saved), actions: [...(saved?.actions || [])], columns, filter }
}

function open(role, copy = false) {
  Object.assign(editor, {
    open: true, error: '', saving: false,
    id: copy ? null : role?.id || null,
    name: role ? (copy ? `Copy of ${role.name}` : role.name) : '',
    description: role?.description || '',
    pages: Object.fromEntries(catalog.value.map((p) => [p.key, specFor(p, role?.pages?.[p.key])]))
  })
}

function payloadPages() {
  const pages = {}
  for (const [key, s] of Object.entries(editor.pages)) {
    if (!s.on) continue
    const page = catalog.value.find((p) => p.key === key)
    pages[key] = { actions: s.actions.length ? s.actions : ['view'] }
    if (page.columns) pages[key].columns = s.columns
    const filter = s.filter.filter((c) => c.column && c.op)
    if (filter.length) pages[key].filter = filter
  }
  return pages
}

async function save() {
  Object.assign(editor, { saving: true, error: '' })
  try {
    const payload = { name: editor.name, description: editor.description, pages: payloadPages() }
    if (editor.id) await rolesApi.update(t, editor.id, payload)
    else await rolesApi.create(t, payload)
    editor.open = false
    notify.success('Role saved')
    load()
  } catch (e) {
    editor.error = Object.values(e.data?.errors || {}).join(' ') || e.message
  } finally {
    editor.saving = false
  }
}

function remove(role) {
  confirm.require({
    header: `Delete ${role.name}?`,
    message: role.user_count ? `${role.user_count} user(s) will lose this role.` : 'Nobody has this role.',
    acceptProps: { label: 'Delete', severity: 'danger' },
    rejectProps: { label: 'Cancel', severity: 'secondary', text: true },
    accept: async () => {
      try {
        await rolesApi.remove(t, role.id)
        notify.success('Role deleted')
        load()
      } catch (e) {
        notify.error('Could not delete the role', e)
      }
    }
  })
}

onMounted(load)
</script>

<style scoped>
.ml {
  margin-left: 0.5rem;
}

.grow {
  flex: 1;
}

.mb {
  margin-bottom: 1rem;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.group-title {
  font-weight: 600;
  margin-top: 0.5rem;
}
</style>
