<template>
  <main class="auth-page">
    <div class="panel auth-card">
      <div class="auth-brand"><i class="pi pi-th-large" aria-hidden="true" /> {{ appConfig.title }}</div>
      <h1>Log in</h1>
      <Message v-if="notice" severity="info" class="mb">{{ notice }}</Message>
      <Message v-if="error" severity="error" class="mb">{{ error }}</Message>
      <form class="form-grid" @submit.prevent="submit">
        <div class="field">
          <label for="login-email">Email</label>
          <InputText id="login-email" v-model.trim="email" type="email" autocomplete="username" fluid autofocus />
        </div>
        <div class="field">
          <label for="login-password">Password</label>
          <InputText id="login-password" v-model="password" type="password" autocomplete="current-password" fluid />
        </div>
        <Button type="submit" label="Log in" icon="pi pi-sign-in" :loading="busy" fluid />
      </form>
      <p class="hint">Forgot your password? Ask your clinic administrator to reset it.</p>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { appConfig } from '@/config/env'
import { home } from '@/router'
import { login, logoutNotice } from '@/services/auth'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref(logoutNotice())   // e.g. "You were logged out because you signed in on another device."

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await login(email.value, password.value)
    const next = route.query.next
    const local = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : null
    router.replace(local || home())
  } catch (e) {
    error.value = e.message
    password.value = ''
  } finally {
    busy.value = false
  }
}
</script>
