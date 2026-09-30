<template>
  <main class="page">
    <nav class="crumbs" aria-label="Breadcrumb">
      <router-link :to="{ name: ROUTES.TENANTS }">Tenants</router-link>
      <i class="pi pi-angle-right" aria-hidden="true" />
      <router-link :to="{ name: ROUTES.FORMS, params: { tenantCode } }">{{ form?.tenant?.name || tenantCode }}</router-link>
      <i class="pi pi-angle-right" aria-hidden="true" />
      <router-link :to="{ name: ROUTES.FORM_BUILDER, params: { tenantCode, formSlug } }">
        {{ form?.display_name || formSlug }}
      </router-link>
      <i class="pi pi-angle-right" aria-hidden="true" />
      <span>Submissions</span>
    </nav>

    <div class="page-head">
      <div>
        <h1>Submissions</h1>
        <p class="sub">
          <template v-if="loaded">{{ total }} response{{ total === 1 ? '' : 's' }} · newest first</template>
          <template v-else>Loading responses…</template>
        </p>
      </div>
      <div class="actions">
        <Button label="Refresh" icon="pi pi-refresh" severity="secondary" outlined :loading="loading" @click="load" />
        <Button label="Download CSV" icon="pi pi-download" severity="secondary" as="a" :href="csvUrl"
                :disabled="!total" download />
      </div>
    </div>

    <div class="panel">
      <DataTable
        :value="rows"
        :loading="loading"
        dataKey="id"
        lazy
        paginator
        :rows="pageSize"
        :first="(page - 1) * pageSize"
        :totalRecords="total"
        :rowsPerPageOptions="[10, 25, 50, 100]"
        scrollable
        @page="onPage"
      >
        <template #empty>
          <div v-if="loaded" class="empty">
            <i class="pi pi-inbox" aria-hidden="true" />
            No submissions yet. Share the form's public link to start collecting responses.
          </div>
        </template>
        <Column v-for="col in columns" :key="col.key" :field="col.key" :header="col.label">
          <template #body="{ data }">
            <span :class="{ muted: data[col.key] === null || data[col.key] === undefined }">
              {{ display(col, data[col.key]) }}
            </span>
          </template>
        </Column>
      </DataTable>
    </div>
  </main>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useNotify } from '@/composables/useNotify'
import { appConfig } from '@/config/env'
import { ROUTES } from '@/router'
import { formsApi, submissionsApi } from '@/services/api'

const props = defineProps({
  tenantCode: { type: String, required: true },
  formSlug: { type: String, required: true }
})

const notify = useNotify()

const form = ref(null)
const columns = ref([])
const rows = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(25)
// true from the start, so the table shows a spinner instead of "No submissions yet"
const loading = ref(true)
const loaded = ref(false) // becomes true after the first successful load

const csvUrl = computed(() => submissionsApi.csvUrl(props.tenantCode, props.formSlug))

function display(col, value) {
  if (value === null || value === undefined || value === '') return '—'
  if (col.data_type === 'boolean') return value ? 'Yes' : 'No'
  if (col.data_type === 'datetime') {
    return new Date(value).toLocaleString(appConfig.locale, {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }
  if (col.data_type === 'date') {
    return new Date(`${value}T00:00:00`).toLocaleDateString(appConfig.locale, {
      day: '2-digit', month: 'short', year: 'numeric'
    })
  }
  if (col.data_type === 'time') return String(value).slice(0, 5)
  return value
}

async function load() {
  loading.value = true
  try {
    const result = await submissionsApi.list(props.tenantCode, props.formSlug, page.value, pageSize.value)
    columns.value = result.columns
    rows.value = result.rows
    total.value = result.total
    pageSize.value = result.page_size
    loaded.value = true
  } catch (e) {
    notify.error('Could not load submissions', e)
  } finally {
    loading.value = false
  }
}

function onPage(event) {
  page.value = event.page + 1
  pageSize.value = event.rows
  load()
}

async function loadForm() {
  try {
    form.value = (await formsApi.get(props.tenantCode, props.formSlug)).form
  } catch {
    // breadcrumbs fall back to the codes
  }
}

// Submissions and the form name (for the breadcrumbs) load in parallel, so the table
// never waits for the breadcrumbs. Runs again if the URL switches to another form.
watch(() => [props.tenantCode, props.formSlug], () => {
  page.value = 1
  loaded.value = false
  form.value = null
  loadForm()
  load()
}, { immediate: true })
</script>
