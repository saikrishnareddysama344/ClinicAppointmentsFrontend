<template>
  <div class="page-card" :class="{ on: spec.on }">
    <div class="page-top">
      <ToggleSwitch v-model="spec.on" :inputId="`page-${id}`" @update:modelValue="switched" />
      <label :for="`page-${id}`" class="page-name">{{ page.label }}</label>
      <small v-if="spec.on" class="muted">{{ summary }}</small>
      <small v-if="isList && spec.values.length" class="muted">· values limited</small>
    </div>

    <div v-if="spec.on" class="page-body">
      <div class="part">
        <div class="part-title">Buttons</div>
        <div class="checks">
          <div v-for="a in page.actions" :key="a.key" class="check">
            <Checkbox v-model="spec.actions" :value="a.key" :inputId="`${id}-a-${a.key}`" :disabled="a.key === 'view'" />
            <label :for="`${id}-a-${a.key}`">{{ a.label }}</label>
          </div>
        </div>
      </div>

      <slot />

      <Message v-if="needsEditable.length" severity="warn" size="small" class="needs">
        Adding entries needs these columns editable: {{ needsEditable.map((c) => c.label).join(', ') }}.
        <Button label="Make them editable" text size="small" @click="makeEditable" />
      </Message>

      <div v-if="page.columns?.length" class="part">
        <div class="part-title">
          Columns
          <span class="bulk">
            All:
            <Button v-for="lv in LEVELS" :key="lv.value" :label="lv.label" text size="small" @click="setAll(lv.value)" />
          </span>
        </div>
        <div v-for="c in page.columns" :key="c.key" class="column-row">
          <span class="column-label">{{ c.label }}</span>
          <SelectButton v-model="spec.columns[c.key]" :options="LEVELS" optionLabel="label" optionValue="value"
                        :allowEmpty="false" size="small" :aria-label="`${c.label} access`" />
        </div>
      </div>
    </div>

    <div v-if="page.filters?.length && spec.on" class="part filter-part">
      <div class="part-title">Only these rows on the page <small class="muted">(all conditions must match; none = every row)</small></div>
      <ConditionsEditor :conditions="spec.filter" :columns="page.filters" :operators="operators" :refOptions="refOptions" />
    </div>
    <div v-if="isList && page.filters?.length" class="part filter-part">
      <div class="part-title">Values this role can use
        <small class="muted">(everywhere this list is used: dropdowns, doctor / branch, timings, bookings; none = all)</small>
      </div>
      <ConditionsEditor :conditions="spec.values" :columns="page.filters" :operators="operators" :refOptions="refOptions"
                        label="Value condition" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import ConditionsEditor from './ConditionsEditor.vue'

// One page of a role: on / off, its buttons, each column's level and the row filter; for a list also
// the values the role can use everywhere (even with the Rows page off).
// spec = { on, actions: [], columns: {key: level}, filter: [...], values: [...] } (edited in place).
const props = defineProps({
  page: { type: Object, required: true },
  spec: { type: Object, required: true },
  operators: { type: Object, required: true },
  // Rows of lists for "ref" columns: (list_slug) => [{id, label}] (loaded by the parent)
  refOptions: { type: Function, required: true }
})

const LEVELS = [{ value: 'edit', label: 'Edit' }, { value: 'display', label: 'Display' }, { value: 'hidden', label: 'Hidden' }]
const id = computed(() => props.page.key.replace(':', '-'))
const isList = computed(() => props.page.type === 'list')

const summary = computed(() => {
  const s = props.spec
  const cols = Object.values(s.columns)
  const parts = [`${s.actions.length} button(s)`]
  if (props.page.columns?.length) parts.push(`${cols.filter((c) => c !== 'hidden').length} of ${cols.length} columns`)
  if (s.filter.length) parts.push(`${s.filter.length} row condition(s)`)
  return parts.join(' · ')
})

// With Add, every required column (and the appointment slot) must be editable, or the server refuses the role.
const needsEditable = computed(() => (props.spec.actions.includes('add')
  ? (props.page.columns || []).filter((c) => c.required && props.spec.columns[c.key] !== 'edit') : []))
const makeEditable = () => needsEditable.value.forEach((c) => { props.spec.columns[c.key] = 'edit' })

function switched(on) {
  if (on && !props.spec.actions.length) props.spec.actions = ['view']
}
const setAll = (level) => props.page.columns.forEach((c) => { props.spec.columns[c.key] = level })
</script>

<style scoped>
.page-card {
  border: 1px solid var(--p-content-border-color);
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
}

.page-card.on {
  border-color: var(--p-primary-color);
}

.page-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.page-name {
  font-weight: 600;
}

.needs {
  margin: 0;
}

.filter-part {
  margin-top: 0.75rem;
}

.page-body {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.part-title {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--p-text-muted-color);
  margin-bottom: 0.4rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bulk {
  margin-left: auto;
  font-weight: normal;
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

.column-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.2rem 0;
}

</style>
