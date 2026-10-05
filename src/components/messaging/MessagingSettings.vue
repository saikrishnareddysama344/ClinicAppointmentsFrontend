<template>
  <div class="messaging">
    <div v-if="loading" class="panel empty">Loading…</div>
    <template v-else>
      <Message v-if="error" severity="error">{{ error }}</Message>

      <section v-if="clinic" class="panel form-grid">
        <h2>Messages to patients</h2>
        <div class="checks">
          <div v-for="k in KINDS" :key="k.key" class="check">
            <Checkbox v-model="settings[k.key]" binary :inputId="`m-${k.key}`" />
            <label :for="`m-${k.key}`">{{ k.label }}</label>
          </div>
        </div>
        <div class="row-inline">
          <div class="field">
            <label for="m-n">"Before your turn" when this many are ahead</label>
            <InputNumber v-model="settings.n" inputId="m-n" :min="1" :max="20" showButtons />
          </div>
          <div class="field grow">
            <label for="m-channels">Channels</label>
            <Select v-model="settings.channels" inputId="m-channels" ariaLabel="Channels" :options="CHANNEL_ORDERS"
                    optionLabel="label" optionValue="value" fluid />
          </div>
        </div>
        <div class="row-inline">
          <div class="field">
            <label for="m-quiet-from">Quiet hours from</label>
            <InputText id="m-quiet-from" v-model="settings.quiet_from" type="time" />
          </div>
          <div class="field">
            <label for="m-quiet-to">to</label>
            <InputText id="m-quiet-to" v-model="settings.quiet_to" type="time" />
          </div>
          <div class="field grow">
            <label for="m-sender">Clinic name in messages</label>
            <InputText id="m-sender" v-model="settings.sender_name" maxlength="40" placeholder="(the clinic's name)" fluid />
          </div>
        </div>
        <small class="hint">In quiet hours "booked" waits for the morning; "before your turn" and "your turn" are not sent.</small>
        <div class="check">
          <Checkbox v-model="settings.use_own" binary inputId="m-own" />
          <label for="m-own">Use this clinic's own WhatsApp / SMS accounts (below) instead of the platform's</label>
        </div>
        <small v-if="!settings.use_own" class="hint">
          Platform accounts: WhatsApp {{ platform.whatsapp ? 'set up' : 'not set up' }}, SMS {{ platform.sms ? 'set up' : 'not set up' }}.
        </small>
      </section>

      <template v-if="!clinic || settings.use_own">
      <section v-for="ch in CHANNELS" :key="ch.key" class="panel form-grid">
        <div class="head">
          <h2>{{ ch.label }}</h2>
          <ToggleSwitch v-model="enabled[ch.key]" :inputId="`on-${ch.key}`" :aria-label="`${ch.label} account`" />
          <Tag v-if="accounts[ch.key]?.last_error" severity="danger" :value="`Last error: ${accounts[ch.key].last_error}`" class="status" />
          <Tag v-else-if="accounts[ch.key]?.last_ok_at" severity="success" value="Working" class="status" />
        </div>
        <template v-if="enabled[ch.key]">
          <div class="row-inline">
            <div class="field">
              <label :for="`${ch.key}-provider`">Provider</label>
              <Select v-model="accounts[ch.key].provider" :inputId="`${ch.key}-provider`" :ariaLabel="`${ch.label} provider`"
                      :options="ch.providers" optionLabel="label" optionValue="value" />
            </div>
            <div class="field">
              <label :for="`${ch.key}-active`">Active</label>
              <ToggleSwitch v-model="accounts[ch.key].is_active" :inputId="`${ch.key}-active`" />
            </div>
          </div>
          <template v-for="f in FIELDS[accounts[ch.key].provider] || []" :key="f.key">
            <div class="field">
              <label :for="`${ch.key}-${f.key}`">{{ f.label }}</label>
              <InputText v-if="f.secret" :id="`${ch.key}-${f.key}`" v-model="accounts[ch.key].secrets[f.key]" type="password"
                         autocomplete="off" :placeholder="accounts[ch.key].secrets[f.key] ? '' : 'Not set'" fluid />
              <InputText v-else :id="`${ch.key}-${f.key}`" v-model="accounts[ch.key].config[f.key]" :placeholder="f.placeholder" fluid />
              <small v-if="f.hint" class="hint">{{ f.hint }}</small>
            </div>
          </template>
          <div v-if="accounts[ch.key].provider !== 'test'" class="part">
            <div class="part-title">{{ ch.key === 'whatsapp' ? 'Approved template names' : 'DLT / flow template ids' }}</div>
            <div v-for="k in ALL_KINDS" :key="k" class="template">
              <label :for="`${ch.key}-t-${k}`">{{ KIND_LABELS[k] }}</label>
              <InputText :id="`${ch.key}-t-${k}`" v-model="accounts[ch.key].config.templates[k]" fluid />
              <small class="hint">{{ texts[k] }}</small>
            </div>
          </div>
          <small v-else class="hint">Test provider: messages are written to the server log and to the list below - nothing is sent.</small>
        </template>
      </section>
      </template>

      <div class="actions-row">
        <Button label="Save" icon="pi pi-check" :loading="saving" @click="save" />
      </div>

      <section class="panel form-grid">
        <h2>Send a test message</h2>
        <div class="row-inline">
          <InputText v-model="testPhone" placeholder="Mobile number" aria-label="Test mobile number" />
          <Button label="Send test" icon="pi pi-send" severity="secondary" :loading="testing" @click="sendTest" />
        </div>
      </section>

      <section class="panel">
        <div class="head">
          <h2>Recent messages</h2>
          <Button icon="pi pi-refresh" text rounded aria-label="Refresh messages" @click="loadLog" />
        </div>
        <DataTable :value="log" size="small" dataKey="created_at">
          <template #empty><span class="muted">No messages yet.</span></template>
          <Column header="When"><template #body="{ data }">{{ new Date(data.created_at).toLocaleString() }}</template></Column>
          <Column v-if="!clinic" field="clinic" header="Clinic" />
          <Column header="Message"><template #body="{ data }">{{ KIND_LABELS[data.kind] || data.kind }}</template></Column>
          <Column field="phone" header="To" />
          <Column header="Status">
            <template #body="{ data }">
              <Tag :value="data.status" :severity="data.status === 'sent' ? 'success' : data.status === 'failed' ? 'danger' : 'info'" />
              <span v-if="data.channel" class="muted small"> {{ data.channel }}</span>
            </template>
          </Column>
          <Column header="Details"><template #body="{ data }"><span class="small">{{ data.error || data.text || '' }}</span></template></Column>
        </DataTable>
      </section>
    </template>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useNotify } from '@/composables/useNotify'
import { messagingApi } from '@/services/api'

// tenantCode: a clinic's settings (own accounts optional + which messages); none: the platform's accounts.
const props = defineProps({ tenantCode: { type: String, default: null } })
const clinic = !!props.tenantCode
const notify = useNotify()

const KIND_LABELS = { otp: 'Verification code (OTP)', booked: 'Booked', n_before: 'Before your turn', your_turn: 'Your turn', test: 'Test' }
const KINDS = [{ key: 'otp', label: KIND_LABELS.otp }, { key: 'booked', label: KIND_LABELS.booked },
  { key: 'n_before', label: KIND_LABELS.n_before }, { key: 'your_turn', label: KIND_LABELS.your_turn }]
const ALL_KINDS = ['otp', 'booked', 'n_before', 'your_turn', 'test']
const CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', providers: [{ value: 'meta', label: 'WhatsApp Cloud API (Meta)' }, { value: 'test', label: 'Test (log only)' }] },
  { key: 'sms', label: 'SMS', providers: [{ value: 'msg91', label: 'MSG91' }, { value: 'test', label: 'Test (log only)' }] }]
const CHANNEL_ORDERS = [{ value: 'whatsapp_then_sms', label: 'WhatsApp, then SMS if it fails' },
  { value: 'sms_then_whatsapp', label: 'SMS, then WhatsApp if it fails' }, { value: 'whatsapp', label: 'WhatsApp only' },
  { value: 'sms', label: 'SMS only' }]
const FIELDS = {
  meta: [{ key: 'phone_number_id', label: 'Phone number id' }, { key: 'business_account_id', label: 'WhatsApp business account id' },
    { key: 'language', label: 'Template language', placeholder: 'en' },
    { key: 'access_token', label: 'Access token', secret: true, hint: 'Stored encrypted; shown only as its last 4 characters.' }],
  msg91: [{ key: 'sender_id', label: 'Sender id (6 letters)' }, { key: 'dlt_entity_id', label: 'DLT entity id' },
    { key: 'auth_key', label: 'Auth key', secret: true, hint: 'Stored encrypted; shown only as its last 4 characters.' }],
  test: []
}

const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const error = ref('')
const accounts = reactive({ whatsapp: null, sms: null })
const enabled = reactive({ whatsapp: false, sms: false })
const settings = reactive({})
const platform = reactive({ whatsapp: false, sms: false })
const texts = ref({})
const log = ref([])
const testPhone = ref('')

const blank = (provider) => ({ provider, is_active: true, config: { templates: {} }, secrets: {} })
function fill(body) {
  for (const ch of ['whatsapp', 'sms']) {
    const a = body.accounts[ch]
    enabled[ch] = !!a
    accounts[ch] = a ? { ...a, config: { templates: {}, ...a.config, templates: { ...(a.config.templates || {}) } }, secrets: { ...a.secrets } }
      : blank('test')
  }
  if (body.settings) Object.assign(settings, body.settings)
  if (body.platform) Object.assign(platform, body.platform)
  texts.value = body.texts || {}
}

async function loadLog() {
  try {
    log.value = (await messagingApi.log(props.tenantCode)).messages
  } catch (e) {
    notify.error('Could not load messages', e)
  }
}

async function load() {
  loading.value = true
  try {
    fill(await messagingApi.get(props.tenantCode))
    await loadLog()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function save() {
  error.value = ''
  saving.value = true
  try {
    const payload = { accounts: {} }
    if (!clinic || settings.use_own) {
      for (const ch of ['whatsapp', 'sms']) payload.accounts[ch] = enabled[ch] ? accounts[ch] : null
    }
    if (clinic) payload.settings = { ...settings }
    fill(await messagingApi.save(props.tenantCode, payload))
    notify.success('Messaging settings saved')
  } catch (e) {
    error.value = Object.values(e.data?.errors || {}).join(' ') || e.message
  } finally {
    saving.value = false
  }
}

async function sendTest() {
  testing.value = true
  try {
    notify.success((await messagingApi.test(props.tenantCode, testPhone.value)).message)
  } catch (e) {
    notify.error('Test message not sent', e)
  } finally {
    testing.value = false
    loadLog()
  }
}

onMounted(load)
</script>

<style scoped>
.messaging {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h2 {
  font-size: 1.05rem;
  margin: 0;
}

.head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.status {
  margin-left: auto;
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

.grow {
  flex: 1;
}

.part-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.4rem;
}

.template {
  display: grid;
  grid-template-columns: 11rem 1fr;
  gap: 0.2rem 0.75rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.template .hint {
  grid-column: 2;
}

.actions-row {
  display: flex;
  justify-content: flex-end;
}
</style>
