<template>
  <main class="auth-page">
    <div class="panel auth-card">
      <h1>{{ forced ? 'Choose your own password' : 'Change password' }}</h1>
      <p v-if="forced" class="sub">You logged in with a temporary password. Choose a new one to continue.</p>
      <Message v-if="error" severity="error" class="mb">{{ error }}</Message>
      <form class="form-grid" @submit.prevent="submit">
        <div class="field">
          <label for="pw-current">{{ forced ? 'Temporary password' : 'Current password' }}</label>
          <InputText id="pw-current" v-model="current" type="password" autocomplete="current-password" fluid autofocus />
        </div>
        <div class="field">
          <label for="pw-new">New password</label>
          <InputText id="pw-new" v-model="next" type="password" autocomplete="new-password" fluid />
          <small class="hint">At least 10 characters.</small>
        </div>
        <div class="field">
          <label for="pw-again">New password again</label>
          <InputText id="pw-again" v-model="again" type="password" autocomplete="new-password" fluid />
        </div>
        <Button type="submit" label="Save password" icon="pi pi-check" :loading="busy" fluid />
      </form>
      <Button v-if="!forced" label="Back" severity="secondary" text class="mt" @click="router.back()" />
      <Button v-else label="Log out" severity="secondary" text class="mt" @click="logout()" />
    </div>
  </main>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotify } from '@/composables/useNotify'
import { home } from '@/router'
import { authApi } from '@/services/api'
import { logout, mustChangePassword, refreshUser } from '@/services/auth'

const router = useRouter()
const notify = useNotify()
const forced = computed(() => mustChangePassword.value)
const current = ref('')
const next = ref('')
const again = ref('')
const busy = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (next.value !== again.value) {
    error.value = 'The new passwords do not match.'
    return
  }
  busy.value = true
  try {
    await authApi.changePassword({ current_password: current.value, new_password: next.value })
    await refreshUser()
    notify.success('Password changed', 'Other devices were logged out.')
    router.replace(home())
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>
