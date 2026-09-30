<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" />

    <div class="page-head">
      <div>
        <h1>Users</h1>
        <p class="sub">People who can log in to this clinic, and what their roles let them do.</p>
      </div>
      <Button label="Add user" icon="pi pi-plus" :disabled="!roles.length" @click="open(null)" />
    </div>

    <div class="panel">
      <DataTable :value="users" :loading="loading" dataKey="id" :rowClass="(u) => (u.status === 'active' ? '' : 'muted')">
        <Column header="Name">
          <template #body="{ data }"><strong>{{ data.name }}</strong><div class="muted">{{ data.email }}</div></template>
        </Column>
        <Column header="Roles">
          <template #body="{ data }">{{ data.role_ids.map(roleName).join(', ') }}</template>
        </Column>
        <Column header="Status">
          <template #body="{ data }">
            <div class="tags">
              <Tag :value="data.status" :severity="data.status === 'active' ? 'success' : 'secondary'" />
              <Tag v-if="data.locked" value="locked" severity="danger" />
              <Tag v-if="data.must_change_password" value="temporary password" severity="warn" />
            </div>
          </template>
        </Column>
        <Column header="Logins at a time" style="width: 130px">
          <template #body="{ data }">{{ data.max_sessions || 'No limit' }}
            <span class="muted">({{ data.active_sessions }} now)</span></template>
        </Column>
        <Column header="Last login" style="width: 170px">
          <template #body="{ data }"><span class="muted">{{ when(data.last_login_at) }}</span></template>
        </Column>
        <Column style="width: 190px">
          <template #body="{ data }">
            <div class="actions">
              <Button icon="pi pi-pencil" text rounded aria-label="Edit user" v-tooltip.top="'Edit'" @click="open(data)" />
              <Button icon="pi pi-key" text rounded aria-label="Reset password" v-tooltip.top="'Reset password'"
                      :disabled="data.other_clinics" @click="openReset(data)" />
              <Button v-if="data.locked" icon="pi pi-lock-open" text rounded aria-label="Unlock"
                      v-tooltip.top="'Unlock'" @click="unlock(data)" />
              <Button icon="pi pi-desktop" text rounded aria-label="Sessions" v-tooltip.top="'Logged-in devices'"
                      @click="openSessions(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="editor.open" modal :header="editor.id ? 'Edit user' : 'Add user'" :style="{ width: '480px' }">
      <Message v-if="editor.error" severity="error" class="mb">{{ editor.error }}</Message>
      <Message v-if="editor.otherClinics" severity="info" class="mb">
        This person also works in another clinic, so only their roles here can be changed.</Message>
      <form class="form-grid" @submit.prevent="save">
        <div class="field">
          <label for="user-name">Full name<span class="required-star">*</span></label>
          <InputText id="user-name" v-model="editor.name" maxlength="150" fluid autofocus :disabled="editor.otherClinics" />
        </div>
        <template v-if="!editor.id">
          <div class="field">
            <label for="user-email">Email<span class="required-star">*</span></label>
            <InputText id="user-email" v-model.trim="editor.email" type="email" fluid />
          </div>
          <div class="field">
            <label for="user-password">Temporary password<span class="required-star">*</span></label>
            <InputText id="user-password" v-model="editor.password" fluid />
            <small class="hint">At least 10 characters. Give it to them; they must change it at first login.</small>
          </div>
        </template>
        <div class="field">
          <label>Roles<span class="required-star">*</span></label>
          <div v-for="r in roles" :key="r.id" class="check-row">
            <Checkbox v-model="editor.role_ids" :inputId="`role-${r.id}`" :value="r.id" />
            <label :for="`role-${r.id}`">{{ r.name }}</label>
          </div>
        </div>
        <div class="field">
          <label for="user-max">Logins at a time</label>
          <InputNumber inputId="user-max" v-model="editor.max_sessions" :min="0" :max="100" :useGrouping="false"
                       fluid :disabled="editor.otherClinics" />
          <small class="hint">Devices they can be logged in on at once; 0 = no limit. A new login ends the oldest.</small>
        </div>
        <div v-if="editor.id" class="check-row">
          <ToggleSwitch v-model="editor.active" inputId="user-active" :disabled="editor.otherClinics" />
          <label for="user-active">Active (can log in)</label>
        </div>
      </form>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="editor.open = false" />
        <Button label="Save" icon="pi pi-check" :loading="editor.saving" @click="save" />
      </template>
    </Dialog>

    <Dialog v-model:visible="reset.open" modal header="Reset password" :style="{ width: '420px' }">
      <Message v-if="reset.error" severity="error" class="mb">{{ reset.error }}</Message>
      <p>New temporary password for <strong>{{ reset.user?.name }}</strong>. They are logged out everywhere,
        unlocked, and must choose their own password at next login.</p>
      <div class="field">
        <label for="reset-password">Temporary password</label>
        <InputText id="reset-password" v-model="reset.password" fluid autofocus />
      </div>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="reset.open = false" />
        <Button label="Reset" icon="pi pi-key" :loading="reset.saving" @click="saveReset" />
      </template>
    </Dialog>

    <Dialog v-model:visible="devices.open" modal :header="`Logged-in devices: ${devices.user?.name || ''}`"
            :style="{ width: '620px' }">
      <DataTable :value="devices.list" :loading="devices.loading" dataKey="id">
        <template #empty><div class="empty">Not logged in anywhere.</div></template>
        <Column header="Device"><template #body="{ data }"><span class="small">{{ data.user_agent || '—' }}</span></template></Column>
        <Column field="ip" header="IP" style="width: 120px" />
        <Column header="Last active" style="width: 160px"><template #body="{ data }">{{ when(data.last_seen_at) }}</template></Column>
        <Column style="width: 90px">
          <template #body="{ data }">
            <Button label="End" size="small" severity="danger" text @click="endSession(data)" />
          </template>
        </Column>
      </DataTable>
    </Dialog>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import TenantNav from '@/components/layout/TenantNav.vue'
import { useNotify } from '@/composables/useNotify'
import { appConfig } from '@/config/env'
import { rolesApi, usersApi } from '@/services/api'

const props = defineProps({ tenantCode: { type: String, required: true } })
const notify = useNotify()

const users = ref([])
const roles = ref([])
const loading = ref(true)
const roleName = (id) => roles.value.find((r) => r.id === id)?.name || `#${id}`
const when = (iso) => (iso ? new Date(iso).toLocaleString(appConfig.locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—')

async function load() {
  loading.value = true
  try {
    const [u, r] = await Promise.all([usersApi.list(props.tenantCode), rolesApi.list(props.tenantCode)])
    users.value = u.users
    roles.value = r.roles
  } catch (e) {
    notify.error('Could not load users', e)
  } finally {
    loading.value = false
  }
}

const editor = reactive({ open: false })
function open(user) {
  Object.assign(editor, {
    open: true, error: '', saving: false, id: user?.id || null, name: user?.name || '', email: '', password: '',
    role_ids: [...(user?.role_ids || [])], max_sessions: user ? user.max_sessions : 1,
    active: user ? user.status === 'active' : true, otherClinics: !!user?.other_clinics
  })
}

async function save() {
  Object.assign(editor, { saving: true, error: '' })
  try {
    if (editor.id) {
      const payload = editor.otherClinics ? { role_ids: editor.role_ids }
        : { name: editor.name, role_ids: editor.role_ids, max_sessions: editor.max_sessions ?? 0,
            status: editor.active ? 'active' : 'disabled' }
      await usersApi.update(props.tenantCode, editor.id, payload)
    } else {
      await usersApi.create(props.tenantCode, { name: editor.name, email: editor.email, password: editor.password,
        role_ids: editor.role_ids, max_sessions: editor.max_sessions ?? 0 })
    }
    editor.open = false
    notify.success('User saved')
    load()
  } catch (e) {
    editor.error = Object.values(e.data?.errors || {})[0] || e.message
  } finally {
    editor.saving = false
  }
}

const reset = reactive({ open: false })
const openReset = (user) => Object.assign(reset, { open: true, user, password: '', error: '', saving: false })
async function saveReset() {
  Object.assign(reset, { saving: true, error: '' })
  try {
    await usersApi.resetPassword(props.tenantCode, reset.user.id, reset.password)
    reset.open = false
    notify.success('Password reset', 'Give them the temporary password.')
    load()
  } catch (e) {
    reset.error = e.message
  } finally {
    reset.saving = false
  }
}

async function unlock(user) {
  try {
    await usersApi.unlock(props.tenantCode, user.id)
    notify.success('Unlocked', `${user.name} can log in again.`)
    load()
  } catch (e) {
    notify.error('Could not unlock', e)
  }
}

const devices = reactive({ open: false, list: [], loading: false })
async function openSessions(user) {
  Object.assign(devices, { open: true, user, list: [], loading: true })
  try {
    devices.list = (await usersApi.sessions(props.tenantCode, user.id)).sessions
  } catch (e) {
    notify.error('Could not load sessions', e)
  } finally {
    devices.loading = false
  }
}

async function endSession(session) {
  try {
    await usersApi.endSession(props.tenantCode, devices.user.id, session.id)
    devices.list = devices.list.filter((s) => s.id !== session.id)
    notify.success('Session ended')
    load()
  } catch (e) {
    notify.error('Could not end the session', e)
  }
}

onMounted(load)
</script>

<style scoped>
.tags {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
}

.check-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.2rem 0;
}

.small {
  font-size: 0.8rem;
}
</style>
