<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" />

    <div class="page-head">
      <div>
        <h1>Roles</h1>
        <p class="sub">A role says which pages someone sees, which buttons they get, which columns they can see
          or change and which rows. Give roles to users on the Users tab; several roles add up.</p>
      </div>
      <!-- the editor is built from the page catalog: wait for it -->
      <Button label="New role" icon="pi pi-plus" :disabled="loading" @click="open(null)" />
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
        <div v-if="!editor.id && !editor.copy" class="field">
          <label for="role-template">Start from</label>
          <Select v-model="editor.template" inputId="role-template" ariaLabel="Start from" :options="templateOptions" optionLabel="label"
                  optionValue="key" fluid @update:modelValue="useTemplate" />
          <small class="hint">A template fills in the pages, buttons and columns below for this clinic. Change anything
            before saving.</small>
        </div>
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
                            :operators="operators" :refOptions="refOptions">
            <div v-if="p.key === 'bookings' && p.entry_forms?.length" class="part">
              <div class="part-title">New entry forms (walk-ins, phone bookings)</div>
              <div class="checks">
                <div v-for="f in p.entry_forms" :key="f.id" class="check">
                  <Checkbox v-model="editor.pages.bookings.entry_forms" :value="f.id" :inputId="`entry-${f.id}`" />
                  <label :for="`entry-${f.id}`">{{ f.label }}</label>
                </div>
              </div>
              <small class="hint">New entry on Bookings shows these forms. This does not open their Submissions pages.</small>
            </div>
          </PageAccessEditor>
        </div>
        <div v-if="editor.pages.overview" class="group">
          <div class="group-title">Lists / Forms pages</div>
          <div class="checks">
            <div v-for="c in overviewColumns" :key="c.key" class="check">
              <Checkbox :modelValue="editor.pages.overview.columns[c.key] !== 'hidden'" binary :inputId="`ov-${c.key}`"
                        @update:modelValue="editor.pages.overview.columns[c.key] = $event ? 'display' : 'hidden'" />
              <label :for="`ov-${c.key}`">{{ c.label }}</label>
            </div>
          </div>
          <small class="hint">Extra columns on the Lists and Forms pages (the name and the rows button are always there).
            Builders and the Clinic admin always see them.</small>
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
const templates = ref([])
const templateOptions = computed(() => [{ key: '', label: 'Blank' }, ...templates.value])
const operators = ref({})
const loading = ref(true)

const GROUPS = [
  { title: 'Front desk', types: ['bookings', 'timings'] },
  { title: 'Form submissions', types: ['form'] },
  { title: 'Lists (rows page, and the values this role can use)', types: ['list'] },
  { title: 'Building forms and lists', types: ['forms', 'lists'] }
]
const groups = computed(() => GROUPS.map((g) => ({ ...g, pages: catalog.value.filter((p) => g.types.includes(p.type)) }))
  .filter((g) => g.pages.length))
const pageNames = (role) => Object.entries(role.pages || {})
  .filter(([key]) => key !== 'overview')   // info columns only: not a page the role opens
  .map(([key, spec]) => {
    const label = catalog.value.find((p) => p.key === key)?.label
    return label && (spec.actions?.length ? label : `${label.replace(/^Rows: /, '')} (values)`)
  }).filter(Boolean).join(', ')

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
    const [r, c, tp] = await Promise.all([rolesApi.list(t), rolesApi.catalog(t),
      rolesApi.templates(t).catch(() => ({ templates: [] }))])   // templates are a convenience
    roles.value = r.roles
    catalog.value = c.pages
    templates.value = tp.templates
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
  const conditions = (list) => (list || []).map((c) => ({ column: c.column, op: c.op, value: c.value ?? null }))
  // A list may limit its values with its Rows page off (no actions, values).
  return { on: Boolean(saved?.actions?.length), actions: [...(saved?.actions || [])], columns,
    filter: conditions(saved?.filter), values: conditions(saved?.values),
    entry_forms: (saved?.entry_forms || []).filter((id) => page.entry_forms?.some((f) => f.id === id)) }
}

const overviewColumns = computed(() => catalog.value.find((p) => p.key === 'overview')?.columns || [])

function open(role, copy = false) {
  Object.assign(editor, {
    open: true, error: '', saving: false,
    id: copy ? null : role?.id || null, template: '', copy,
    name: role ? (copy ? `Copy of ${role.name}` : role.name) : '',
    description: role?.description || '',
    pages: Object.fromEntries(catalog.value.map((p) => [p.key, specFor(p, role?.pages?.[p.key])]))
  })
  // A role saved before "Lists / Forms pages" existed sees every info column: show it that way.
  if (role && !role.pages?.overview && editor.pages.overview) {
    overviewColumns.value.forEach((c) => { editor.pages.overview.columns[c.key] = 'display' })
  }
}

// Start from a template: its pages replace what is in the editor (name and description too, if still empty).
function useTemplate(key) {
  const template = templates.value.find((x) => x.key === key)
  const previous = templates.value.find((x) => x.label === editor.name.trim())
  if (previous && previous !== template) Object.assign(editor, { name: '', description: '' })   // its name, not the admin's
  editor.pages = Object.fromEntries(catalog.value.map((p) => [p.key, specFor(p, template?.pages[p.key])]))
  if (template && !editor.name.trim()) editor.name = template.label
  if (template && !editor.description.trim()) editor.description = template.description
}

function payloadPages() {
  const pages = {}
  for (const [key, s] of Object.entries(editor.pages)) {
    const page = catalog.value.find((p) => p.key === key)
    if (page.type === 'overview') {   // info columns only (always saved, so new roles start with them hidden)
      pages[key] = { actions: [], columns: s.columns }
      continue
    }
    const done = (list) => list.filter((c) => c.column && c.op)
    const values = page.type === 'list' ? done(s.values) : []
    if (!s.on) {
      if (values.length) pages[key] = { actions: [], values }   // values only, Rows page off
      continue
    }
    pages[key] = { actions: s.actions.length ? s.actions : ['view'] }
    if (page.columns) pages[key].columns = s.columns
    if (done(s.filter).length) pages[key].filter = done(s.filter)
    if (s.entry_forms?.length) pages[key].entry_forms = s.entry_forms
    if (values.length) pages[key].values = values
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

.part-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.4rem;
}

.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.2rem;
}

.check {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.group-title {
  font-weight: 600;
  margin-top: 0.5rem;
}
</style>
