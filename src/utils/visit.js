// How a booking's visit, amount and source read on screens and printouts.
import { appConfig } from '@/config/env'

export const visitLabel = (b) => (b?.visit_type === 'revisit' ? `Revisit ${b.revisit_no} of ${b.revisit_of}` : 'New consultation')

export const rupees = (v) => `₹${Number(v || 0).toLocaleString(appConfig.locale, { maximumFractionDigits: 2 })}`

// "Due ₹500" / "Paid ₹500 (UPI)" / "Free" for the desk.
export function amountLabel(b) {
  if (b.paid) return `Paid ${rupees(b.bill?.total)}${b.bill?.mode ? ` (${String(b.bill.mode).toUpperCase()})` : ''}`
  return Number(b.fee_due || 0) > 0 ? `Due ${rupees(b.fee_due)}` : 'Free'
}
