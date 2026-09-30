<template>
  <div class="page-card" :class="{ on: spec.on }">
    <div class="page-top">
      <ToggleSwitch v-model="spec.on" :inputId="`page-${id}`" @update:modelValue="switched" />
      <label :for="`page-${id}`" class="page-name">{{ page.label }}</label>
      <small v-if="spec.on" class="muted">{{ summary }}</small>
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

      <div v-if="page.filters?.length" class="part">
        <div class="part-title">Only these rows <small class="muted">(all conditions must match; none = every row)</small></div>
        <div v-for="(cond, i) in spec.filter" :key="i" class="cond">
          <Select v-model="cond.column" :options="page.filters" optionLabel="label" optionValue="key" placeholder="Column"
                  :ariaLabel="`Condition ${i + 1} column`" @change="resetOp(cond)" />
          <Select v-model="cond.op" :options="operatorsFor(cond)" optionLabel="label" optionValue="key" placeholder="Condition"
                  :ariaLabel="`Condition ${i + 1} operator`" @change="resetValue(cond)" />
          <template v-if="needsValue(cond)">
            <template v-if="choices(cond)">
              <MultiSelect v-if="cond.op === 'in'" v-model="cond.value" :options="choices(cond)" optionLabel="label"
                           optionValue="id" filter display="chip" placeholder="Values" :ariaLabel="`Condition ${i + 1} values`" class="value" />
              <Select v-else v-model="cond.value" :options="choices(cond)" optionLabel="label" optionValue="id" filter
                      placeholder="Value" :ariaLabel="`Condition ${i + 1} value`" class="value" />
            </template>
            <InputText v-else-if="cond.op === 'in'" :modelValue="(cond.value || []).join(', ')" placeholder="a, b, c"
                       :aria-label="`Condition ${i + 1} values`" class="value"
                       @update:modelValue="cond.value = $event.split(',').map((v) => v.trim()).filter(Boolean)" />
            <template v-else-if="cond.op === 'between'">
              <InputText v-model="cond.value[0]" :type="inputType(cond)" :aria-label="`Condition ${i + 1} from`" class="half" />
              <InputText v-model="cond.value[1]" :type="inputType(cond)" :aria-label="`Condition ${i + 1} to`" class="half" />
            </template>
            <InputText v-else v-model="cond.value" :type="inputType(cond)" placeholder="Value"
                       :aria-label="`Condition ${i + 1} value`" class="value" />
          </template>
          <Button icon="pi pi-trash" text rounded severity="secondary" :aria-label="`Remove condition ${i + 1}`"
                  @click="spec.filter.splice(i, 1)" />
        </div>
        <Button label="Add condition" icon="pi pi-filter" text size="small" @click="spec.filter.push({ column: null, op: null, value: null })" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// One page of a role: on / off, its buttons, each column's level and the row filter.
// spec = { on, actions: [], columns: {key: level}, filter: [{column, op, value}] } (edited in place).
const props = defineProps({
  page: { type: Object, required: true },
  spec: { type: Object, required: true },
  operators: { type: Object, required: true },
  // Rows of lists for "ref" columns: (list_slug) => [{id, label}] (loaded by the parent)
  refOptions: { type: Function, required: true }
})

const LEVELS = [{ value: 'edit', label: 'Edit' }, { value: 'display', label: 'Display' }, { value: 'hidden', label: 'Hidden' }]
const NO_VALUE = ['empty', 'not_empty', 'yes', 'no']
const id = computed(() => props.page.key.replace(':', '-'))

const summary = computed(() => {
  const s = props.spec
  const cols = Object.values(s.columns)
  const parts = [`${s.actions.length} button(s)`]
  if (props.page.columns?.length) parts.push(`${cols.filter((c) => c !== 'hidden').length} of ${cols.length} columns`)
  if (s.filter.length) parts.push(`${s.filter.length} condition(s)`)
  return parts.join(' · ')
})

function switched(on) {
  if (on && !props.spec.actions.length) props.spec.actions = ['view']
}
const setAll = (level) => props.page.columns.forEach((c) => { props.spec.columns[c.key] = level })

const column = (cond) => props.page.filters.find((f) => f.key === cond.column)
const operatorsFor = (cond) => (column(cond) ? props.operators[column(cond).kind] : [])
const needsValue = (cond) => cond.op && !NO_VALUE.includes(cond.op)
const inputType = (cond) => ({ number: 'number', date: 'date', time: 'time' })[column(cond)?.kind] || 'text'

function choices(cond) {
  const c = column(cond)
  if (!c) return null
  if (c.kind === 'ref') return props.refOptions(c.list_slug)
  if (c.kind === 'choice' || c.kind === 'status') return c.options.map((o) => ({ id: o, label: o }))
  return null
}

function resetOp(cond) {
  cond.op = operatorsFor(cond)[0]?.key || null
  resetValue(cond)
}
function resetValue(cond) {
  cond.value = cond.op === 'in' ? [] : cond.op === 'between' ? ['', ''] : null
}
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

.cond {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.value {
  min-width: 12rem;
  flex: 1;
}

.half {
  width: 9rem;
}
</style>
