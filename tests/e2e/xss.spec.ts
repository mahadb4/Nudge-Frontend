import { expect, test, type Page } from '@playwright/test'
import { LIVE_PAYLOAD, PAYLOADS, demo, dialog, expectText, forceFill, watch } from './helpers'

/** After any hostile text has been typed, saved or shown, nothing may have run and nothing may have become markup. */
async function expectInert(page: Page, w: Awaited<ReturnType<typeof watch>>) {
  expect(await w.xssFlag()).toBeUndefined()
  expect(w.seen.dialogs).toEqual([])
  expect(await page.locator('img[src="x"], img[onerror], [onerror], [onload]').count()).toBe(0)
  expect(await page.locator('#root script, #root iframe, #root object, #root embed').count()).toBe(0)
  const bad = await page.locator('a[href], [src], form[action]').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? e.getAttribute('src') ?? e.getAttribute('action') ?? '').filter((u) => /^\s*(javascript|data|vbscript):/i.test(u)))
  expect(bad).toEqual([])
}

const ALL = [LIVE_PAYLOAD, ...PAYLOADS]

test.describe('free text is shown as text and never as markup', () => {
  for (const payload of ALL) {
    test(`deal note: ${payload.slice(0, 30)}`, async ({ page }) => {
      const w = await watch(page); await demo(page); await page.goto('/app/pipeline/d3')
      const note = page.locator('textarea').first(); await note.fill(payload); await page.getByRole('button', { name: 'Save note' }).click(); await expectText(page, 'Note saved')
      await expect(note).toHaveValue(payload); await expectInert(page, w)
    })
    test(`reject note -> audit log: ${payload.slice(0, 30)}`, async ({ page }) => {
      const w = await watch(page); await demo(page); await page.goto('/app/review')
      await page.getByRole('button', { name: /^Reject/ }).first().click(); await page.locator('select[aria-label="Reason"]').selectOption({ index: 1 })
      await page.getByPlaceholder('Add a note (optional)').fill(payload); await page.getByRole('button', { name: 'Reject draft' }).click(); await expectText(page, 'Draft rejected')
      await page.getByRole('link', { name: 'Settings' }).click(); await page.getByRole('link', { name: 'Audit log' }).click()
      await expectText(page, 'Rejected draft'); await expectInert(page, w)
    })
    test(`new email subject and body -> toast and audit: ${payload.slice(0, 30)}`, async ({ page }) => {
      const w = await watch(page); await demo(page); await page.getByRole('button', { name: 'New email' }).click(); const d = dialog(page)
      await d.locator('input[type=email]').fill('someone@example.com'); await d.locator('input').nth(1).fill(payload); await d.locator('textarea').fill(payload + ' hello')
      await d.getByRole('button', { name: 'Send for approval' }).click(); await expectText(page, 'Email queued'); await expectInert(page, w)
      await page.getByRole('link', { name: 'Settings' }).click(); await page.getByRole('link', { name: 'Audit log' }).click(); await expectInert(page, w)
    })
    test(`agent chat echo: ${payload.slice(0, 30)}`, async ({ page }) => {
      const w = await watch(page); await demo(page); await page.goto('/app/agent')
      await page.getByPlaceholder('Ask anything about your replies or deals').fill(payload); await page.keyboard.press('Enter'); await page.waitForTimeout(900); await expectInert(page, w)
    })
    test(`command palette and search echo: ${payload.slice(0, 30)}`, async ({ page }) => {
      const w = await watch(page); await demo(page); await page.getByText('Search people, deals, emails').first().click(); await page.getByPlaceholder(/Search people, deals, pages/).fill(payload); await page.waitForTimeout(300); await expectInert(page, w)
      await page.keyboard.press('Escape'); await page.goto('/app/contacts'); await page.getByLabel('Search contacts').fill(payload); await page.waitForTimeout(200); await expectInert(page, w)
    })
    test(`contact title and company industry are text: ${payload.slice(0, 30)}`, async ({ page }) => {
      const w = await watch(page); await demo(page)
      await page.goto('/app/contacts'); await page.getByRole('button', { name: 'Add contact' }).first().click(); let d = dialog(page)
      await d.locator('input').nth(0).fill('Zed Example'); await d.locator('input[type=email]').fill('zed@example.com'); await d.locator('input').nth(2).fill(payload); await d.getByRole('button', { name: 'Add contact' }).click()
      await page.waitForURL('**/app/contacts/p*'); await expectInert(page, w)
      await page.getByRole('link', { name: 'Companies' }).first().click(); await page.getByRole('button', { name: 'Add company' }).first().click(); d = dialog(page)
      await d.locator('input').nth(0).fill('Zed Co'); await d.locator('input').nth(2).fill(payload.slice(0, 40)); await d.getByRole('button', { name: 'Add company' }).click(); await page.waitForURL('**/app/companies/c*'); await expectInert(page, w)
    })
    test(`template body and approved fact: ${payload.slice(0, 30)}`, async ({ page }) => {
      const w = await watch(page); await demo(page); await page.goto('/app/templates'); await page.locator('textarea').fill(payload + ' hello there'); await expectInert(page, w)
      await page.getByRole('link', { name: 'Settings' }).click(); await page.getByRole('link', { name: 'Approved facts' }).click(); await page.getByRole('button', { name: /Add fact/ }).first().click(); const d = dialog(page)
      await d.locator('input').fill('Hostile fact'); await d.locator('textarea').fill(payload.slice(0, 190) + ' ok'); await d.locator('button.primary').click(); await expectText(page, 'Fact saved'); await expectInert(page, w)
      await page.getByRole('link', { name: 'Templates' }).click(); await expectInert(page, w)
    })
    test(`follow-up draft and review draft: ${payload.slice(0, 30)}`, async ({ page }) => {
      const w = await watch(page); await demo(page); await page.goto('/app/follow-ups'); await page.getByRole('button', { name: 'Review draft' }).first().click()
      await page.locator('textarea[aria-label="Follow-up draft"]').fill(payload + ' checking in'); await expectInert(page, w)
      await page.goto('/app/review'); await page.locator('textarea[aria-label="Draft reply"]').fill(payload + ' thanks'); await expectInert(page, w)
    })
  }
})

test.describe('markup is refused where a name is expected', () => {
  for (const payload of ALL.filter((p) => /[<>]/.test(p))) test(`names reject ${payload.slice(0, 26)}`, async ({ page }) => {
    await demo(page)
    await page.goto('/app/contacts'); await page.getByRole('button', { name: 'Add contact' }).first().click(); let d = dialog(page); await d.locator('input').nth(0).fill(payload); await d.locator('input[type=email]').fill('q@example.com'); await d.getByRole('button', { name: 'Add contact' }).click(); await expect(d).toContainText('cannot contain')
    await page.keyboard.press('Escape'); await page.goto('/app/companies'); await page.getByRole('button', { name: 'Add company' }).first().click(); d = dialog(page); await d.locator('input').nth(0).fill(payload); await d.getByRole('button', { name: 'Add company' }).click(); await expect(d).toContainText('cannot contain')
    await page.keyboard.press('Escape'); await page.goto('/app/pipeline'); await page.getByRole('button', { name: 'Add deal' }).first().click(); d = dialog(page); await d.locator('input').first().fill(payload); await d.locator('input[inputmode=decimal]').fill('5'); await d.getByRole('button', { name: 'Add deal' }).click(); await expect(d).toContainText('cannot contain')
  })
  test('javascript: and data: are not accepted as an email, a domain or a phone number', async ({ page }) => {
    await demo(page); await page.goto('/app/companies'); await page.getByRole('button', { name: 'Add company' }).first().click(); const d = dialog(page)
    await d.locator('input').nth(0).fill('Hostile Co')
    for (const v of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'JaVaScRiPt:alert(1)']) { await d.locator('input').nth(1).fill(v); await d.getByRole('button', { name: 'Add company' }).click(); await expect(d).toContainText('Use a domain like acme.com.') }
  })
})

test('the evidence highlight is a text node: email text cannot add markup or move the highlight', async ({ page }) => {
  const w = await watch(page); await demo(page); await page.goto('/app/review')
  const mark = page.locator('mark.ev'); await expect(mark).toHaveCount(1)
  expect(await mark.evaluate((el) => Array.from(el.childNodes).every((n) => n.nodeType === Node.TEXT_NODE))).toBe(true)
  expect(await page.locator('.mail-text *').evaluateAll((els) => els.map((e) => e.tagName).filter((t) => !['P', 'MARK', 'SUP'].includes(t)))).toEqual([])
  await expectInert(page, w)
})

test('links: none run script, and any link that opens a new tab is noopener noreferrer', async ({ page }) => {
  await demo(page)
  for (const p of ['/app/home', '/app/inbox', '/app/pipeline', '/app/contacts/p1', '/app/companies/c1', '/app/settings/integrations', '/app/settings/mailboxes', '/app/reports']) {
    await page.goto(p); await page.waitForTimeout(120)
    const links = await page.locator('a').evaluateAll((as) => as.map((a) => ({ href: a.getAttribute('href') ?? '', target: a.getAttribute('target'), rel: a.getAttribute('rel') ?? '' })))
    for (const l of links) { expect(l.href).not.toMatch(/^\s*(javascript|data|vbscript):/i); if (l.target === '_blank') expect(l.rel).toMatch(/noopener/), expect(l.rel).toMatch(/noreferrer/) }
  }
})

test('a forced huge, odd value cannot break a page', async ({ page }) => {
  await demo(page); await page.goto('/app/pipeline/d3'); const note = page.locator('textarea').first()
  for (const v of ['\u0000\u0007', '‮evil', '😀'.repeat(2000), 'ا'.repeat(2000), '​'.repeat(5000), "'; DROP TABLE deals;--"]) { await forceFill(note, v); await expect(page.locator('#root')).not.toBeEmpty() }
})
