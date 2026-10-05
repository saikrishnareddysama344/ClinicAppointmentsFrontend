<template>
  <main class="lobby">
    <header>
      <span class="clinic">{{ data?.clinic }}</span>
      <Select v-if="data?.branches?.length > 1" v-model="branch" :options="[{ id: null, label: 'All branches' }, ...data.branches]"
              optionLabel="label" optionValue="id" ariaLabel="Branch" class="branch" @change="pick" />
      <span class="time">{{ data?.time }}</span>
    </header>
    <div v-if="error" class="message">{{ error }}</div>
    <div v-else-if="data && !data.timings.length" class="message">No doctor timings today.</div>
    <section v-else-if="data" class="grid">
      <div v-for="t in data.timings" :key="`${t.doctor}-${t.start}`" class="tile" :class="{ ended: t.ended }">
        <div class="doctor">{{ t.doctor }}</div>
        <div class="sub">{{ [t.branch, `${t.start}–${t.end}`].filter(Boolean).join(' · ') }}</div>
        <div class="now-label">Now</div>
        <div class="now">{{ t.now_serving ?? '—' }}</div>
        <div class="next">Next: {{ t.next.length ? t.next.join(', ') : '—' }}</div>
        <div v-if="t.ended" class="sub">Session ended</div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { queueApi } from '@/services/api'

// The clinic's lobby screen: /tv/<clinic code>/<screen key>?branch=<branch id>. Tokens only, no names.
const props = defineProps({ tenantCode: { type: String, required: true }, screenKey: { type: String, required: true } })
const route = useRoute()
const router = useRouter()
const data = ref(null)
const error = ref('')
const branch = ref(route.query.branch || null)
let timer = null

async function load() {
  try {
    data.value = await queueApi.screen(props.tenantCode, props.screenKey, branch.value)
    error.value = ''
    document.title = `${data.value.clinic} · queue`
  } catch (e) {
    error.value = e.message
  } finally {
    clearTimeout(timer)
    timer = setTimeout(load, (data.value?.refresh_seconds || 15) * 1000)
  }
}

function pick() {
  router.replace({ query: branch.value ? { branch: branch.value } : {} })
  load()
}

onMounted(load)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<style scoped>
.lobby {
  min-height: 100vh;
  background: #0f172a;
  color: #f8fafc;
  padding: 1.5rem 2rem;
}

header {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.6rem;
  margin-bottom: 1.5rem;
}

.clinic {
  font-weight: 700;
}

.branch {
  min-width: 14rem;
}

.time {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
}

.tile {
  background: #1e293b;
  border-radius: 14px;
  padding: 1.25rem 1.5rem;
  text-align: center;
}

.tile.ended {
  opacity: 0.5;
}

.doctor {
  font-size: 1.6rem;
  font-weight: 700;
}

.sub {
  color: #94a3b8;
}

.now-label {
  margin-top: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #94a3b8;
}

.now {
  font-size: 6rem;
  font-weight: 800;
  line-height: 1.1;
  color: #4ade80;
}

.next {
  font-size: 1.4rem;
}

.message {
  font-size: 1.6rem;
  text-align: center;
  margin-top: 20vh;
}
</style>
