<template>
  <Dialog :visible="!!booking" modal header="Payment" :style="{ width: '460px' }" :breakpoints="{ '520px': '96vw' }"
          @update:visible="(v) => v || emit('close')">
    <template v-if="booking">
      <p class="muted">
        Token {{ booking.token_no }} · {{ booking.patient_name || 'Patient' }} · {{ booking.who }}
      </p>
      <div class="due">
        <Tag :value="visitLabel(booking)" :severity="booking.visit_type === 'revisit' ? 'info' : 'secondary'" />
        <strong>{{ booking.paid ? 'Paid' : 'Due' }} {{ money(booking.paid ? booking.bill?.total : booking.fee_due) }}</strong>
      </div>
      <Message v-if="error" severity="error" class="mb">{{ error }}</Message>

      <div v-if="canChange" class="switch-row">
        <ToggleSwitch v-model="changing" inputId="pay-change" />
        <label for="pay-change">Change amount (discount or extra items)</label>
      </div>
      <template v-if="changing">
        <div v-for="(line, i) in lines" :key="i" class="bill-line">
          <InputText v-model="line.label" placeholder="Item" maxlength="60" :aria-label="`Item ${i + 1}`" class="grow" />
          <InputNumber v-model="line.amount" :min="0" :maxFractionDigits="2" placeholder="Amount"
                       :inputId="`pay-amount-${i}`" :ariaLabel="`Amount ${i + 1}`" inputClass="amount" />
          <Button icon="pi pi-trash" text rounded severity="secondary" :disabled="lines.length === 1"
                  :aria-label="`Remove line ${i + 1}`" @click="lines.splice(i, 1)" />
        </div>
        <Button label="Add line" icon="pi pi-plus" text size="small" :disabled="lines.length >= 10"
                @click="lines.push({ label: '', amount: null })" />
      </template>

      <div class="pay-foot">
        <SelectButton v-model="mode" :options="MODES" optionLabel="label" optionValue="value" :allowEmpty="false"
                      aria-label="Payment mode" />
        <strong>Total {{ money(total) }}</strong>
      </div>
    </template>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="emit('close')" />
      <Button :label="booking?.paid ? 'Save correction' : 'Payment received'" icon="pi pi-check" :loading="saving"
              :disabled="booking?.paid && !changing" @click="save" />
    </template>
  </Dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { schedulesApi } from '@/services/api'
import { rupees as money, visitLabel } from '@/utils/visit'

// Marks a booking's payment: the amount due in a mode, or (with "Change amount") other lines.
const props = defineProps({
  tenantCode: { type: String, required: true },
  slug: { type: String, required: true },
  booking: { type: Object, default: null },
  canChange: { type: Boolean, default: false }
})
const emit = defineEmits(['close', 'paid', 'changed'])

const MODES = ['cash', 'upi', 'card', 'other'].map((value) => ({ value, label: value.toUpperCase() }))
const mode = ref('cash')
const changing = ref(false)
const lines = ref([])
const saving = ref(false)
const error = ref('')

const total = computed(() => (changing.value ? lines.value.reduce((s, l) => s + (Number(l.amount) || 0), 0)
  : Number((props.booking?.paid ? props.booking.bill?.total : props.booking?.fee_due) || 0)))

watch(() => props.booking, (b, before) => {
  if (!b) return
  if (b.id !== before?.id) error.value = ''   // the same booking again: keep the "amount changed" note
  mode.value = b.bill?.mode || 'cash'
  changing.value = !!b.paid
  lines.value = b.bill ? b.bill.lines.map((l) => ({ label: l.label, amount: Number(l.amount) }))
    : [{ label: b.visit_type === 'revisit' ? 'Review' : 'Consultation', amount: Number(b.fee_due || 0) }]
})

async function save() {
  saving.value = true
  error.value = ''
  try {
    // expected_fee: the server refuses (409) when the amount changed meanwhile (e.g. now a revisit).
    const payload = { mode: mode.value, ...(props.booking.paid ? {} : { expected_fee: props.booking.fee_due ?? 0 }) }
    if (changing.value) {
      payload.lines = lines.value.filter((l) => l.label || l.amount != null)
        .map((l) => ({ label: (l.label || '').trim(), amount: l.amount ?? 0 }))
    }
    const body = await schedulesApi.pay(props.tenantCode, props.slug, props.booking.id, payload)
    emit('paid', body.booking)
  } catch (e) {
    error.value = e.message
    if (e.data?.booking) emit('changed', e.data.booking)   // show the new amount; saving again confirms it
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.due,
.pay-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  margin: 0.75rem 0;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}

.bill-line {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 0.5rem;
}

.bill-line :deep(.amount) {
  width: 110px;
}

.grow {
  flex: 1;
}

.mb {
  margin-bottom: 1rem;
}
</style>
