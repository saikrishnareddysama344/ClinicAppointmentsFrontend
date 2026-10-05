<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" :crumbs="[{ label: b.form.value?.display_name || '…' }]" />

    <div v-if="b.loading.value" class="panel empty">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />Loading…
    </div>

    <div v-else-if="loadError" class="panel empty">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />{{ loadError }}
      <div style="margin-top: 1rem"><Button label="Try again" icon="pi pi-refresh" @click="load" /></div>
    </div>

    <template v-else-if="b.form.value">
      <div class="page-head">
        <div class="title-block">
          <div class="row-inline title-row">
            <InputText v-model="b.formName.value" :aria-label="`${meta.label} name`" class="title-input" fluid
                       :maxlength="b.config.limits.value.max_label_length" />
            <FormStatusTag v-if="kind === 'form'"
                           :status="b.dirty.value && !b.isDraft.value ? FORM_STATUS.CHANGES_PENDING : b.form.value.status" />
          </div>
          <p class="sub">
            <template v-if="b.form.value.status !== 'draft'">Its data table is ready.</template>
            <template v-else>The data table is created when you {{ kind === 'form' ? 'publish' : 'save' }}.</template>
            <span v-if="b.dirty.value"> · Unsaved changes</span>
          </p>
        </div>
        <div class="actions">
          <Button v-if="!b.isDraft.value && canRows" :label="kind === 'form' ? 'Submissions' : 'Rows'"
                  :icon="kind === 'form' ? 'pi pi-inbox' : 'pi pi-table'" severity="secondary" text
                  @click="router.push({ name: KIND_ROUTES[kind].rows, params: { tenantCode, slug } })" />
          <Button label="Preview" icon="pi pi-eye" severity="secondary" outlined @click="showPreview = true" />
          <Button v-if="canManage" label="Save" icon="pi pi-save" :severity="kind === 'form' ? 'secondary' : undefined"
                  :loading="b.saving.value" :disabled="!b.dirty.value" @click="save" />
          <Button v-if="kind === 'form' && canPublish" :label="b.isDraft.value ? 'Publish' : 'Publish changes'" icon="pi pi-upload"
                  :loading="b.publishing.value || publishSaving" :disabled="!b.canPublish.value || publishSaving"
                  @click="confirmPublish" />
        </div>
      </div>

      <SharePanel
        v-if="kind === 'form' && !b.isDraft.value"
        :tenantCode="tenantCode"
        :formSlug="slug"
        :accepting="b.form.value.accepting_submissions === FLAG_YES"
        :busy="shareBusy"
        :canShare="can(tenantCode, 'forms', 'share')"
        @toggle-accepting="toggleAccepting"
      />

      <Message v-if="b.generalErrors.value.length" severity="error" class="mb">
        <div v-for="(err, i) in b.generalErrors.value" :key="i">{{ err }}</div>
      </Message>

      <div class="builder">
        <FieldList
          :fields="b.fields.value"
          :selectedKey="b.selectedKey.value"
          :errors="b.fieldErrors"
          :dataTypes="fieldTypes"
          :typeName="b.config.typeName"
          :isDraft="b.isDraft.value"
          :maxFields="b.config.limits.value.max_form_fields || 0"
          @select="(key) => (b.selectedKey.value = key)"
          @add="b.addField"
          @move="b.move"
          @duplicate="b.duplicate"
          @remove="b.remove"
        />

        <FieldSettings
          :field="b.selected.value"
          :errors="b.selected.value ? b.fieldErrors[b.selected.value.key] : []"
          :nameProblem="b.nameProblem(b.selected.value)"
          :dataTypes="fieldTypes"
          :dropdownSources="b.config.dropdownSources.value"
          :staticSource="b.config.staticSource.value"
          :limits="b.config.limits.value"
          :isLengthType="b.config.isLengthType"
          :defaultLength="b.config.defaultLength"
          :columnPreview="b.config.columnPreview"
          :isDisplayType="b.config.isDisplayType"
          :kind="kind"
          :siblings="b.fields.value"
          :lists="catalog.lists.value.filter((l) => l.slug !== slug)"
          :schedules="catalog.schedules.value"
          :listDefinition="catalog.listDefinition"
          @type-change="b.onTypeChange"
          @set-display="b.setDisplay"
        />
      </div>
    </template>

    <Dialog v-model:visible="showPreview" modal :header="`Preview: ${b.formName.value || meta.label}`"
            :style="{ width: '520px' }">
      <div class="preview-banner">
        {{ kind === 'form' ? 'This is how patients will see the form.' : 'This is the form staff use to add a row.' }}
        Nothing is saved from here.
      </div>
      <FormRenderer
        :fields="previewFields"
        :inputTypes="b.config.inputTypes.value"
        :staticSource="b.config.staticSource.value"
        :defaultTextLength="b.config.limits.value.default_text_length"
        :defaultPhoneLength="b.config.limits.value.default_phone_length"
        :optionsLoader="previewOptions"
        @submitted="notify.info('Preview only', 'The form is valid. Nothing was saved from the preview.')"
      />
    </Dialog>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import FieldList from '@/components/builder/FieldList.vue'
import FieldSettings from '@/components/builder/FieldSettings.vue'
import SharePanel from '@/components/builder/SharePanel.vue'
import FormStatusTag from '@/components/common/FormStatusTag.vue'
import FormRenderer from '@/components/forms/FormRenderer.vue'
import TenantNav from '@/components/layout/TenantNav.vue'
import { useBuilder } from '@/composables/useBuilder'
import { useCatalog } from '@/composables/useCatalog'
import { can } from '@/services/auth'
import { useNotify } from '@/composables/useNotify'
import { SLOT_TYPE } from '@/constants/fieldTypes'
import { FLAG_YES, FORM_STATUS } from '@/constants/formStatus'
import { KIND_ROUTES } from '@/router'
import { KINDS } from '@/services/api'

// The builder for a form or a list (kind); a list is published by every save.
const props = defineProps({
  tenantCode: { type: String, required: true },
  slug: { type: String, required: true },
  kind: { type: String, default: 'form' }
})

const b = useBuilder(props.tenantCode, props.slug, props.kind)
// Builder page actions ("forms" / "lists"); the rows button needs that form's / list's own page.
const canManage = computed(() => can(props.tenantCode, `${props.kind}s`, 'edit'))
const canPublish = computed(() => can(props.tenantCode, 'forms', 'publish'))
const canRows = computed(() => !!b.form.value && can(props.tenantCode, `${props.kind}:${b.form.value.id}`))
const catalog = useCatalog(props.tenantCode)
const meta = computed(() => KINDS[props.kind])
// Appointment slots only make sense in forms.
const fieldTypes = computed(() => b.config.dataTypes.value.filter((t) => props.kind === 'form' || t.type_key !== SLOT_TYPE))

// Preview dropdowns fed by lists use the admin options endpoint (filtered like the public form).
// Patients (forms) never see staff-only or retired fields; staff adding a row never see retired ones.
const previewFields = computed(() => b.fields.value.filter((f) => !f.visibility?.retired
  && !(props.kind === 'form' && f.visibility?.hide_public)))

function previewOptions(field, parentValue) {
  const filter = field.depends_on_field_id ? { filter_field_id: field.match_field_id, filter_value: parentValue } : {}
  return catalog.listOptions(field.list_id, filter)
}
const router = useRouter()
const notify = useNotify()
const confirm = useConfirm()

const showPreview = ref(false)
const loadError = ref('')

async function load() {
  loadError.value = ''
  try {
    await Promise.all([b.load(), catalog.refresh()])
  } catch (e) {
    loadError.value = e.message
  }
}

async function save() {
  try {
    await b.save()
    notify.success('Saved', props.kind === 'list' ? 'The list table is up to date.' : undefined)
    if (props.kind === 'list') catalog.refresh()
    return true
  } catch (e) {
    notify.error('Not saved', e)
    return false
  }
}

const publishSaving = ref(false)

async function confirmPublish() {
  if (b.dirty.value) {
    publishSaving.value = true
    const saved = await save()
    publishSaving.value = false
    if (!saved) return
  }

  const form = b.form.value
  confirm.require({
    header: b.isDraft.value ? 'Publish this form?' : 'Publish changes?',
    message: b.isDraft.value
      ? 'This creates the data table. After publishing, field types and max lengths are locked and fields cannot be removed.'
      : `${form.pending_count} new field(s) will be added as columns.`,
    icon: 'pi pi-upload',
    rejectProps: { label: 'Cancel', severity: 'secondary', text: true },
    acceptProps: { label: 'Publish' },
    accept: async () => {
      try {
        const result = await b.publish()
        notify.success('Published', result.message)
      } catch (e) {
        notify.error('Publish failed', e)
      }
    }
  })
}

const shareBusy = ref(false)

async function toggleAccepting(accepting) {
  shareBusy.value = true
  try {
    await b.setAccepting(accepting)
    notify.success(accepting ? 'Form is accepting responses' : 'Form is closed to new responses')
  } catch (e) {
    notify.error('Could not change the setting', e)
  } finally {
    shareBusy.value = false
  }
}

// Unsaved-change protection
function beforeUnload(event) {
  if (b.dirty.value) {
    event.preventDefault()
    event.returnValue = ''
  }
}

onBeforeRouteLeave(() => !b.dirty.value || window.confirm('You have unsaved changes. Leave without saving?'))

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  load()
})

onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<style scoped>
.mb {
  margin-bottom: 1rem;
}

.title-block {
  flex: 1;
  min-width: 260px;
}

.title-row {
  justify-content: flex-start;
  gap: 0.75rem;
}

.title-input {
  font-size: 1.2rem;
  font-weight: 600;
  max-width: 420px;
}
</style>
