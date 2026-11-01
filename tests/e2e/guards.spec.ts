import { expect, test } from '@playwright/test'
import { demo, expectNoText, expectText } from './helpers'

const PRIVATE = ['/app/home', '/app/review', '/app/inbox', '/app/follow-ups', '/app/calendar', '/app/agent', '/app/pipeline', '/app/pipeline/d3', '/app/contacts', '/app/contacts/p1', '/app/companies', '/app/companies/c1', '/app/templates', '/app/reports', '/app/settings/profile', '/app/settings/audit', '/onboarding/1', '/onboarding/3']

test.describe('route guards', () => {
  for (const path of PRIVATE) test(`signed out: ${path} -> sign-in, nothing private shown`, async ({ page }) => {
    await page.goto(path); await page.waitForURL('**/sign-in')
    for (const t of ['Waiting for you', '$686,000', 'Halden', 'Kestrel', 'Orbit Logistics']) await expectNoText(page, t)
  })

  test('sign out wipes memory and the back button shows nothing private', async ({ page }) => {
    await demo(page); await expectText(page, 'Waiting for you')
    // a full reload loses the in-memory workspace, so the app asks the API again and the demo flag restores it
    await page.goto('/app/home'); await page.waitForURL('**/app/home'); await expectText(page, 'Waiting for you')
    await page.getByRole('button', { name: 'Account' }).click()
    await page.getByRole('button', { name: 'Sign out' }).click(); await page.waitForURL('**/sign-in')
    // Back never reveals a private page: it lands on a public page, and going forward again is bounced to sign-in.
    await page.goBack(); await page.waitForTimeout(500)
    expect(page.url()).not.toMatch(/\/app\//)
    for (const t of ['Waiting for you', '$686,000', 'Halden', 'Kestrel']) await expectNoText(page, t)
    await page.goForward(); await page.waitForURL('**/sign-in')
    for (const t of ['Waiting for you', '$686,000', 'Halden', 'Kestrel']) await expectNoText(page, t)
    const dump = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }))
    expect(dump).not.toContain('nudge.demo')
  })

  test('browser storage holds only the theme (and the tab-scoped demo flag)', async ({ page }) => {
    await demo(page)
    await page.getByRole('button', { name: 'Toggle theme' }).click()
    const s = await page.evaluate(() => ({ l: Object.keys(localStorage), s: Object.keys(sessionStorage) }))
    expect(s.l.every((k) => k === 'nudge.theme')).toBe(true)
    expect(s.s.every((k) => k === 'nudge.demo')).toBe(true)
    const values = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))
    expect(values).not.toMatch(/token|password|code|secret|@/i)
  })
})

test.describe('not-found and hostile route params', () => {
  const HOSTILE = ['<script>alert(1)</script>', '..%2f..%2fetc%2fpasswd', "x'%20OR%201=1--", 'a'.repeat(300), '%00', 'javascript:alert(1)']
  for (const id of HOSTILE) test(`unknown id ${id.slice(0, 24)} shows a safe not-found`, async ({ page }) => {
    await demo(page)
    for (const base of ['/app/pipeline/', '/app/contacts/', '/app/companies/']) {
      await page.goto(base + id); await expect(page.locator('body')).toContainText(/not found/i)
      await expectNoText(page, 'alert(1)'); await expectNoText(page, 'passwd'); await expectNoText(page, 'OR 1=1')
    }
  })
  test('unknown settings tab and onboarding step fall back safely', async ({ page }) => {
    await demo(page)
    await page.goto('/app/settings/<img src=x>'); await page.waitForURL('**/settings/profile')
    for (const s of ['0', '6', '1e0', '-1', 'abc', '0x1']) { await page.goto('/onboarding/' + s); await page.waitForURL('**/onboarding/1') }
  })
  test('an unknown page shows Page not found, with nothing echoed', async ({ page }) => {
    await page.goto('/nope/<script>alert(1)</script>'); await expectText(page, 'Page not found'); await expectNoText(page, 'alert(1)')
  })
})
