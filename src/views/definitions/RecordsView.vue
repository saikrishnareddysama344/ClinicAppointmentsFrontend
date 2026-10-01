<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" :crumbs="[
      { label: definition?.display_name || slug, to: { name: KIND_ROUTES[kind].builder, params: { tenantCode, slug } } },
      { label: title }]" />

    <div class="page-head">
      <div>
        <h1>{{ definition?.display_name ? `${definition.display_name}: ${title.toLowerCase()}` : title }}</h1>
        <p class="sub">
          <template v-if="loaded">{{ total }} {{ noun }}{{ total === 1 ? '' : 's' }} · newest first</template>
          <template v-else>Loading…</template>
        </p>
      </div>
      <div class="actions">
        <template v-if="isList">
          <InputText v-model="search" placeholder="Search" aria-label="Search" @keydown.enter="reload" />
          <SelectButton v-model="status" :options="STATUSES" optionLabel="label" optionValue="value"
                        :allowEmpty="false" aria-label="Show" @change="reload" />
        </template>
        <Button label="Refresh" icon="pi pi-refresh" severity="secondary" outlined :loading="loading" @click="load" />
        <Button v-if="canExport" label="Download CSV" icon="pi pi-download" severity="secondary"
                :disabled="!total" :loading="downloading" @click="downloadCsv" />
        <Button v-if="canAdd" :label="isList ? 'Add row' : 'Add submission'" icon="pi pi-plus" :disabled="!definition"
                @click="openEditor(null)" />
      </div>
    </div>

    <div class="panel">
      <DataTable :value="rows" :loading="loading" dataKey="id" lazy paginator :rows="pageSize"
                 :first="(page - 1) * pageSize" :totalRecords="total" :rowsPerPageOptions="[10, 25, 50, 100]"
                 scrollable @page="onPage">
        <template #empty>
          <div v-if="loaded" class="empty">
            <i :class="isList ? 'pi pi-table' : 'pi pi-inbox'" aria-hidden="true" />
            {{ isList ? 'No rows here yet. Use "Add row".' : "No submissions yet. Share the form's public link to start collecting responses." }}
          </div>
        </template>
        <Column v-for="col in tableColumns" :key="col.key" :field="col.key" :header="col.label">
          <template #body="{ data }">
            <Tag v-if="col.key === 'status'" :value="data.status" :severity="data.status === 'active' ? 'success' : 'secondary'" />
            <span v-else :class="{ muted: data[col.key] === null || data[col.key] === undefined }">
              {{ displayValue(col.data_type, data[col.key]) }}
            </span>
          </template>
        </Column>
        <Column v-if="canEdit || (isList && canDeactivate)" style="width: 110px">
          <template #body="{ data }">
            <div class="actions">
              <Button v-if="canEdit" icon="pi pi-pencil" text rounded aria-label="Edit" v-tooltip.top="'Edit'" @click="openEditor(data)" />
              <Button v-if="isList && canDeactivate" :icon="data.status === 'active' ? 'pi pi-eye-slash' : 'pi pi-eye'" text rounded
                      :aria-label="data.status === 'active' ? 'Deactivate' : 'Reactivate'"
                      v-tooltip.top="data.status === 'active' ? 'Deactivate (hidden from new choices)' : 'Reactivate'"
                      @click="toggleStatus(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="editor.open" modal :header="`${editor.row ? 'Edit' : 'Add'} ${noun}`" :style="{ width: '520px' }">
      <Message v-if="editor.error" severity="error" class="mb">{{ editor.error }}</Message>
      <div v-if="editor.row && readOnlyFields.length" class="read-only mb">
        <div v-for="f in readOnlyFields" :key="f.key" class="ro-row">
          <span class="muted">{{ f.display_label }}</span>
          <span>{{ displayValue(f.data_type, editor.row[f.column_name]) }}</span>
        </div>
      </div>
      <FormRenderer :fields="editableFields" :initialValues="editor.initial" :initialLabels="editor.labels" :optionsLoader="listOptionsFor"
                    :slotApi="isList ? null : slotApi"
                    :staticSource="config.staticSource.value || 'static'"
                    :defaultTextLength="config.limits.value.default_text_length || 255"
                    :defaultPhoneLength="config.limits.value.default_phone_length || 20"
                    :externalErrors="editor.errors" :submitting="editor.saving" submitLabel="Save" @submitted="saveRow" />
    </Dialog>
  </main>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import FormRenderer from '@/components/forms/FormRenderer.vue'
import TenantNav from '@/components/layout/TenantNav.vue'
import { useBuilderConfig } from '@/composables/useBuilderConfig'
import { useCatalog } from '@/composables/useCatalog'
import { useNotify } from '@/composables/useNotify'
import { autoPrintBooking } from '@/composables/useClinic'
import { KIND_ROUTES } from '@/router'
import { SLOT_TYPE } from '@/constants/fieldTypes'
import { definitionApis, publicApi } from '@/services/api'
import { can } from '@/services/auth'
import { displayValue, rendererField, toApiValue } from '@/utils/format'

// Submissions of a form (read-only) or rows of a list (add, edit, deactivate).
const props = defineProps({
  tenantCode: { type: String, required: true },
  slug: { type: String, required: true },
  kind: { type: String, default: 'form' }
})

const STATUSES = [{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }, { label: 'All', value: 'all' }]
const notify = useNotify()
const catalog = useCatalog(props.tenantCode)
const config = useBuilderConfig()

const isList = computed(() => props.kind === 'list')
const api = computed(() => definitionApis[props.kind])
const title = computed(() => (isList.value ? 'Rows' : 'Submissions'))
const noun = computed(() => (isList.value ? 'row' : 'submission'))
// This form's / list's own page ("form:<id>" / "list:<id>") decides the buttons; its columns come
// from the API already limited to what the role may see (field.access: edit / display).
const pageKey = computed(() => definition.value && `${props.kind}:${definition.value.id}`)
const allowed = (action) => !!pageKey.value && can(props.tenantCode, pageKey.value, action)
const canAdd = computed(() => allowed(isList.value ? 'add' : 'edit'))
const canEdit = computed(() => allowed('edit'))
const canDeactivate = computed(() => allowed('deactivate'))
const canExport = computed(() => allowed('export'))

const definition = ref(null)
const columns = ref([])
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(25)
const search = ref('')
const status = ref('active')
// true from the start, so the table shows a spinner instead of "No submissions yet"
const loading = ref(true)
const loaded = ref(false)

const downloading = ref(false)
async function downloadCsv() {
  downloading.value = true
  try {
    await api.value.downloadCsv(props.tenantCode, props.slug)
  } catch (e) {
    notify.error('Could not download', e)
  } finally {
    downloading.value = false
  }
}
// Appointment slots (forms) are picked like on the public form: its who / where names and windows.
const slotInfo = ref({})
const slotApi = (field) => ({
  options: async (part, whereId) =>
    (await publicApi.options(props.tenantCode, props.slug, field.id, { part, where_id: whereId })).options,
  availability: (params) => publicApi.availability(props.tenantCode, props.slug, field.id, params)
})
// Retired fields are never filled; "hide in table" fields are left out of the table only.
const tableColumns = computed(() => columns.value.filter((c) => !c.hidden))
const fields = computed(() => (definition.value?.fields || []).filter((f) => f.column_name && !f.visibility?.retired)
  .map((f) => rendererField({ ...f, slot: slotInfo.value[f.id] })))
const accessOf = (key) => (definition.value?.fields || []).find((f) => String(f.id) === String(key))?.access || 'hidden'
// A booking is made when a submission is added; an existing one is changed on the Bookings page.
const fixedSlot = (f) => editor.row && f.data_type === SLOT_TYPE
const editableFields = computed(() => fields.value.filter((f) => accessOf(f.key) === 'edit' && !fixedSlot(f)))
const readOnlyFields = computed(() => fields.value.filter((f) => accessOf(f.key) === 'display'
  || (accessOf(f.key) === 'edit' && fixedSlot(f)))
  .map((f) => ({ ...f, column_name: (definition.value.fields.find((d) => String(d.id) === String(f.key)) || {}).column_name })))

async function load() {
  loading.value = true
  try {
    const result = await api.value.rows(props.tenantCode, props.slug, {
      page: page.value, page_size: pageSize.value,
      ...(isList.value ? { q: search.value.trim(), status: status.value } : {})
    })
    columns.value = result.columns
    rows.value = result.rows
    total.value = result.total
    pageSize.value = result.page_size
    loaded.value = true
  } catch (e) {
    notify.error(`Could not load ${title.value.toLowerCase()}`, e)
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  load()
}

function onPage(event) {
  page.value = event.page + 1
  pageSize.value = event.rows
  load()
}

// ---------- editing list rows ----------
const editor = reactive({ open: false, row: null, initial: {}, labels: {}, errors: {}, error: '', saving: false })

// The row's stored values keyed like the renderer's fields (list references by id, with their labels).
function valuesOf(row) {
  const byColumn = Object.fromEntries((definition.value?.fields || []).map((f) => [f.column_name, f]))
  const values = {}
  const labels = {}
  for (const col of columns.value) {
    const f = byColumn[col.key]
    if (!f) continue
    let value = row[`${col.key}__id`] ?? row[col.key]
    if (value != null && (f.data_type === 'date' || f.data_type === 'time')) {
      value = f.data_type === 'date' ? new Date(`${value}T00:00:00`) : new Date(`1970-01-01T${value}`)
    }
    values[String(f.id)] = value
    if (row[`${col.key}__id`] != null) labels[String(f.id)] = row[col.key]
  }
  return { values, labels }
}

function openEditor(row) {
  const { values, labels } = row ? valuesOf(row) : { values: {}, labels: {} }
  Object.assign(editor, { open: true, row, initial: values, labels, errors: {}, error: '' })
}

function listOptionsFor(field, parentValue) {
  const filter = field.depends_on_field_id ? { filter_field_id: field.match_field_id, filter_value: parentValue } : {}
  return catalog.listOptions(field.list_id, filter)
}

async function saveRow(answers) {
  // Only the columns this role may edit are sent; the others keep their values.
  const values = Object.fromEntries(editableFields.value.map((f) => [f.key, toApiValue(f.data_type, answers[f.key])]))
  Object.assign(editor, { saving: true, errors: {}, error: '' })
  try {
    if (editor.row) await api.value.updateRow(props.tenantCode, props.slug, editor.row.id, values)
    else {
      const saved = await api.value.addRow(props.tenantCode, props.slug, values)
      autoPrintBooking(props.tenantCode, saved.booking).catch((e) => notify.error('Could not print', e))
    }
    editor.open = false
    notify.success('Saved')
    load()
  } catch (e) {
    editor.errors = e.data?.field_errors || {}
    editor.error = e.message
  } finally {
    editor.saving = false
  }
}

async function toggleStatus(row) {
  try {
    await api.value.setRowStatus(props.tenantCode, props.slug, row.id, row.status !== 'active')
    notify.success(row.status === 'active' ? 'Deactivated' : 'Reactivated')
    load()
  } catch (e) {
    notify.error('Could not change the status', e)
  }
}

// Rows and the definition (breadcrumbs, row editor) load in parallel. Runs again for another form/list.
watch(() => [props.tenantCode, props.slug, props.kind], () => {
  page.value = 1
  loaded.value = false
  definition.value = null
  api.value.get(props.tenantCode, props.slug).then((r) => (definition.value = r[props.kind])).catch(() => {})
  slotInfo.value = {}
  Promise.all([catalog.load(), config.load()]).catch(() => {})
  if (!isList.value) {   // slot names (Doctors / Branches) come with the published form
    publicApi.getForm(props.tenantCode, props.slug)
      .then((r) => (slotInfo.value = Object.fromEntries(r.form.fields.filter((f) => f.slot).map((f) => [f.id, f.slot]))))
      .catch(() => {})
  }
  load()
}, { immediate: true })
</script>

<style scoped>
.read-only {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.ro-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.mb {
  margin-bottom: 1rem;
}
</style>
