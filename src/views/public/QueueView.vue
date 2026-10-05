<template>
  <main class="queue-page">
    <div class="card">
      <div v-if="error" class="muted">{{ error }}</div>
      <template v-else-if="q">
        <div class="clinic">{{ q.clinic }}</div>
        <div class="label">Your token</div>
        <div class="token">{{ q.token }}</div>
        <div v-if="q.previous_tokens.length" class="muted">was {{ q.previous_tokens.join(', ') }}</div>
        <div class="where">{{ [q.doctor, q.branch].filter(Boolean).join(' · ') }}</div>
        <div class="muted">{{ displayValue('date', q.date) }}, {{ q.start }}–{{ q.end }}</div>

        <div class="state" :class="q.state">
          <template v-if="q.state === 'now'">It is your turn now.</template>
          <template v-else-if="q.state === 'next'">You are next. Please be ready.</template>
          <template v-else-if="q.state === 'completed'">Your appointment is completed. Thank you.</template>
          <template v-else-if="q.state === 'cancelled'">This booking was cancelled.</template>
          <template v-else-if="q.state === 'not_arrived'">You were called but not here: your new token is {{ q.token }}.
            Please tell the reception when you arrive.</template>
          <template v-else-if="q.state === 'past'">This appointment day has passed.</template>
          <template v-else-if="!q.today">Your appointment is on {{ displayValue('date', q.date) }}.</template>
          <template v-else>{{ q.ahead }} {{ q.ahead === 1 ? 'patient' : 'patients' }} before you</template>
        </div>

        <div v-if="q.today && !['completed', 'cancelled', 'past'].includes(q.state)" class="stats">
          <div><span class="stat">{{ q.now_serving ?? '—' }}</span><span class="muted">now serving</span></div>
          <div v-if="q.minutes !== null"><span class="stat">~{{ q.minutes }}</span><span class="muted">minutes</span></div>
        </div>
        <div class="muted small">Updates every {{ q.refresh_seconds }} seconds · {{ updated }}</div>
      </template>
      <div v-else class="muted">Loading…</div>
    </div>
  </main>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { queueApi } from '@/services/api'
import { displayValue } from '@/utils/format'

// A patient's own live token page: /q/<clinic code>/<receipt code> (no login, no names of others).
const props = defineProps({ tenantCode: { type: String, required: true }, code: { type: String, required: true } })
const q = ref(null)
const error = ref('')
const updated = ref('')
let timer = null
let stopped = false   // the page closed: no more polling

async function load() {
  try {
    q.value = await queueApi.myToken(props.tenantCode, props.code)
    error.value = ''
    updated.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    document.title = `Token ${q.value.token} · ${q.value.clinic}`
  } catch (e) {
    error.value = e.httpStatus === 404 ? 'Booking not found. Check the link on your receipt.' : e.message
  } finally {
    clearTimeout(timer)
    if (!stopped && !(error.value && !q.value)) timer = setTimeout(load, (q.value?.refresh_seconds || 15) * 1000)
  }
}

onMounted(load)
onBeforeUnmount(() => { stopped = true; clearTimeout(timer) })
</script>

<style scoped>
.queue-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
  background: var(--p-content-background);
}

.card {
  width: 100%;
  max-width: 420px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.clinic {
  font-weight: 700;
  color: var(--p-primary-color);
}

.label {
  margin-top: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
}

.token {
  font-size: 5rem;
  font-weight: 800;
  line-height: 1;
}

.where {
  font-weight: 600;
}

.state {
  margin: 1.2rem 0 0.6rem;
  font-size: 1.3rem;
  font-weight: 700;
}

.state.now,
.state.next {
  color: var(--p-green-600, #16a34a);
}

.state.cancelled,
.state.not_arrived {
  color: var(--p-orange-600, #ea580c);
}

.stats {
  display: flex;
  justify-content: center;
  gap: 2.5rem;
  margin: 0.5rem 0 1rem;
}

.stats div {
  display: flex;
  flex-direction: column;
}

.stat {
  font-size: 2rem;
  font-weight: 700;
}
</style>
