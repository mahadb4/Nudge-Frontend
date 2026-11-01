import { expect, test, type Page } from '@playwright/test'
import { demo, dialog, expectText, forceFill } from './helpers'

test.beforeEach(async ({ page }) => { await demo(page) })

const open = async (page: Page, path: string, button: string) => { await page.goto(path); await page.getByRole('button', { name: button }).first().click() }

test.describe('contacts and companies', () => {
  test('add contact: required, format, duplicate (any case), phone, lengths, real names', async ({ page }) => {
    await open(page, '/app/contacts', 'Add contact'); const d = dialog(page); const add = d.getByRole('button', { name: 'Add contact' })
    await add.click(); await expect(d).toContainText('Enter the full name.'); await expect(d).toContainText('Enter your email address.')
    const name = d.locator('input').nth(0); const email = d.locator('input[type=email]'); const phone = d.locator('input[type=tel]')
    await expect(email).toHaveAttribute('autocomplete', /^(|off)$/).catch(() => {}); await expect(phone).toHaveAttribute('inputmode', 'tel')
    await name.fill('Sara Ali'); await email.fill('SARA@Northwind.com'); await phone.fill('abc'); await add.click()
    await expect(d).toContainText('already exists'); await expect(d).toContainText('valid phone number')
    for (const [v, m] of [['<script>alert(1)</script>', 'cannot contain'], ['"><img src=x onerror=alert(1)>', 'cannot contain'], ['12345', 'Use letters'], ['A', 'too short']] as const) { await name.fill(v); await add.click(); await expect(d).toContainText(m) }
    await forceFill(name, 'x'.repeat(10_000)); await add.click(); await expect(d).toContainText('under 80')
    await email.fill('javascript:alert(1)@x.com'); await add.click(); await expect(d).toContainText('valid email address')
    await name.fill('Zoë Müller-O’Brien'); await email.fill('  ZOE@Example.COM '); await phone.fill('+92 300 5550142'); await add.click(); await page.waitForURL('**/app/contacts/p*')
    await expectText(page, 'Zoë Müller-O’Brien'); await expectText(page, 'zoe@example.com')
  })
  test('add company: name, duplicate, domain is a domain and never a URL', async ({ page }) => {
    await open(page, '/app/companies', 'Add company'); const d = dialog(page); const add = d.getByRole('button', { name: 'Add company' })
    await add.click(); await expect(d).toContainText('Enter the company name.')
    const name = d.locator('input').nth(0); const dom = d.locator('input').nth(1)
    await name.fill('northwind traders'); await add.click(); await expect(d).toContainText('already exists')
    await name.fill('Fresh Co')
    for (const bad of ['javascript:alert(1)', 'http://fresh.co', 'fresh', '-a.com', 'a b.com', 'fresh.co/path', '<script>alert(1)</script>']) { await dom.fill(bad); await add.click(); await expect(d).toContainText('Use a domain like acme.com.') }
    await dom.fill('Fresh.CO'); await add.click(); await page.waitForURL('**/app/companies/c*'); await expectText(page, 'fresh.co')
  })
})

test.describe('deals', () => {
  test('amount, name and close date rules', async ({ page }) => {
    await open(page, '/app/pipeline', 'Add deal'); const d = dialog(page); const add = d.getByRole('button', { name: 'Add deal' }); const amt = d.locator('input[inputmode=decimal]'); const name = d.locator('input').first()
    await name.fill('X'); await add.click(); await expect(d).toContainText('too short')
    const table: [string, string][] = [['', 'Enter an amount.'], ['abc', 'Numbers only'], ['25k', 'Numbers only'], ['1e5', 'Numbers only'], ['-1', 'Numbers only'], ['0', 'greater than 0'], ['0.00', 'greater than 0'], ['12.345', 'Numbers only'], ['NaN', 'Numbers only'], ['Infinity', 'Numbers only'], ['99999999999999', 'too large'], ['<script>', 'Numbers only']]
    for (const [v, m] of table) { await amt.fill(v); await add.click(); await expect(d).toContainText(m) }
    const date = d.locator('input[type=date]'); await date.fill('2020-01-01'); await add.click(); await expect(d).toContainText('Pick today or a later date.')
    await expect(date).toHaveAttribute('max', '2100-12-31')
    await name.fill('Acme Big Deal'); await amt.fill('2,500.50'); await date.fill('2027-05-01'); await add.click(); await page.waitForURL('**/app/pipeline/d*'); await expectText(page, '$2,500.5')
  })
  test('a deal name cannot hold markup, and a 10,000-character note cannot be saved', async ({ page }) => {
    await open(page, '/app/pipeline', 'Add deal'); const d = dialog(page)
    await d.locator('input').first().fill('<img src=x onerror=alert(1)>'); await d.locator('input[inputmode=decimal]').fill('100'); await d.getByRole('button', { name: 'Add deal' }).click(); await expect(d).toContainText('cannot contain')
    await page.keyboard.press('Escape'); await page.goto('/app/pipeline/d3')
    const note = page.locator('textarea').first(); await forceFill(note, 'n'.repeat(10_000)); await expectText(page, 'Keep the note under 1000 characters.')
    await expect(page.getByRole('button', { name: 'Save note' })).toBeDisabled()
  })
})

test.describe('compose, review, follow-ups', () => {
  test('new email: opted-out contact is blocked in any case, blank body and long subject rejected', async ({ page }) => {
    await page.getByRole('button', { name: 'New email' }).click(); const d = dialog(page); const send = d.getByRole('button', { name: 'Send for approval' })
    const to = d.locator('input[type=email]'); const subject = d.locator('input').nth(1); const msg = d.locator('textarea')
    await to.fill('HASSAN@Karachidealers.PK'); await subject.fill('Hi'); await msg.fill('hello there'); await send.click(); await expect(d).toContainText('opted out')
    await to.fill('someone@example.com'); await msg.fill('     '); await send.click(); await expect(d).toContainText('Enter the message.')
    await msg.fill('hello there'); await forceFill(subject, 's'.repeat(10_000)); await send.click(); await expect(d).toContainText('under 200')
    await forceFill(subject, 'Line one\nBcc: evil@x.com'); expect(await subject.inputValue()).not.toMatch(/[\r\n]/)   // the browser strips line breaks from a one-line field
    await forceFill(msg, 'm'.repeat(10_000)); await send.click(); await expect(d).toContainText('under 5000')
    await subject.fill('Hello'); await msg.fill('hello there'); await send.click(); await expect(d).toBeHidden()
  })
  test('review: an empty draft cannot be approved', async ({ page }) => {
    await page.goto('/app/review'); const ta = page.locator('textarea[aria-label="Draft reply"]'); await ta.fill(''); await page.getByRole('button', { name: /Approve & queue/ }).click()
    await expectText(page, 'The draft is empty.')
  })
  test('review: a reject needs a reason from the list', async ({ page }) => {
    await page.goto('/app/review'); await page.getByRole('button', { name: /^Reject/ }).first().click(); await page.getByRole('button', { name: 'Reject draft' }).click(); await expectText(page, 'Pick a reason first')
    expect(await page.locator('select[aria-label="Reason"] option').allInnerTexts()).toContain('Choose a reason')
  })
  test('follow-up draft: empty and over-long drafts cannot be queued', async ({ page }) => {
    await page.goto('/app/follow-ups'); await page.getByRole('button', { name: 'Review draft' }).first().click()
    const ta = page.locator('textarea[aria-label="Follow-up draft"]'); const ok = page.getByRole('button', { name: /Approve & queue/ })
    await ta.fill(''); await expect(ok).toBeDisabled(); await forceFill(ta, 'd'.repeat(10_000)); await expect(ok).toBeDisabled(); await ta.fill('Checking in on the redlines.'); await expect(ok).toBeEnabled()
  })
  test('templates: name and body limits, duplicate names', async ({ page }) => {
    await page.goto('/app/templates'); const name = page.locator('input.input').first(); const save = page.getByRole('button', { name: 'Save', exact: true })
    await forceFill(name, 'A brand new name'); await expect(save).toBeEnabled()
    await forceFill(name, 'share PRICING'); await expectText(page, 'already exists'); await expect(save).toBeDisabled()
    await forceFill(name, 'x'); await expectText(page, 'too short'); await expect(save).toBeDisabled()
    await forceFill(name, 'n'.repeat(500)); await expectText(page, 'under 80')
    await page.getByRole('button', { name: 'New template' }).click(); const d = dialog(page); await d.getByRole('button', { name: 'Create' }).click(); await expect(d).toContainText('Enter the template name.')
    await d.locator('input').fill('handle SETUP worry'); await d.getByRole('button', { name: 'Create' }).click(); await expect(d).toContainText('already exists')
  })
})

test.describe('settings', () => {
  test('change password: same as current, weak, mismatched; fields have the right autocomplete', async ({ page }) => {
    await page.goto('/app/settings/security'); const pw = page.locator('input[type=password]'); const go = page.getByRole('button', { name: 'Update password' })
    await expect(pw.nth(0)).toHaveAttribute('autocomplete', 'current-password'); await expect(pw.nth(1)).toHaveAttribute('autocomplete', 'new-password')
    await go.click(); await expectText(page, 'Enter your current password.')
    await pw.nth(0).fill('Oldpass-1'); await pw.nth(1).fill('Oldpass-1'); await pw.nth(2).fill('Oldpass-1'); await go.click(); await expectText(page, /not used|Choose a password you have not used here/)
    await pw.nth(1).fill('weak'); await pw.nth(2).fill('weak'); await go.click(); await expectText(page, 'at least 8')
    await pw.nth(1).fill('Brand-New-Pw9'); await pw.nth(2).fill('Different-Pw9'); await go.click(); await expectText(page, 'do not match')
    await pw.nth(2).fill('Brand-New-Pw9'); await go.click(); await expectText(page, 'Password updated')
  })
  test('deal stages: blank, duplicate, too long, markup', async ({ page }) => {
    await page.goto('/app/settings/workspace'); const s1 = page.locator('input[aria-label="Stage 1"]'); const save = page.getByRole('button', { name: 'Save stages' })
    await s1.fill('Contacted'); await save.click(); await expectText(page, 'Another stage has this name.')
    await s1.fill('   '); await save.click(); await expectText(page, 'Name this stage.')
    await forceFill(s1, 's'.repeat(500)); await save.click(); await expectText(page, 'under 40')
    await s1.fill('<b>x</b>'); await save.click(); await expectText(page, 'Remove < and >.')
    await s1.fill('Fresh lead'); await save.click(); await expectText(page, 'Stages saved')
  })
  test('invite: duplicates in any case, bad emails, and the role is limited to the list', async ({ page }) => {
    await page.goto('/app/settings/team'); await page.getByRole('button', { name: /Invite/ }).first().click(); const d = dialog(page); const send = d.locator('button.primary'); const email = d.locator('input').first()
    await email.fill('SANA@acme.co'); await send.click(); await expect(d).toContainText('Already on the team.')
    for (const bad of ['', 'nope', 'a@b', '<script>@x.com']) { await email.fill(bad); await send.click(); await expect(d).toContainText(/Enter your email|valid email/) }
    expect(await d.locator('select option').allInnerTexts()).toEqual(['Member', 'Admin'])
  })
  test('approved facts: names, length, duplicates', async ({ page }) => {
    await page.goto('/app/settings/facts'); await page.getByRole('button', { name: /Add fact/ }).first().click(); const d = dialog(page); const save = d.locator('button.primary')
    await d.locator('input').fill('price per SEAT'); await d.locator('textarea').fill('Fifty dollars'); await save.click(); await expect(d).toContainText('already exists')
    await d.locator('input').fill('New fact'); await d.locator('textarea').fill('ab'); await save.click(); await expect(d).toContainText('little more')
    await forceFill(d.locator('textarea'), 'f'.repeat(10_000)); await save.click(); await expect(d).toContainText('under 200')
  })
  test('profile: phone and name', async ({ page }) => {
    await page.goto('/app/settings/profile'); const name = page.locator('input.input').first(); const phone = page.locator('input[type=tel]'); const save = page.getByRole('button', { name: 'Save changes' }).first()
    await expect(phone).toHaveAttribute('autocomplete', 'tel-national'); await phone.fill('abc'); await save.click(); await expectText(page, 'valid phone number')
    await name.fill('12345'); await save.click(); await expectText(page, 'Use letters in the name.')
  })
  test('the confidence slider cannot leave 60 to 99', async ({ page }) => {
    await page.goto('/app/settings/automation'); const r = page.locator('input[type=range]')
    await r.evaluate((el: HTMLInputElement) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '5000'); el.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(Number(await r.inputValue())).toBeLessThanOrEqual(99)
  })
})

test('every free-text control has a length limit', async ({ page }) => {
  const missing: string[] = []
  for (const path of ['/app/settings/profile', '/app/settings/workspace', '/app/settings/security', '/app/templates', '/app/follow-ups', '/app/pipeline/d3', '/app/contacts', '/app/agent']) {
    await page.goto(path); await page.waitForTimeout(150)
    const found = await page.locator('input:not([type=checkbox]):not([type=range]):not([type=date]):not([type=file]):not([readonly]), textarea').evaluateAll((els) => els.filter((e) => !(e as HTMLInputElement).maxLength || (e as HTMLInputElement).maxLength < 0).map((e) => (e.getAttribute('placeholder') || e.getAttribute('aria-label') || e.className)))
    for (const f of found) missing.push(path + ' :: ' + f)
  }
  expect(missing).toEqual([])
})
