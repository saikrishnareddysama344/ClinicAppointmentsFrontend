<template>
  <section class="panel" aria-label="Fields">
    <div class="builder-col-head">
      <span>Fields <span class="muted">({{ fields.length }}<template v-if="maxFields"> / {{ maxFields }}</template>)</span></span>
      <Button label="Add field" icon="pi pi-plus" size="small" :disabled="atLimit"
              @click="(event) => addMenu.toggle(event)" />
      <Menu ref="addMenu" :model="addMenuItems" popup />
    </div>

    <div v-if="!fields.length" class="empty">
      <i class="pi pi-list" aria-hidden="true" />
      No fields yet. Use "Add field" to start.
    </div>

    <ul v-else class="field-list">
      <li
        v-for="(field, index) in fields"
        :key="field.key"
        class="field-item"
        :class="{ selected: field.key === selectedKey, 'has-error': errors[field.key]?.length }"
        @click="emit('select', field.key)"
      >
        <span class="order">{{ index + 1 }}</span>
        <div class="info">
          <div class="label">
            {{ field.display_label || 'Untitled field' }}<span v-if="field.is_mandatory" class="required-star">*</span>
          </div>
          <div class="meta">
            <span>{{ typeName(field.data_type) }}</span>
            <span v-if="field.is_display" class="display-badge"><i class="pi pi-star-fill" aria-hidden="true" /> display</span>
            <span v-if="field.column_name" v-tooltip.top="'Published column: type is locked'">
              <i class="pi pi-lock" aria-hidden="true" /> {{ field.column_name }}
            </span>
            <span v-else-if="!isDraft" class="new-badge">new</span>
            <span v-if="errors[field.key]?.length" class="error-badge">
              <i class="pi pi-exclamation-circle" aria-hidden="true" /> fix needed
            </span>
          </div>
        </div>
        <div class="tools" @click.stop>
          <Button icon="pi pi-arrow-up" text rounded size="small" aria-label="Move up"
                  :disabled="index === 0" @click="emit('move', index, -1)" />
          <Button icon="pi pi-arrow-down" text rounded size="small" aria-label="Move down"
                  :disabled="index === fields.length - 1" @click="emit('move', index, 1)" />
          <Button icon="pi pi-copy" text rounded size="small" aria-label="Duplicate" :disabled="atLimit"
                  @click="emit('duplicate', index)" />
          <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Remove"
                  :disabled="!!field.column_name"
                  v-tooltip.top="field.column_name ? 'Published fields cannot be removed' : 'Remove'"
                  @click="emit('remove', index)" />
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { DEFAULT_TYPE_ICON, TYPE_ICONS } from '@/constants/fieldTypes'

const props = defineProps({
  fields: { type: Array, required: true },
  selectedKey: { type: String, default: null },
  errors: { type: Object, default: () => ({}) },
  dataTypes: { type: Array, default: () => [] },
  typeName: { type: Function, required: true },
  isDraft: { type: Boolean, default: true },
  maxFields: { type: Number, default: 0 }
})

const emit = defineEmits(['select', 'add', 'move', 'duplicate', 'remove'])

const addMenu = ref()

const atLimit = computed(() => !!props.maxFields && props.fields.length >= props.maxFields)

const addMenuItems = computed(() =>
  props.dataTypes.map((t) => ({
    label: t.display_name,
    icon: TYPE_ICONS[t.type_key] || DEFAULT_TYPE_ICON,
    command: () => emit('add', t.type_key)
  }))
)
</script>

<style scoped>
.new-badge {
  color: var(--p-orange-500);
}

.error-badge {
  color: var(--p-red-500);
}

.display-badge {
  color: var(--p-primary-color);
}
</style>
