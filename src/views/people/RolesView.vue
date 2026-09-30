<template>
  <main class="page">
    <TenantNav :tenantCode="tenantCode" />

    <div class="page-head">
      <div>
        <h1>Roles</h1>
        <p class="sub">A role is a set of permissions. Give roles to users on the Users tab.</p>
      </div>
      <Button v-if="canManage" label="New role" icon="pi pi-plus" @click="open(null)" />
    </div>

    <div class="panel">
      <DataTable :value="roles" :loading="loading" dataKey="id">
        <Column header="Role">
          <template #body="{ data }">
            <strong>{{ data.name }}</strong>
            <Tag v-if="data.is_system" value="Built in" severity="secondary" class="ml" />
            <div v-if="data.description" class="muted">{{ data.description }}</div>
          </template>
        </Column>
        <Column header="Permissions">
          <template #body="{ data }">
            <span v-if="data.is_system" class="muted">Everything in this clinic</span>
            <span v-else>{{ data.permissions.map(labelOf).join(', ') || '—' }}</span>
          </template>
        </Column>
        <Column field="user_count" header="Users" style="width: 80px" />
        <Column style="width: 110px">
          <template #body="{ data }">
            <div v-if="!data.is_system && canManage" class="actions">
              <Button icon="pi pi-pencil" text rounded aria-label="Edit role" @click="open(data)" />
              <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Delete role" @click="remove(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <Dialog v-model:visible="editor.open" modal :header="editor.id ? 'Edit role' : 'New role'" :style="{ width: '560px' }">
      <Message v-if="editor.error" severity="error" class="mb">{{ editor.error }}</Message>
      <form class="form-grid" @submit.prevent="save">
        <div class="field">
          <label for="role-name">Name<span class="required-star">*</span></label>
          <InputText id="role-name" v-model="editor.name" maxlength="100" fluid autofocus placeholder="Front desk" />
        </div>
        <div class="field">
          <label for="role-description">Description</label>
          <InputText id="role-description" v-model="editor.description" maxlength="255" fluid />
        </div>
        <div v-for="(items, area) in byArea" :key="area" class="perm-group">
          <div class="perm-area">{{ area }}</div>
          <div v-for="p in items" :key="p.key" class="perm-row">
            <Checkbox v-model="editor.permissions" :inputId="`perm-${p.key}`" :value="p.key"
                      :disabled="!can(tenantCode, p.key)" />
            <label :for="`perm-${p.key}`">{{ p.label }}</label>
          </div>
        </div>
        <small class="hint">You can only give permissions you have yourself. Some include others
          (for example "Add, edit and deactivate rows" also lets them see lists).</small>
      </form>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="editor.open = false" />
        <Button label="Save" icon="pi pi-check" :loading="editor.saving" @click="save" />
      </template>
    </Dialog>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import TenantNav from '@/components/layout/TenantNav.vue'
import { useNotify } from '@/composables/useNotify'
import { metaApi, rolesApi } from '@/services/api'
import { can } from '@/services/auth'

const props = defineProps({ tenantCode: { type: String, required: true } })
const notify = useNotify()
const confirm = useConfirm()

const roles = ref([])
const catalog = ref([])
const loading = ref(true)
const canManage = computed(() => can(props.tenantCode, 'roles.manage'))
const labelOf = (key) => catalog.value.find((p) => p.key === key)?.label || key
const byArea = computed(() => catalog.value.reduce((groups, p) => {
  (groups[p.area] ||= []).push(p)
  return groups
}, {}))

async function load() {
  loading.value = true
  try {
    const [r, c] = await Promise.all([rolesApi.list(props.tenantCode), metaApi.permissions()])
    roles.value = r.roles
    catalog.value = c.permissions
  } catch (e) {
    notify.error('Could not load roles', e)
  } finally {
    loading.value = false
  }
}

const editor = reactive({ open: false })
function open(role) {
  Object.assign(editor, { open: true, error: '', saving: false, id: role?.id || null, name: role?.name || '',
    description: role?.description || '', permissions: [...(role?.permissions || [])] })
}

async function save() {
  Object.assign(editor, { saving: true, error: '' })
  try {
    const payload = { name: editor.name, description: editor.description, permissions: editor.permissions }
    if (editor.id) await rolesApi.update(props.tenantCode, editor.id, payload)
    else await rolesApi.create(props.tenantCode, payload)
    editor.open = false
    notify.success('Role saved')
    load()
  } catch (e) {
    editor.error = e.message
  } finally {
    editor.saving = false
  }
}

function remove(role) {
  confirm.require({
    header: `Delete ${role.name}?`,
    message: role.user_count ? `${role.user_count} user(s) will lose this role.` : 'Nobody has this role.',
    acceptProps: { label: 'Delete', severity: 'danger' },
    rejectProps: { label: 'Cancel', severity: 'secondary', text: true },
    accept: async () => {
      try {
        await rolesApi.remove(props.tenantCode, role.id)
        notify.success('Role deleted')
        load()
      } catch (e) {
        notify.error('Could not delete the role', e)
      }
    }
  })
}

onMounted(load)
</script>

<style scoped>
.ml {
  margin-left: 0.5rem;
}

.perm-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.perm-area {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
}

.perm-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
</style>
