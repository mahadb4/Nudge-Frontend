import { expect, test } from '@playwright/test'
import { demo, expectNoText, expectText, forceFill, watch } from './helpers'

test.describe('sign in', () => {
  test('required, format, and normalisation', async ({ page }) => {
    await page.goto('/sign-in')
    await page.locator('button[type=submit]').click()
    await expectText(page, 'Enter your email address.'); await expectText(page, 'Enter your password.')
    const email = page.locator('input[type=email]')
    await email.fill('ali@raza'); await email.blur(); await expectText(page, 'Enter a valid email address, like name@company.com.')
    await email.fill('  ALI@Raza.COM '); await email.blur(); await expect(email).toHaveValue('ali@raza.com')
  })
  test('field attributes: types, autocomplete, limits', async ({ page }) => {
    await page.goto('/sign-in')
    const email = page.locator('input[type=email]'); const pw = page.locator('input[type=password]')
    await expect(email).toHaveAttribute('autocomplete', 'username'); await expect(email).toHaveAttribute('maxlength', '254'); await expect(email).toHaveAttribute('autocapitalize', 'none'); await expect(email).toHaveAttribute('spellcheck', 'false')
    await expect(pw).toHaveAttribute('autocomplete', 'current-password'); await expect(pw).toHaveAttribute('maxlength', '128')
  })
  test('the same message for any wrong login, a UI lock after 5, and no double submit', async ({ page }) => {
    await page.goto('/sign-in')
    await page.locator('input[type=email]').fill('nobody@example.com'); await page.locator('input[type=password]').fill('abc')
    const submit = page.locator('button[type=submit]')
    await submit.click(); await expect(submit).toBeDisabled()   // busy: a second click cannot send a second request
    await expectText(page, 'That email and password do not match.')
    await expectNoText(page, 'no account'); await expectNoText(page, 'not found')
    for (let i = 0; i < 4; i++) { await expect(submit).toBeEnabled(); await submit.click(); await page.waitForTimeout(450) }
    await expectText(page, /Too many attempts/); await expect(submit).toBeDisabled()
  })
  test('a very long and a hostile password never crash the form', async ({ page }) => {
    await page.goto('/sign-in')
    const pw = page.locator('input[type=password]')
    await pw.fill('x'.repeat(10_000)); expect((await pw.inputValue()).length).toBe(128)      // maxlength is the first line of defence
    await page.locator('input[type=email]').fill('a@b.co'); await forceFill(pw, 'x'.repeat(10_000))   // and the validator is the second
    await page.locator('button[type=submit]').click(); await expectText(page, 'That password is too long.')
  })
  test('a valid sign-in lands on the page that was asked for', async ({ page }) => {
    await page.goto('/app/pipeline'); await page.waitForURL('**/sign-in')
    await page.locator('input[type=email]').fill('mahad@acme.com'); await page.locator('input[type=password]').fill('Nudge2026')
    await page.locator('button[type=submit]').click(); await page.waitForURL('**/app/pipeline')
  })
})

test.describe('sign up', () => {
  test('required fields and real names', async ({ page }) => {
    await page.goto('/sign-up'); await page.locator('button[type=submit]').click()
    for (const m of ['Enter the full name.', 'Enter the company name.', 'Enter your email address.', 'Enter a password.']) await expectText(page, m)
    const f = page.locator('form input'); await f.nth(1).fill('Raza Traders'); await f.nth(2).fill('ali@razatraders.com'); await f.nth(3).fill('Zebra-Moon-77')
    for (const ok of ["O'Brien", 'José Álvarez', 'Anne-Marie Dubois', '李雷', 'محمد علي']) { await f.nth(0).fill(ok); await f.nth(0).blur(); await expect(page.locator('form')).not.toContainText(/Use letters|cannot contain|too short/) }
    for (const [bad, msg] of [['12345', 'Use letters in the name.'], ['<b>Ali</b>', 'cannot contain'], ['A', 'too short'], ['​​​', /Enter the full name|too short/]] as const) {
      await f.nth(0).fill(bad); await f.nth(0).blur(); await expectText(page, msg)
    }
    await f.nth(0).fill('x'.repeat(10_000)); expect((await f.nth(0).inputValue()).length).toBe(80)
    await forceFill(f.nth(0), 'x'.repeat(10_000)); await f.nth(0).blur(); await expectText(page, 'under 80')
  })
  test('password rules, and the password is never trimmed', async ({ page }) => {
    await page.goto('/sign-up'); const f = page.locator('form input'); const pw = page.locator('input[type=password]')
    await expect(pw).toHaveAttribute('autocomplete', 'new-password'); await expect(f.nth(0)).toHaveAttribute('autocomplete', 'name')
    await f.nth(0).fill('Ali Raza'); await f.nth(1).fill('Raza Traders'); await f.nth(2).fill('razatraders@example.com')
    for (const [p, msg] of [['Ab1', 'at least 8'], ['abcdefg1', 'upper and lower'], ['Abcdefgh', 'number'], ['Password1', 'too common'], ['Razatraders99', 'email']] as const) {
      await pw.fill(p); await pw.blur(); await expectText(page, new RegExp(msg))
    }
    await forceFill(pw, 'Aa1' + 'x'.repeat(130)); await pw.blur(); await expectText(page, /at most 128/)
    await pw.fill('  Correct Horse 9!  '); await pw.blur(); await expect(pw).toHaveValue('  Correct Horse 9!  ')
  })
  test('the email stays out of the URL, and the code has a lock', async ({ page }) => {
    await page.goto('/sign-up'); const f = page.locator('form input')
    await f.nth(0).fill('Ali Raza'); await f.nth(1).fill('Raza Traders'); await f.nth(2).fill('Ali@RazaTraders.com'); await f.nth(3).fill('Zebra-Moon-77')
    await page.locator('button[type=submit]').click(); await page.waitForURL('**/verify')
    expect(page.url()).not.toContain('?'); expect(page.url()).not.toContain('razatraders'); await expectText(page, 'ali@razatraders.com')
    const dig = page.locator('.otp input'); const verify = page.getByRole('button', { name: 'Verify email' })
    await expect(dig.first()).toHaveAttribute('autocomplete', 'one-time-code')
    for (let k = 0; k < 5; k++) { for (let i = 0; i < 6; i++) await dig.nth(i).fill(String((i + k + 1) % 10)); await verify.click(); await page.waitForTimeout(450) }
    await expectText(page, 'Too many wrong codes'); await expect(verify).toBeDisabled()
  })
  test('pasted text into the code boxes keeps digits only', async ({ page }) => {
    await page.goto('/sign-up'); const f = page.locator('form input')
    await f.nth(0).fill('Ali Raza'); await f.nth(1).fill('Raza Traders'); await f.nth(2).fill('ali@razatraders.com'); await f.nth(3).fill('Zebra-Moon-77'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/verify')
    await page.locator('.otp input').first().focus()
    await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text', '<b>24-68-10x</b>'); document.querySelector('.otp')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })) })
    await expect(page.locator('.otp input')).toHaveCount(6)
    expect((await page.locator('.otp input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).join('')))).toBe('246810')
  })
  test('the right code is accepted once', async ({ page }) => {
    await page.goto('/sign-up'); const f = page.locator('form input')
    await f.nth(0).fill('Ali Raza'); await f.nth(1).fill('Raza Traders'); await f.nth(2).fill('ali@razatraders.com'); await f.nth(3).fill('Zebra-Moon-77'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/verify')
    const dig = page.locator('.otp input'); for (let i = 0; i < 6; i++) await dig.nth(i).fill('246810'[i])
    await page.getByRole('button', { name: 'Verify email' }).click(); await page.waitForURL('**/onboarding/1')
  })
  test('/verify without state, or with a hostile ?email=, goes back to sign-up and echoes nothing', async ({ page }) => {
    for (const q of ['', '?email=<script>alert(1)</script>', '?email=javascript:alert(1)']) { await page.goto('/verify' + q); await page.waitForURL('**/sign-up'); await expectNoText(page, 'alert(1)') }
  })
})

test.describe('password reset', () => {
  test('the same answer for any address, and a link works once', async ({ page }) => {
    await page.goto('/reset'); const email = page.locator('input[type=email]'); const send = page.getByRole('button', { name: 'Send reset link' })
    await send.click(); await expectText(page, 'Enter your email address.')
    await email.fill('real@acme.com'); await send.click(); await expectText(page, /If an account exists for real@acme.com, a link is on its way/)
    const first = await page.locator('.callout.green').innerText()
    await email.fill('ghost@nowhere.example'); await send.click(); await expect(page.locator('.callout.green')).toContainText('ghost@nowhere.example')
    expect((await page.locator('.callout.green').innerText()).replace('ghost@nowhere.example', 'X')).toBe(first.replace('real@acme.com', 'X'))
    await page.getByRole('button', { name: 'Open the link (demo)' }).click(); await page.waitForURL('**/new-password')
    const pws = page.locator('input[type=password]'); await expect(pws.first()).toHaveAttribute('autocomplete', 'new-password')
    await pws.nth(0).fill('Tr1cky-Horse'); await pws.nth(1).fill('Different-One-9'); await page.getByRole('button', { name: 'Save new password' }).click(); await expectText(page, 'Passwords do not match.')
    await pws.nth(1).fill('Tr1cky-Horse'); await page.getByRole('button', { name: 'Save new password' }).click(); await page.waitForURL('**/sign-in')
    await page.goto('/new-password'); await expectText(page, 'This link is not valid')
  })
  test('a token in the URL is removed from the address bar and judged by the server', async ({ page }) => {
    await page.goto('/new-password?token=demo-999'); await expect(page.getByRole('button', { name: 'Save new password' })).toBeVisible()
    expect(page.url()).not.toContain('token'); const pws = page.locator('input[type=password]')
    await pws.nth(0).fill('Tr1cky-Horse'); await pws.nth(1).fill('Tr1cky-Horse'); await page.getByRole('button', { name: 'Save new password' }).click()
    await expectText(page, 'not valid or has expired')
    await page.goto('/new-password?token=<script>alert(1)</script>'); await expectText(page, 'This link is not valid'); await expectNoText(page, 'alert(1)')
  })
})

test('signing in from the demo link leaves no password or code in storage', async ({ page }) => {
  const w = await watch(page); await page.goto('/sign-in')
  await page.locator('input[type=email]').fill('mahad@acme.com'); await page.locator('input[type=password]').fill('Nudge2026-secret'); await page.locator('button[type=submit]').click(); await page.waitForURL('**/app/home')
  const dump = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage } }))
  expect(dump).not.toContain('Nudge2026-secret'); expect(dump).not.toContain('246810');
  expect(await w.cspViolations()).toEqual([])
  await demo(page)
})
