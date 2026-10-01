// A clinic's settings (details, booking setup, print settings, OP template), fetched once per clinic
// and shared by the pages that print or book. Call forgetClinic(code) after saving settings.
import { clinicApi, schedulesApi } from '@/services/api'
import { can } from '@/services/auth'
import { printBooking } from '@/utils/print'

const cache = {}

export function loadClinic(code) {
  cache[code] ||= clinicApi.info(code).catch((e) => {
    delete cache[code]
    throw e
  })
  return cache[code]
}

export const forgetClinic = (code) => delete cache[code]

// A booking can be printed once its payment is marked, or straight away when nothing is due.
export const needsPayment = (booking) => booking?.status !== 'cancelled' && !booking?.paid && Number(booking?.fee_due || 0) > 0

// After staff add a booking (or mark its payment): print right away when the clinic turned on
// auto-print (what the clinic prints first, only what this role may print, only once nothing is due).
export async function autoPrintBooking(code, booking) {
  const clinic = await loadClinic(code)
  const s = clinic.print_settings || {}
  if (!s.auto_print || !clinic.booking || !booking || needsPayment(booking)) return
  const kinds = [s.print_what !== 'op' && s.receipt && can(code, 'bookings', 'print_receipt') && 'receipt',
    s.print_what !== 'receipt' && s.op_sheet && can(code, 'bookings', 'print_op') && 'op'].filter(Boolean)
  if (kinds.length) printBooking(await schedulesApi.print(code, clinic.booking.slug, booking.id, kinds), kinds)
}
