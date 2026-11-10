import { expect, type Page } from '@playwright/test'

export const PAYLOADS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  "=cmd|' /C calc'!A0",
]
/** Executes if it is ever turned into markup, so a pass means it stayed text. */
export const LIVE_PAYLOAD = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'

/** Records dialogs, CSP violations and XSS flags. Call before the first goto. */
export async function watch(page: Page) {
  const seen = { dialogs: [] as string[], csp: [] as string[], errors: [] as string[] }
  page.on('dialog', (d) => { seen.dialogs.push(d.message()); void d.dismiss() })
  page.on('pageerror', (e) => seen.errors.push(e.message))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => { (window as unknown as { __csp: string[] }).__csp = ((window as unknown as { __csp?: string[] }).__csp ?? []).concat(e.violatedDirective + ' ' + e.blockedURI) })
  })
  return {
    seen,
    async cspViolations() { return (await page.evaluate(() => (window as unknown as { __csp?: string[] }).__csp ?? [])) },
    async xssFlag() { return page.evaluate(() => (window as unknown as { __xss?: number }).__xss) },
  }
}

/** Opens the demo workspace the way a visitor would. */
export async function demo(page: Page) {
  await page.goto('/')
  await page.getByRole('link', { name: 'See the demo workspace' }).click()
  await page.waitForURL('**/app/home')
}

export const body = (page: Page) => page.locator('body').innerText()
export const dialog = (page: Page) => page.locator('[role=dialog]')

export async function expectText(page: Page, text: string | RegExp) { await expect(page.locator('body')).toContainText(text) }
export async function expectNoText(page: Page, text: string | RegExp) { await expect(page.locator('body')).not.toContainText(text) }

/** Sets a value the way DevTools or a script would, ignoring maxlength, then fires the input event React listens to. */
export async function forceFill(loc: import('@playwright/test').Locator, value: string) {
  await loc.evaluate((el, v) => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

/** A person leaving a field: a key press inside it (Tab), which also moves focus on. Playwright's fill() and blur() alone are not user actions. */
export async function leave(loc: import('@playwright/test').Locator) { await loc.press('Tab') }
