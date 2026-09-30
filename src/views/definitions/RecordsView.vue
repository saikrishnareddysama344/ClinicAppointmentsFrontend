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
        <Button label="Download CSV" icon="pi pi-download" severity="secondary" as="a" :href="csvUrl"
                :disabled="!total" download />
        <Button v-if="isList" label="Add row" icon="pi pi-plus" :disabled="!definition" @click="openEditor(null)" />
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
        <Column v-for="col in columns" :key="col.key" :field="col.key" :header="col.label">
          <template #body="{ data }">
            <Tag v-if="col.key === 'status'" :value="data.status" :severity="data.status === 'active' ? 'success' : 'secondary'" />
            <span v-else :class="{ muted: data[col.key] === null || data[col.key] === undefined }">
              {{ displayValue(col.data_type, data[col.key]) }}
            </span>
          </template>
        </Column>
        <Column v-if="isList" style="width: 110px">
          <template #body="{ data }">
            <div class="actions">
              <Button icon="pi pi-pencil" text rounded aria-label="Edit" v-tooltip.top="'Edit'" @click="openEditor(data)" />
              <Button :icon="data.status === 'active' ? 'pi pi-eye-slash' : 'pi pi-eye'" text rounded
                      :aria-label="data.status === 'active' ? 'Deactivate' : 'Reactivate'"
                      v-tooltip.top="data.status === 'active' ? 'Deactivate (hidden from new choices)' : 'Reactivate'"
                      @click="toggleStatus(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="editor.open" modal :header="editor.row ? 'Edit row' : 'Add row'" :style="{ width: '520px' }">
      <Message v-if="editor.error" severity="error" class="mb">{{ editor.error }}</Message>
      <FormRenderer :fields="fields" :initialValues="editor.initial" :initialLabels="editor.labels" :optionsLoader="listOptionsFor"
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
import { KIND_ROUTES } from '@/router'
import { definitionApis } from '@/services/api'
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
const noun = computed(() => (isList.value ? 'row' : 'response'))

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

const csvUrl = computed(() => api.value.csvUrl(props.tenantCode, props.slug))
const fields = computed(() => (definition.value?.fields || []).filter((f) => f.column_name).map(rendererField))

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
  const values = Object.fromEntries(fields.value.map((f) => [f.key, toApiValue(f.data_type, answers[f.key])]))
  Object.assign(editor, { saving: true, errors: {}, error: '' })
  try {
    if (editor.row) await api.value.updateRow(props.tenantCode, props.slug, editor.row.id, values)
    else await api.value.addRow(props.tenantCode, props.slug, values)
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
  if (isList.value) Promise.all([catalog.load(), config.load()]).catch(() => {})
  load()
}, { immediate: true })
</script>

<style scoped>
.mb {
  margin-bottom: 1rem;
}
</style>
