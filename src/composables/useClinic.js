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

// After staff add a booking: print right away when the clinic turned on auto-print (what the
// clinic prints first, only what this role may print; a receipt waiting for a bill is left out).
export async function autoPrintBooking(code, booking) {
  const clinic = await loadClinic(code)
  const s = clinic.print_settings || {}
  if (!s.auto_print || !clinic.booking || !booking) return
  const kinds = [s.print_what !== 'op' && s.receipt && !s.bill_required && can(code, 'bookings', 'print_receipt') && 'receipt',
    s.print_what !== 'receipt' && s.op_sheet && can(code, 'bookings', 'print_op') && 'op'].filter(Boolean)
  if (kinds.length) printBooking(await schedulesApi.print(code, clinic.booking.slug, booking.id, kinds), kinds)
}
