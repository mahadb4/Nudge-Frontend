import { expect, test, type Page } from '@playwright/test'
import { forceFill, leave } from './helpers'

const SIZES = [{ name: '1366x768', width: 1366, height: 768 }, { name: '1536x864', width: 1536, height: 864 }, { name: '1920x1080', width: 1920, height: 1080 }]

/** Opens each of the five auth screens. Verify and reset-password need the state a real flow gives them. */
const SCREENS: { name: string; open: (p: Page) => Promise<void> }[] = [
  { name: 'sign-in', open: async (p) => { await p.goto('/sign-in') } },
  { name: 'sign-up', open: async (p) => { await p.goto('/sign-up') } },
  { name: 'verify', open: async (p) => {
    await p.goto('/sign-up'); const f = p.locator('form input')
    await f.nth(0).fill('Ali Raza'); await f.nth(1).fill('Raza Traders'); await f.nth(2).fill('ali@razatraders.com'); await f.nth(3).fill('Zebra-Moon-77')
    await p.locator('button[type=submit]').click(); await p.waitForURL('**/verify')
  } },
  { name: 'forgot-password', open: async (p) => { await p.goto('/reset') } },
  { name: 'reset-password', open: async (p) => { await p.goto('/new-password?token=demo-999'); await expect(p.getByRole('button', { name: 'Save new password' })).toBeVisible() } },
]

test.describe('layout', () => {
  for (const size of SIZES) for (const s of SCREENS) test(`${s.name} at ${size.name}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height })
    await s.open(page); await page.waitForTimeout(250)
    const h1 = await page.locator('.auth-mid h1').boundingBox()
    const mid = await page.locator('.auth-mid').boundingBox()
    expect(h1 && mid).toBeTruthy()
    // the page never scrolls sideways
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    if (size.height <= 820) {
      // short screen: the form starts near the top, under the logo bar, however tall the dark pane is
      expect(h1!.y).toBeLessThan(260)
    } else if (size.height >= 1000 && (s.name === 'forgot-password' || s.name === 'sign-in')) {
      // tall screen: a short form stays centred, not glued to the top
      expect(h1!.y).toBeGreaterThan(150)
    }
    // one screen exactly: the page itself never scrolls, both columns fill the viewport, no blank band
    const m = await page.evaluate(() => {
      const r = (sel: string) => { const b = document.querySelector(sel)!.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height } }
      return { vh: window.innerHeight, vw: window.innerWidth, doc: document.documentElement.scrollHeight, left: r('.auth-left'), right: r('.auth-right'), card: r('.auth-right .float-card.big'), fit: document.querySelector<HTMLElement>('.auth-right')!.dataset.fit }
    })
    expect(m.doc).toBeLessThanOrEqual(m.vh)
    expect(Math.abs(m.left.h - m.vh)).toBeLessThanOrEqual(1); expect(Math.abs(m.right.h - m.vh)).toBeLessThanOrEqual(1)
    expect(m.left.left).toBe(0); expect(Math.abs(m.right.right - m.vw)).toBeLessThanOrEqual(1)      // no white or dark gap on either side
    // the main card is whole: fully inside the panel and fully on screen, whatever level of squeezing was needed
    expect(m.card.top).toBeGreaterThanOrEqual(0); expect(m.card.bottom).toBeLessThanOrEqual(m.vh)
    // nothing inside the panel is clipped at the bottom except what the fit levels removed on purpose
    expect(await page.locator('.auth-right').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true)
    // the stats row is the first thing to go, so it is only visible when everything fits without it being removed
    if (m.fit === '0') await expect(page.locator('.stats3')).toBeVisible(); else await expect(page.locator('.stats3')).toBeHidden()
    expect(mid!.x).toBeGreaterThanOrEqual(0)
    if (process.env.AUTH_SHOTS) await page.screenshot({ path: `${process.env.AUTH_SHOTS}/${s.name}-${size.name}.png` })
  })

  test('the dark panel is pinned: scrolling the left column or the page does not move it', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 700 }); await page.goto('/sign-up')
    const before = await page.locator('.auth-right .float-card.big').boundingBox()
    expect(await page.locator('.auth-left').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)   // the form is taller than the screen, so the left column scrolls by itself
    await page.locator('.auth-left').evaluate((el) => el.scrollTo(0, el.scrollHeight)); await page.mouse.wheel(0, 600); await page.waitForTimeout(150)
    const after = await page.locator('.auth-right .float-card.big').boundingBox()
    expect(after!.y).toBe(before!.y); expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await expect(page.getByRole('button', { name: 'Create account' })).toBeInViewport()
  })

  test('a very short window still shows the whole main card', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 560 }); await page.goto('/sign-in'); await page.waitForTimeout(250)
    const b = await page.locator('.auth-right .float-card.big').boundingBox()
    expect(b!.y).toBeGreaterThanOrEqual(0); expect(b!.y + b!.height).toBeLessThanOrEqual(560)
  })

  test('under 900px wide the dark panel is gone and the page scrolls normally', async ({ page }) => {
    for (const w of [899, 600, 390]) {
      await page.setViewportSize({ width: w, height: 700 }); await page.goto('/sign-up')
      await expect(page.locator('.auth-right')).toBeHidden()
      expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true)   // the form is taller than 700px, so the page itself scrolls
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await expect(page.getByRole('button', { name: 'Create account' })).toBeInViewport()
    }
  })

  test('on a short screen the whole form can be scrolled into view', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 }); await page.goto('/sign-up')
    const btn = page.getByRole('button', { name: 'Create account' }); await btn.scrollIntoViewIfNeeded(); await expect(btn).toBeInViewport()
  })
})

test.describe('errors appear only after leaving a field or pressing submit', () => {
  const errorCount = (page: Page) => page.locator('.err, .field .err').count()

  test('first load shows no error on any screen', async ({ page }) => {
    for (const s of SCREENS) { await s.open(page); await page.waitForTimeout(300); expect(await errorCount(page), s.name).toBe(0); expect(await page.locator('input.invalid').count(), s.name).toBe(0) }
  })

  test('autofill and an autofocus that loses focus do not trigger an error', async ({ page }) => {
    await page.goto('/sign-in')
    await page.locator('input[type=email]').focus(); await page.locator('input[type=password]').focus()   // focus moving on its own, no key or click
    expect(await errorCount(page)).toBe(0)
    // a browser autofill sets the value and fires input, with no key or click
    await forceFill(page.locator('input[type=email]'), 'not-an-email'); await forceFill(page.locator('input[type=password]'), 'x')
    await page.locator('body').evaluate((b) => (b as HTMLElement).focus()); await page.waitForTimeout(150)
    expect(await errorCount(page)).toBe(0)
    // pressing submit is a deliberate act, so now everything shows
    await page.locator('button[type=submit]').click(); await expect(page.locator('.err').first()).toBeVisible()
  })

  test('sign in: empty field left with Tab shows the error, a clicked-away empty field too', async ({ page }) => {
    await page.goto('/sign-in'); const email = page.locator('input[type=email]')
    await email.click(); await expect(page.locator('.err')).toHaveCount(0)            // being inside the field is not leaving it
    await leave(email); await expect(page.locator('.err').first()).toContainText('Enter your email address.')
    await expect(page.locator('.err')).toHaveCount(1)  // the password field has not been left yet
    await page.locator('input[type=password]').click(); await page.locator('h1').click(); await expect(page.locator('.err')).toHaveCount(2)
  })

  test('sign in: typing keeps the error away until the field is left', async ({ page }) => {
    await page.goto('/sign-in'); const email = page.locator('input[type=email]')
    await email.click(); await email.pressSequentially('ali@raz'); await expect(page.locator('.err')).toHaveCount(0)
    await leave(email); await expect(page.locator('.err').first()).toContainText('valid email address')
    await email.click(); await email.fill('ali@razatraders.com'); await expect(page.locator('.err')).toHaveCount(0)   // fixing it clears it straight away
  })

  test('sign up: each field shows its error only after it was left', async ({ page }) => {
    await page.goto('/sign-up'); const f = page.locator('form input')
    await f.nth(0).click(); await f.nth(0).pressSequentially('12345'); await expect(page.locator('form .err')).toHaveCount(0)
    await leave(f.nth(0)); await expect(page.locator('form')).toContainText('Use letters in the name.')
    await expect(page.locator('form .err')).toHaveCount(1)                              // company, email and password are untouched
    await f.nth(2).click(); await f.nth(2).pressSequentially('nope'); await leave(f.nth(2)); await expect(page.locator('form')).toContainText('valid email address')
    await expect(page.locator('form .err')).toHaveCount(2)
    await page.locator('button[type=submit]').click(); expect(await page.locator('form .err').count()).toBeGreaterThanOrEqual(4)
  })

  test('forgot password: no error on load or on autofill, error after leaving or submit', async ({ page }) => {
    await page.goto('/reset'); const email = page.locator('input[type=email]')
    await forceFill(email, 'bad'); await page.waitForTimeout(150); await expect(page.locator('.err')).toHaveCount(0)
    await email.click(); await leave(email); await expect(page.locator('.err').first()).toContainText('valid email address')
    await email.fill(''); await page.getByRole('button', { name: 'Send reset link' }).click(); await expect(page.locator('.err').first()).toContainText('Enter your email address.')
  })

  test('reset password: confirm mismatch shows after leaving the field, not while typing', async ({ page }) => {
    await page.goto('/new-password?token=demo-999'); const pws = page.locator('input[type=password]')
    await pws.nth(0).click(); await pws.nth(0).pressSequentially('Tr1cky-Horse'); await expect(page.locator('.err')).toHaveCount(0)
    await pws.nth(1).click(); await pws.nth(1).pressSequentially('Tr1cky'); await expect(page.locator('.err')).toHaveCount(0)
    await leave(pws.nth(1)); await expect(page.locator('.err').first()).toContainText('Passwords do not match.')
  })

  test('verify: the code boxes show an error only on submit', async ({ page }) => {
    await SCREENS[2].open(page); await page.waitForTimeout(200); expect(await errorCount(page)).toBe(0)
    await page.getByRole('button', { name: 'Verify email' }).click(); await expect(page.locator('.err')).toContainText('Enter all 6 digits.')
  })
})
