// Browser tests: clicks through the real admin UI and the public form,
// the same way a person would.
import { expect, test } from '@playwright/test'
import { linkName, unique } from '../helpers.js'

const toast = (page, text) => page.locator('.p-toast-message').filter({ hasText: text })

async function addField(page, typeName, label, { mandatory = false } = {}) {
  await page.getByRole('button', { name: 'Add field' }).click()
  await page.getByRole('menuitem', { name: typeName, exact: true }).click()
  const labelInput = page.getByLabel('Label')
  await labelInput.fill(label)
  if (mandatory) await page.getByRole('switch', { name: 'Mandatory' }).click()
  await expect(page.locator('.field-item.selected .label')).toContainText(label)
}

test('admin builds and publishes a form, a patient submits it, admin sees the response', async ({ page }) => {
  const tenantName = unique('E2E Clinic')
  const tenantCode = linkName(tenantName)
  const formName = 'Appointment Booking'
  const formSlug = 'appointment-booking'

  // ---- Create a tenant ----
  await page.goto('/tenants')
  await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible()
  await page.getByRole('button', { name: 'New tenant' }).click()
  await page.getByLabel('Clinic business name').fill(tenantName)
  await expect(page.getByLabel('Code')).toHaveValue(tenantCode)
  await page.getByRole('button', { name: 'Create tenant' }).click()
  await expect(page).toHaveURL(new RegExp(`/tenants/${tenantCode}/forms$`))

  // ---- Create a form: the link name is filled in from the form name ----
  await page.getByRole('button', { name: 'New form' }).click()
  await page.getByLabel('Form name').fill(formName)
  await expect(page.getByLabel('Link name')).toHaveValue(formSlug)
  await page.getByRole('button', { name: 'Create and open builder' }).click()
  await expect(page).toHaveURL(new RegExp(`/tenants/${tenantCode}/forms/${formSlug}$`))
  await expect(page.locator('.p-tag')).toHaveText('Draft')

  // ---- Add fields ----
  await addField(page, 'Short text', 'Patient Name', { mandatory: true })
  await addField(page, 'Phone number', 'Phone', { mandatory: true })
  await addField(page, 'Date', 'Visit Date', { mandatory: true })
  await addField(page, 'Dropdown', 'Gender')

  // Dropdown options; Enter adds a new option and moves the cursor into it.
  await page.getByRole('textbox', { name: 'Option 1' }).fill('Male')
  await page.getByRole('textbox', { name: 'Option 2' }).fill('Female')
  await page.getByRole('textbox', { name: 'Option 2' }).press('Enter')
  await page.keyboard.type('Other')
  await expect(page.getByRole('textbox', { name: 'Option 2' })).toHaveValue('Female')
  await expect(page.getByRole('textbox', { name: 'Option 3' })).toHaveValue('Other')

  // An unsaved draft still says Draft.
  await expect(page.locator('.p-tag')).toHaveText('Draft')

  // ---- Preview checks mandatory fields ----
  await page.getByRole('button', { name: 'Preview' }).click()
  const preview = page.getByRole('dialog')
  await preview.getByRole('button', { name: 'Submit' }).click()
  await expect(preview.getByText('This field is required.')).toHaveCount(3)
  await page.keyboard.press('Escape')
  await expect(preview).toBeHidden()

  // ---- Save and publish ----
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(toast(page, 'Saved')).toBeVisible()

  await page.getByRole('button', { name: 'Publish', exact: true }).click()
  const confirmDialog = page.locator('.p-confirmdialog')
  await expect(confirmDialog).toContainText('Publish this form?')
  await confirmDialog.getByRole('button', { name: 'Publish' }).click()
  await expect(toast(page, 'Published')).toBeVisible()
  await expect(page.locator('.p-tag')).toHaveText('Published')
  await expect(page.locator('.field-item .pi-lock')).toHaveCount(4)

  // ---- The share panel shows a readable public link ----
  const publicPath = `/f/${tenantCode}/${formSlug}`
  await expect(page.getByLabel('Public link')).toHaveValue(new RegExp(`${publicPath}$`))

  // ---- A patient opens the public link ----
  await page.goto(publicPath)
  await expect(page.getByRole('heading', { name: formName })).toBeVisible()
  await expect(page.getByText(tenantName)).toBeVisible()
  await expect(page.locator('.app-header')).toHaveCount(0) // no admin header on the public page

  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByText('This field is required.')).toHaveCount(3)

  await page.getByLabel('Patient Name').fill('E2E Patient')
  await page.getByLabel('Phone').fill('+91 98765 43210')
  await page.getByLabel('Visit Date').fill('15/10/2026')
  await page.keyboard.press('Escape')
  // PrimeVue's Select is not a native input, so open it through its field container.
  await page.locator('.field').filter({ hasText: 'Gender' }).locator('.p-select').click()
  await page.getByRole('option', { name: 'Female' }).click()
  await page.getByRole('button', { name: 'Submit' }).click()
  await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible()

  // ---- The admin sees the response ----
  await page.goto(`/tenants/${tenantCode}/forms/${formSlug}/submissions`)
  await expect(page.getByRole('heading', { name: 'Submissions' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'E2E Patient' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Female' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '15 Oct 2026' })).toBeVisible()
  await expect(page.locator(`a[href$="/v1/tenants/${tenantCode}/forms/${formSlug}/submissions.csv"]`)).toBeVisible()

  // ---- Closing the form shows patients a closed message ----
  await page.goto(`/tenants/${tenantCode}/forms/${formSlug}`)
  await page.getByRole('switch', { name: 'Accepting responses' }).click()
  await expect(toast(page, 'closed to new responses')).toBeVisible()
  await page.goto(publicPath)
  await expect(page.getByText('not accepting responses')).toBeVisible()
})

test('an unknown public link shows a friendly message', async ({ page }) => {
  await page.goto('/f/no-such-clinic/no-such-form')
  await expect(page.getByRole('heading', { name: 'Form not available' })).toBeVisible()
})

test('admin URLs use names, and an unknown form shows an error', async ({ page }) => {
  await page.goto('/tenants/no-such-clinic/forms/no-such-form')
  await expect(page.getByText('not found')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
})
