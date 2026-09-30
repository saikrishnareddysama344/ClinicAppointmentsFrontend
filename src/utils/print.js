// Printing receipts, OP sheets and QR posters with the browser's print dialog (works with thermal
// printers installed in Windows and with "Save as PDF"). The page is built as plain HTML in a hidden
// iframe (id "print-frame") so the app's own page is untouched; the frame stays until the next print.
import { appConfig } from '@/config/env'

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const PAGE = {
  '80mm': { size: '80mm auto', margin: '3mm', width: '74mm', font: '11px' },
  '58mm': { size: '58mm auto', margin: '2mm', width: '54mm', font: '10px' },
  A5: { size: 'A5', margin: '10mm', width: 'auto', font: '12px' },
  A4: { size: 'A4', margin: '12mm', width: 'auto', font: '12px' }
}

const money = (value) => Number(value || 0).toLocaleString(appConfig.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(appConfig.locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '')
const stamp = (iso) => (iso ? new Date(iso).toLocaleString(appConfig.locale, { dateStyle: 'medium', timeStyle: 'short' }) : '')
const value = (a) => (a.value === true ? 'Yes' : a.value === false ? 'No' : a.value)

function header(clinic, compact) {
  return `<div class="clinic ${compact ? 'compact' : ''}">
    <div class="clinic-name">${esc(clinic.name)}</div>
    ${clinic.address ? `<div>${esc(clinic.address)}</div>` : ''}
    ${clinic.phone ? `<div>Phone: ${esc(clinic.phone)}</div>` : ''}
  </div>`
}

// One receipt (with the bill when there is one).
export function receiptHtml(data) {
  const b = data.booking
  const bill = b.bill
  return `<section class="sheet receipt">
    ${header(data.clinic, true)}
    <div class="title">APPOINTMENT RECEIPT</div>
    ${b.status === 'cancelled' ? '<div class="cancelled">CANCELLED</div>' : ''}
    <div class="token">Token <b>${esc(b.token_no)}</b></div>
    <table class="kv">
      <tr><td>${esc(data.who_label || 'Doctor')}</td><td>${esc(b.who)}</td></tr>
      ${b.where ? `<tr><td>${esc(data.where_label || 'Branch')}</td><td>${esc(b.where)}</td></tr>` : ''}
      <tr><td>Date</td><td>${esc(day(b.date))}</td></tr>
      <tr><td>Time</td><td>${esc(b.start)}–${esc(b.end)}</td></tr>
      ${data.patient.map((a) => `<tr><td>${esc(a.label)}</td><td>${esc(value(a))}</td></tr>`).join('')}
      ${b.op_number ? `<tr><td>OP number</td><td>${esc(b.op_number)}</td></tr>` : ''}
      <tr><td>Booking no.</td><td>${esc(b.id)}</td></tr>
      <tr><td>Booked</td><td>${esc(stamp(b.created_at))} (${esc(data.booked_by)})</td></tr>
    </table>
    ${bill ? `<table class="bill">
      ${bill.lines.map((l) => `<tr><td>${esc(l.label)}</td><td class="num">${esc(money(l.amount))}</td></tr>`).join('')}
      <tr class="total"><td>Total (${esc(String(bill.mode).toUpperCase())})</td><td class="num">${esc(money(bill.total))}</td></tr>
    </table>` : ''}
    ${data.clinic.note ? `<div class="note">${esc(data.clinic.note)}</div>` : ''}
    ${data.settings?.language_line ? `<div class="note">${esc(data.settings.language_line)}</div>` : ''}
  </section>`
}

// OP sheet: patient details on top, blank sections for the doctor below.
export function opSheetHtml(data) {
  const b = data.booking
  const template = data.op_template || { fields: [], sections: [] }
  const byId = Object.fromEntries(data.patient.map((a) => [a.field_id, a]))
  const fields = template.fields?.length ? template.fields.map((id) => byId[id]).filter(Boolean) : data.patient
  const lines = (n) => Array.from({ length: n }, () => '<div class="line"></div>').join('')
  return `<section class="sheet op">
    ${header(data.clinic, false)}
    <div class="op-head">
      <div><span class="muted">OP No.</span> <b>${esc(b.op_number || '')}</b></div>
      <div><span class="muted">Token</span> <b>${esc(b.token_no)}</b></div>
      <div><span class="muted">Date</span> ${esc(day(b.date))} ${esc(b.start)}–${esc(b.end)}</div>
    </div>
    <div class="op-head">
      <div><span class="muted">${esc(data.who_label || 'Doctor')}</span> ${esc(b.who)}</div>
      ${b.where ? `<div><span class="muted">${esc(data.where_label || 'Branch')}</span> ${esc(b.where)}</div>` : ''}
    </div>
    <table class="patient">${fields.map((a) => `<tr><td>${esc(a.label)}</td><td>${esc(value(a))}</td></tr>`).join('')}</table>
    ${(template.sections || []).map((s) => `<div class="section">
      <div class="section-title">${esc(s.title)}</div>
      ${s.items?.length ? `<div class="items">${s.items.map((i) => `<span>${esc(i)}: ________</span>`).join('')}</div>` : ''}
      ${lines(s.lines || 0)}
    </div>`).join('')}
    <div class="sign">Doctor's signature</div>
  </section>`
}

// A QR poster for the booking link (A4 / A5).
export function posterHtml({ clinic, link, qrSvg, languageLine, branch }) {
  return `<section class="sheet poster">
    <div class="poster-clinic">${esc(clinic.name)}</div>
    ${branch ? `<div class="poster-branch">${esc(branch)}</div>` : ''}
    <div class="poster-title">Scan to book your appointment</div>
    <div class="poster-qr">${qrSvg}</div>
    <div class="poster-link">${esc(link)}</div>
    ${languageLine ? `<div class="poster-lang">${esc(languageLine)}</div>` : ''}
    ${clinic.phone ? `<div class="poster-phone">Phone: ${esc(clinic.phone)}</div>` : ''}
  </section>`
}

const STYLE = (page) => `
  @page { size: ${page.size}; margin: ${page.margin}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: ${page.font}; color: #000; }
  .sheet { width: ${page.width}; page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  .clinic { text-align: center; border-bottom: 1px solid #000; padding-bottom: 4px; margin-bottom: 6px; }
  .clinic-name { font-size: 1.4em; font-weight: bold; }
  .title { text-align: center; font-weight: bold; margin: 4px 0; letter-spacing: 1px; }
  .cancelled { text-align: center; font-weight: bold; font-size: 1.3em; border: 2px solid #000; margin: 4px 0; }
  .token { text-align: center; font-size: 1.3em; margin: 6px 0; }
  .token b { font-size: 2.4em; display: block; line-height: 1.1; }
  table { width: 100%; border-collapse: collapse; }
  .kv td, .patient td { padding: 2px 0; vertical-align: top; }
  .kv td:first-child, .patient td:first-child { color: #333; width: 40%; }
  .bill { margin-top: 6px; border-top: 1px dashed #000; }
  .bill td { padding: 2px 0; }
  .bill .total td { border-top: 1px solid #000; font-weight: bold; }
  .num { text-align: right; }
  .note { margin-top: 6px; text-align: center; font-style: italic; }
  .muted { color: #555; }
  .op .op-head { display: flex; justify-content: space-between; gap: 8px; margin: 4px 0; }
  .op .patient { border: 1px solid #000; margin: 6px 0; }
  .op .patient td { padding: 3px 6px; border-bottom: 1px solid #ddd; }
  .section { margin-top: 8px; }
  .section-title { font-weight: bold; border-bottom: 1px solid #000; }
  .items { display: flex; flex-wrap: wrap; gap: 14px; margin: 6px 0; }
  .line { border-bottom: 1px dotted #777; height: 22px; }
  .sign { margin-top: 30px; text-align: right; }
  .poster { text-align: center; padding-top: 20mm; }
  .poster-clinic { font-size: 32px; font-weight: bold; }
  .poster-branch { font-size: 22px; margin-top: 4px; }
  .poster-title { font-size: 28px; margin: 18mm 0 8mm; }
  .poster-qr svg { width: 110mm; height: 110mm; }
  .poster-link { font-size: 16px; margin-top: 6mm; word-break: break-all; }
  .poster-lang { font-size: 20px; margin-top: 8mm; }
  .poster-phone { font-size: 16px; margin-top: 6mm; }
`

// Print sheets ([html, copies] pairs) on one paper size. A second print right after the first uses
// its own frame (frameId) so the first one's print preview keeps its page.
export function printSheets(parts, paper = 'A4', title = 'Print', frameId = 'print-frame') {
  const page = PAGE[paper] || PAGE.A4
  const body = parts.flatMap(([html, copies = 1]) => Array.from({ length: copies }, () => html)).join('')
  document.getElementById(frameId)?.remove()
  const frame = Object.assign(document.createElement('iframe'), { id: frameId, title })
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${STYLE(page)}</style></head><body>${body}</body></html>`)
  doc.close()
  setTimeout(() => {
    try {
      frame.contentWindow.focus()
      frame.contentWindow.print()
    } catch { /* printing blocked: the frame still holds the page */ }
  }, 50)
}

// Receipt and/or OP sheet from the print API's answer, each on its clinic's paper size.
export function printBooking(data, kinds) {
  const s = data.settings || {}
  if (kinds.includes('receipt') && kinds.includes('op') && s.receipt_paper !== s.op_paper) {
    // Different paper: receipt first, then the OP sheet in a second print dialog.
    printSheets([[receiptHtml(data), s.receipt_copies]], s.receipt_paper, 'Receipt')
    setTimeout(() => printSheets([[opSheetHtml(data), s.op_copies]], s.op_paper, 'OP sheet', 'print-frame-2'), 1500)
    return
  }
  const parts = []
  if (kinds.includes('receipt')) parts.push([receiptHtml(data), s.receipt_copies])
  if (kinds.includes('op')) parts.push([opSheetHtml(data), s.op_copies])
  printSheets(parts, kinds.includes('receipt') ? s.receipt_paper : s.op_paper, kinds.length > 1 ? 'Receipt and OP sheet' : kinds[0] === 'op' ? 'OP sheet' : 'Receipt')
}
