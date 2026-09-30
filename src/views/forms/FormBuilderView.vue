<template>
  <main class="page">
    <nav class="crumbs" aria-label="Breadcrumb">
      <router-link :to="{ name: ROUTES.TENANTS }">Tenants</router-link>
      <i class="pi pi-angle-right" aria-hidden="true" />
      <router-link :to="{ name: ROUTES.FORMS, params: { tenantCode } }">
        {{ b.form.value?.tenant?.name || tenantCode }}
      </router-link>
      <i class="pi pi-angle-right" aria-hidden="true" />
      <span>{{ b.form.value?.display_name || '…' }}</span>
    </nav>

    <div v-if="b.loading.value" class="panel empty">
      <i class="pi pi-spin pi-spinner" aria-hidden="true" />Loading form…
    </div>

    <div v-else-if="loadError" class="panel empty">
      <i class="pi pi-exclamation-triangle" aria-hidden="true" />{{ loadError }}
      <div style="margin-top: 1rem"><Button label="Try again" icon="pi pi-refresh" @click="load" /></div>
    </div>

    <template v-else-if="b.form.value">
      <div class="page-head">
        <div class="title-block">
          <div class="row-inline title-row">
            <InputText v-model="b.formName.value" aria-label="Form name" class="title-input" fluid
                       :maxlength="b.config.limits.value.max_label_length" />
            <FormStatusTag :status="b.dirty.value && !b.isDraft.value ? FORM_STATUS.CHANGES_PENDING : b.form.value.status" />
          </div>
          <p class="sub">
            <template v-if="b.form.value.table_name">
              Data table <span class="mono">{{ b.form.value.schema_name }}.{{ b.form.value.table_name }}</span>
            </template>
            <template v-else>The data table is created when you publish.</template>
            <span v-if="b.dirty.value"> · Unsaved changes</span>
          </p>
        </div>
        <div class="actions">
          <Button v-if="!b.isDraft.value" label="Submissions" icon="pi pi-inbox" severity="secondary" text
                  @click="router.push({ name: ROUTES.SUBMISSIONS, params: { tenantCode, formSlug } })" />
          <Button label="Preview" icon="pi pi-eye" severity="secondary" outlined @click="showPreview = true" />
          <Button label="Save" icon="pi pi-save" severity="secondary" :loading="b.saving.value"
                  :disabled="!b.dirty.value" @click="save" />
          <Button :label="b.isDraft.value ? 'Publish' : 'Publish changes'" icon="pi pi-upload"
                  :loading="b.publishing.value || publishSaving" :disabled="!b.canPublish.value || publishSaving"
                  @click="confirmPublish" />
        </div>
      </div>

      <SharePanel
        v-if="!b.isDraft.value"
        :tenantCode="tenantCode"
        :formSlug="formSlug"
        :accepting="b.form.value.accepting_submissions === FLAG_YES"
        :busy="shareBusy"
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
          :dataTypes="b.config.dataTypes.value"
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
          :dataTypes="b.config.dataTypes.value"
          :dropdownSources="b.config.dropdownSources.value"
          :staticSource="b.config.staticSource.value"
          :limits="b.config.limits.value"
          :isLengthType="b.config.isLengthType"
          :defaultLength="b.config.defaultLength"
          :columnPreview="b.config.columnPreview"
          @type-change="b.onTypeChange"
        />
      </div>
    </template>

    <Dialog v-model:visible="showPreview" modal :header="`Preview: ${b.formName.value || 'Form'}`"
            :style="{ width: '520px' }">
      <div class="preview-banner">This is how patients will see the form. Nothing is saved from here.</div>
      <FormRenderer
        :fields="b.fields.value"
        :inputTypes="b.config.inputTypes.value"
        :staticSource="b.config.staticSource.value"
        :defaultTextLength="b.config.limits.value.default_text_length"
        :defaultPhoneLength="b.config.limits.value.default_phone_length"
        @submitted="notify.info('Preview only', 'The form is valid. Nothing was saved from the preview.')"
      />
    </Dialog>
  </main>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import FieldList from '@/components/builder/FieldList.vue'
import FieldSettings from '@/components/builder/FieldSettings.vue'
import SharePanel from '@/components/builder/SharePanel.vue'
import FormStatusTag from '@/components/common/FormStatusTag.vue'
import FormRenderer from '@/components/forms/FormRenderer.vue'
import { useFormBuilder } from '@/composables/useFormBuilder'
import { useNotify } from '@/composables/useNotify'
import { FLAG_YES, FORM_STATUS } from '@/constants/formStatus'
import { ROUTES } from '@/router'

const props = defineProps({
  tenantCode: { type: String, required: true },
  formSlug: { type: String, required: true }
})

const b = useFormBuilder(props.tenantCode, props.formSlug)
const router = useRouter()
const notify = useNotify()
const confirm = useConfirm()

const showPreview = ref(false)
const loadError = ref('')

async function load() {
  loadError.value = ''
  try {
    await b.load()
  } catch (e) {
    loadError.value = e.message
  }
}

async function save() {
  try {
    await b.save()
    notify.success('Saved')
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
      ? `This creates the data table in ${form.tenant?.schema_name}. After publishing, field types and max lengths are locked and fields cannot be removed.`
      : `${form.pending_count} new field(s) will be added as columns to ${form.table_name}.`,
    icon: 'pi pi-upload',
    rejectProps: { label: 'Cancel', severity: 'secondary', text: true },
    acceptProps: { label: 'Publish' },
    accept: async () => {
      try {
        const result = await b.publish()
        notify.success('Published', `${result.message} Table: ${result.schema_name}.${result.table_name}`)
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
