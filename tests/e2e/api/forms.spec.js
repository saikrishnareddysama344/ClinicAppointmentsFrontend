// API tests: every backend endpoint, without a browser.
import { expect, test } from '@playwright/test'
import {
  asPayload, BOOKING_FIELDS, createForm, createTenant, formUrl, linkName, ok, publish, saveFields, unique
} from '../helpers.js'

test.describe('health and meta', () => {
  test('API and database are up', async ({ request }) => {
    const body = await ok(await request.get('/v1/health'), 200)
    expect(body.database).toBe('ok')
  })

  test('builder rules come from the backend', async ({ request }) => {
    const { builder } = await ok(await request.get('/v1/meta/builder'), 200)
    expect(builder.reserved_columns).toContain('id')
    expect(builder.length_types).toContain('string')
    expect(builder.static_source).toBe('static')
    expect(builder.limits.max_form_fields).toBeGreaterThan(0)
  })

  test('field types are seeded', async ({ request }) => {
    const body = await ok(await request.get('/v1/getDataTypes'), 200)
    const keys = body.data_types.map((t) => t.type_key)
    for (const key of ['string', 'text', 'number', 'integer', 'date', 'time', 'boolean', 'dropdown', 'email', 'phone']) {
      expect(keys).toContain(key)
    }
  })
})

test.describe('tenants and forms use names in URLs', () => {
  test('tenant code and form slug are made from names', async ({ request }) => {
    const name = unique('Sharma Dental')
    const tenant = await createTenant(request, name)
    expect(tenant.code).toBe(linkName(name))
    expect(tenant.schema_name).toMatch(/^e2e_t_\d+$/)

    const got = await ok(await request.get(`/v1/tenants/${tenant.code}`), 200)
    expect(got.tenant.name).toBe(name)

    const form = await createForm(request, tenant.code, 'Appointment Booking')
    expect(form.slug).toBe('appointment-booking')
    const second = await createForm(request, tenant.code, 'Appointment-Booking')
    expect(second.slug).toBe('appointment-booking-2')

    const list = await ok(await request.get(`/v1/tenants/${tenant.code}/forms`), 200)
    expect(list.forms.map((f) => f.slug).sort()).toEqual(['appointment-booking', 'appointment-booking-2'])
  })

  test('bad and duplicate names are rejected', async ({ request }) => {
    const tenant = await createTenant(request, unique('Dup Clinic'))
    expect((await request.post('/v1/tenants', { data: { name: tenant.name } })).status()).toBe(409)
    expect((await request.post('/v1/tenants', { data: { name: 'x' } })).status()).toBe(400)

    await createForm(request, tenant.code, 'Walk In')
    expect((await request.post(`/v1/tenants/${tenant.code}/forms`, { data: { display_name: 'walk in' } })).status()).toBe(409)
    expect((await request.post(`/v1/tenants/${tenant.code}/forms`,
      { data: { display_name: 'Another', slug: 'walk-in' } })).status()).toBe(409)
    expect((await request.post(`/v1/tenants/${tenant.code}/forms`,
      { data: { display_name: 'Bad', slug: 'Bad Slug!' } })).status()).toBe(400)
  })

  test('unknown tenant or form gives a JSON 404', async ({ request }) => {
    const r1 = await request.get('/v1/tenants/no-such-clinic/forms')
    expect(r1.status()).toBe(404)
    expect((await r1.json()).status).toBe(false)
    const tenant = await createTenant(request, unique('Empty Clinic'))
    expect((await request.get(formUrl(tenant.code, 'nope'))).status()).toBe(404)
  })
})

test.describe('form builder', () => {
  test('saves fields and rejects invalid ones without changing anything', async ({ request }) => {
    const tenant = await createTenant(request, unique('Builder Clinic'))
    const form = await createForm(request, tenant.code, 'Intake')
    const saved = await saveFields(request, tenant.code, form.slug, BOOKING_FIELDS)
    expect(saved.fields).toHaveLength(BOOKING_FIELDS.length)
    expect(saved.fields.every((f) => f.column_name === null)).toBe(true)

    const bad = [
      { display_label: 'Status', data_type: 'string' }, // reserved
      { display_label: 'Name', data_type: 'string' },
      { display_label: 'name', data_type: 'string' }, // duplicate column
      { display_label: '', data_type: 'nope' },
      { display_label: 'G', data_type: 'dropdown', options_config: { options: [] } }
    ]
    const res = await request.put(formUrl(tenant.code, form.slug), { data: { fields: bad } })
    expect(res.status()).toBe(400)
    expect(Object.keys((await res.json()).field_errors).sort()).toEqual(['0', '1', '2', '3', '4'])

    const after = await ok(await request.get(formUrl(tenant.code, form.slug)), 200)
    expect(after.form.fields).toHaveLength(BOOKING_FIELDS.length)
  })

  test('publish, edit after publish, and republish every field type', async ({ request }) => {
    const tenant = await createTenant(request, unique('Publish Clinic'))
    const form = await createForm(request, tenant.code, 'Booking')
    await saveFields(request, tenant.code, form.slug, [{ display_label: 'Name', data_type: 'string' }])

    const first = await publish(request, tenant.code, form.slug)
    expect(first.table_name).toBe(`booking_${form.id}`)
    expect(first.added_columns).toEqual(['name'])

    const current = (await ok(await request.get(formUrl(tenant.code, form.slug)), 200)).form
    expect(current.status).toBe('published')

    // Regression: adding non-text types after publishing used to crash.
    const extra = ['text', 'date', 'time', 'boolean', 'integer', 'number', 'email', 'phone']
      .map((t) => ({ display_label: `New ${t}`, data_type: t }))
    extra.push({ display_label: 'New dropdown', data_type: 'dropdown', options_config: { options: ['A'] } })
    const edited = await saveFields(request, tenant.code, form.slug, [...asPayload(current.fields), ...extra])
    expect(edited.status).toBe('changes_pending')

    const second = await publish(request, tenant.code, form.slug)
    expect(second.added_columns).toHaveLength(9)
    const again = await publish(request, tenant.code, form.slug)
    expect(again.added_columns).toEqual([])
  })

  test('published fields are locked and published forms cannot be deleted', async ({ request }) => {
    const tenant = await createTenant(request, unique('Lock Clinic'))
    const form = await createForm(request, tenant.code, 'Locked')
    await saveFields(request, tenant.code, form.slug, [
      { display_label: 'Name', data_type: 'string' }, { display_label: 'Age', data_type: 'integer' }])
    await publish(request, tenant.code, form.slug)
    const fields = asPayload((await ok(await request.get(formUrl(tenant.code, form.slug)), 200)).form.fields)

    const typeChange = fields.map((f, i) => (i === 0 ? { ...f, data_type: 'text' } : f))
    expect((await request.put(formUrl(tenant.code, form.slug), { data: { fields: typeChange } })).status()).toBe(400)
    expect((await request.put(formUrl(tenant.code, form.slug), { data: { fields: fields.slice(1) } })).status()).toBe(400)
    expect((await request.delete(formUrl(tenant.code, form.slug))).status()).toBe(400)

    const draft = await createForm(request, tenant.code, 'Draft To Delete')
    await ok(await request.delete(formUrl(tenant.code, draft.slug)), 200)
  })
})

test.describe('public form and submissions', () => {
  let tenant
  let form
  let ids
  let publicUrl

  test.beforeAll(async ({ request }) => {
    tenant = await createTenant(request, unique('Public Clinic'))
    form = await createForm(request, tenant.code, 'Appointment Booking')
    await saveFields(request, tenant.code, form.slug, BOOKING_FIELDS)
    publicUrl = `/v1/public/${tenant.code}/${form.slug}`
    expect((await request.get(publicUrl)).status()).toBe(404) // not published yet
    await publish(request, tenant.code, form.slug)
    const pub = (await ok(await request.get(publicUrl), 200)).form
    ids = Object.fromEntries(pub.fields.map((f) => [f.display_label, String(f.id)]))
  })

  const goodAnswers = () => ({
    [ids['Patient Name']]: 'Ravi Kumar',
    [ids.Phone]: '+91 98765 43210',
    [ids.Email]: 'ravi@example.com',
    [ids['Visit Date']]: '2026-10-15',
    [ids['Visit Time']]: '10:30',
    [ids.Gender]: 'Male',
    [ids.Age]: 34,
    [ids.Weight]: '72.5',
    [ids.Consent]: true,
    [ids.Notes]: '=HYPERLINK("http://evil")'
  })

  test('public form shows only what patients need', async ({ request }) => {
    const pub = (await ok(await request.get(publicUrl), 200)).form
    expect(pub.tenant_name).toBe(tenant.name)
    expect(pub.accepting_submissions).toBe(true)
    expect(Object.keys(ids)).not.toContain('Doctor') // linked dropdowns come later
    for (const f of pub.fields) expect(f).not.toHaveProperty('column_name')
  })

  test('valid answers are stored and listed', async ({ request }) => {
    const body = await ok(await request.post(`${publicUrl}/submissions`, { data: { values: goodAnswers() } }), 201)
    expect(body.submission_id).toBeTruthy()

    const list = await ok(await request.get(`${formUrl(tenant.code, form.slug)}/submissions`), 200)
    const row = list.rows.find((r) => r.id === body.submission_id)
    expect(row.patient_name).toBe('Ravi Kumar')
    expect(row.visit_date).toBe('2026-10-15')
    expect(row.visit_time.startsWith('10:30')).toBe(true)
    expect(row.consent).toBe(true)
    expect(list.columns.map((c) => c.label)).toContain('Visit Date')
  })

  test('every kind of wrong answer is rejected with a message per field', async ({ request }) => {
    const bad = {
      [ids['Patient Name']]: 'x'.repeat(51),
      [ids.Phone]: 'abc',
      [ids.Email]: 'not-an-email',
      [ids['Visit Date']]: '15/10/2026',
      [ids['Visit Time']]: '25:99',
      [ids.Gender]: 'Robot',
      [ids.Age]: '3.5',
      [ids.Weight]: 'heavy',
      [ids.Consent]: false
    }
    const res = await request.post(`${publicUrl}/submissions`, { data: { values: bad } })
    expect(res.status()).toBe(400)
    expect(Object.keys((await res.json()).field_errors).sort()).toEqual(Object.keys(bad).sort())

    const empty = await request.post(`${publicUrl}/submissions`, { data: { values: {} } })
    const missing = Object.keys((await empty.json()).field_errors).sort()
    expect(missing).toEqual([ids['Patient Name'], ids.Phone, ids['Visit Date'], ids.Consent].sort())

    expect((await request.post(`${publicUrl}/submissions`, { data: { values: { 999999: 'x' } } })).status()).toBe(400)
  })

  test('spam trap: bot submissions look successful but are not stored', async ({ request }) => {
    const before = (await ok(await request.get(`${formUrl(tenant.code, form.slug)}/submissions`), 200)).total
    const res = await request.post(`${publicUrl}/submissions`, { data: { values: goodAnswers(), website: 'spam.example' } })
    expect(res.status()).toBe(201)
    expect(await res.json()).not.toHaveProperty('submission_id')
    const after = (await ok(await request.get(`${formUrl(tenant.code, form.slug)}/submissions`), 200)).total
    expect(after).toBe(before)
  })

  test('CSV export has labels and neutralises spreadsheet formulas', async ({ request }) => {
    const res = await request.get(`${formUrl(tenant.code, form.slug)}/submissions.csv`)
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/csv')
    const csv = await res.text()
    expect(csv).toContain('Patient Name')
    expect(csv).toContain('Ravi Kumar')
    expect(csv).toContain("'=HYPERLINK")
  })

  test('closing the form blocks new responses; reopening allows them', async ({ request }) => {
    const shareUrl = `${formUrl(tenant.code, form.slug)}/share`
    await ok(await request.put(shareUrl, { data: { accepting_submissions: false } }), 200)
    expect((await ok(await request.get(publicUrl), 200)).form.accepting_submissions).toBe(false)
    expect((await request.post(`${publicUrl}/submissions`, { data: { values: goodAnswers() } })).status()).toBe(403)

    await ok(await request.put(shareUrl, { data: { accepting_submissions: true } }), 200)
    await ok(await request.post(`${publicUrl}/submissions`, { data: { values: goodAnswers() } }), 201)
  })

  test('renaming a form keeps its links working', async ({ request }) => {
    const current = (await ok(await request.get(formUrl(tenant.code, form.slug)), 200)).form
    const renamed = await saveFields(request, tenant.code, form.slug, asPayload(current.fields),
      { display_name: 'Booking (renamed)' })
    expect(renamed.display_name).toBe('Booking (renamed)')
    expect(renamed.slug).toBe(form.slug)
    await ok(await request.get(publicUrl), 200)
  })
})
