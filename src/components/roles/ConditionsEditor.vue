<template>
  <div>
    <div v-for="(cond, i) in conditions" :key="i" class="cond">
      <Select v-model="cond.column" :options="columns" optionLabel="label" optionValue="key" placeholder="Column"
              :ariaLabel="`${label} ${i + 1} column`" @change="resetOp(cond)" />
      <Select v-model="cond.op" :options="operatorsFor(cond)" optionLabel="label" optionValue="key" placeholder="Condition"
              :ariaLabel="`${label} ${i + 1} operator`" @change="resetValue(cond)" />
      <template v-if="needsValue(cond)">
        <template v-if="choices(cond)">
          <MultiSelect v-if="cond.op === 'in'" v-model="cond.value" :options="choices(cond)" optionLabel="label"
                       optionValue="id" filter display="chip" placeholder="Values" :ariaLabel="`${label} ${i + 1} values`" class="value" />
          <Select v-else v-model="cond.value" :options="choices(cond)" optionLabel="label" optionValue="id" filter
                  placeholder="Value" :ariaLabel="`${label} ${i + 1} value`" class="value" />
        </template>
        <InputText v-else-if="cond.op === 'in'" :modelValue="(cond.value || []).join(', ')" placeholder="a, b, c"
                   :aria-label="`${label} ${i + 1} values`" class="value"
                   @update:modelValue="cond.value = $event.split(',').map((v) => v.trim()).filter(Boolean)" />
        <template v-else-if="cond.op === 'between'">
          <InputText v-model="cond.value[0]" :type="inputType(cond)" :aria-label="`${label} ${i + 1} from`" class="half" />
          <InputText v-model="cond.value[1]" :type="inputType(cond)" :aria-label="`${label} ${i + 1} to`" class="half" />
        </template>
        <InputText v-else v-model="cond.value" :type="inputType(cond)" placeholder="Value"
                   :aria-label="`${label} ${i + 1} value`" class="value" />
      </template>
      <Button icon="pi pi-trash" text rounded severity="secondary" :aria-label="`Remove ${label.toLowerCase()} ${i + 1}`"
              @click="conditions.splice(i, 1)" />
    </div>
    <Button :label="`Add ${label.toLowerCase()}`" icon="pi pi-filter" text size="small" @click="conditions.push({ column: null, op: null, value: null })" />
  </div>
</template>

<script setup>
// Conditions on a page's columns (all must match): a Rows page filter or a list's values limit.
// conditions = [{column, op, value}] (edited in place).
const props = defineProps({
  conditions: { type: Array, required: true },
  columns: { type: Array, required: true },       // the page's filterable columns (catalog "filters")
  operators: { type: Object, required: true },
  refOptions: { type: Function, required: true }, // (list_slug) => [{id, label}]
  label: { type: String, default: 'Condition' }
})

const NO_VALUE = ['empty', 'not_empty', 'yes', 'no']
const column = (cond) => props.columns.find((f) => f.key === cond.column)
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
