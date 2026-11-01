import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { demo, dialog, expectText, watch } from './helpers'

test.beforeEach(async ({ page }) => { await demo(page); await page.goto('/app/contacts'); await page.getByRole('button', { name: 'Import CSV' }).click() })

const file = (page: Page, name: string, type: string, data: Buffer | string) => page.locator('input[type=file]').setInputFiles({ name, mimeType: type, buffer: Buffer.isBuffer(data) ? data : Buffer.from(data) })

test.describe('CSV import', () => {
  test('accepts only a real CSV: extension, MIME, size, header, rows, encoding', async ({ page }) => {
    const d = dialog(page)
    await file(page, 'x.txt', 'text/csv', 'Name,Email\nA B,a@b.co'); await expect(d).toContainText('Choose a .csv file.')
    await file(page, 'x.csv.exe', 'text/csv', 'Name,Email\nA B,a@b.co'); await expect(d).toContainText('Choose a .csv file.')
    await file(page, 'x.csv', 'image/png', 'Name,Email\nA B,a@b.co'); await expect(d).toContainText('not a CSV')
    await file(page, 'x.csv', 'text/html', '<script>alert(1)</script>'); await expect(d).toContainText('not a CSV')
    await file(page, 'x.csv', 'text/csv', ''); await expect(d).toContainText('The file is empty.')
    await file(page, 'big.csv', 'text/csv', Buffer.alloc(1_100_000, 'a')); await expect(d).toContainText('over 1 MB')
    await file(page, 'x.csv', 'text/csv', 'A,B\n1,2\n'); await expect(d).toContainText('Name and Email')
    await file(page, 'x.csv', 'text/csv', 'Name,Email\n'); await expect(d).toContainText('header row and at least one contact')
    await file(page, 'x.csv', 'text/csv', Buffer.concat([Buffer.from('Name,Email\n'), Buffer.from([0xff, 0xfe, 0x80, 0x81, 0x0a])])); await expect(d).toContainText('UTF-8')
    await file(page, 'x.csv', 'text/csv', 'Name,Email\n' + Array.from({ length: 1001 }, (_, i) => `P${i} Q,p${i}@x.com`).join('\n')); await expect(d).toContainText('up to 1000 contacts')
  })

  test('rows are checked one by one: quoted commas, duplicates, names, emails, formulas', async ({ page }) => {
    const w = await watch(page); const d = dialog(page)
    const csv = ['﻿Name,Email,Title', '"Lovelace, Ada",ada@x.com,"CTO ""boss"""', 'Sara Ali,SARA@northwind.com,Dup of an existing contact', 'Ada Again,ADA@x.com,Dup inside the file', 'Bad Mail,notanemail,X', '12345,num@x.com,X',
      "=cmd|' /C calc'!A0,evil@x.com,=1+1", '+SUM(1),plus@x.com,X', '<script>alert(1)</script>,tag@x.com,X', 'Zoë Müller,zoe@x.com,"=HYPERLINK(""http://evil"")"', '李雷,lilei@x.com,Engineer', ''].join('\r\n')
    await file(page, 'c.csv', 'text/csv', csv)
    await expect(d).toContainText('Lovelace, Ada')
    const verdicts = await d.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent ?? '')))
    const by = Object.fromEntries(verdicts.map((r) => [r[1], r[3]]))
    expect(by['ada@x.com']).toBe('OK'); expect(by['SARA@northwind.com']).toBe('Duplicate'); expect(by['ADA@x.com']).toBe('Duplicate'); expect(by['notanemail']).toBe('Bad email'); expect(by['num@x.com']).toBe('Bad name')
    expect(by['evil@x.com']).toBe('Unsafe text'); expect(by['plus@x.com']).toBe('Unsafe text'); expect(by['tag@x.com']).toBe('Bad name')
    await expect(d).toContainText(/\d+ valid, \d+ skipped/)
    await d.getByRole('button', { name: /^Import/ }).click(); await expectText(page, /contacts imported/)
    expect(await w.xssFlag()).toBeUndefined(); expect(w.seen.dialogs).toEqual([])
    await page.getByLabel('Search contacts').fill('zoe'); await expect(page.locator('tbody')).toContainText('Zoë Müller')
    await page.getByLabel('Search contacts').fill(''); await page.getByRole('row', { name: /Zoë/ }).click(); await expect(page.locator('body')).not.toContainText('=HYPERLINK')
  })

  test('Export neutralises formula cells: = + - @ tab and carriage return', async ({ page }) => {
    await page.keyboard.press('Escape')
    const add = async (name: string, email: string, title: string) => {
      await page.getByRole('button', { name: 'Add contact' }).first().click(); const d = dialog(page)
      await d.locator('input').nth(0).fill(name); await d.locator('input[type=email]').fill(email); await d.locator('input').nth(2).fill(title); await d.getByRole('button', { name: 'Add contact' }).click(); await page.waitForURL('**/app/contacts/p*'); await page.getByRole('link', { name: 'Contacts' }).first().click(); await page.waitForURL('**/app/contacts')
    }
    await add('Formula One', 'f1@example.com', "=cmd|' /C calc'!A0"); await add('Formula Two', 'f2@example.com', '@SUM(A1:A9)'); await add('Formula Three', 'f3@example.com', '+1+1')
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()])
    const text = readFileSync(await dl.path(), 'utf8')
    for (const cell of text.split(/\r?\n/).flatMap((l) => l.split('","'))) expect(cell.replace(/^"/, '')).not.toMatch(/^[=+\-@\t\r]/)
    expect(text).toContain(`"'=cmd|' /C calc'!A0"`); expect(text).toContain(`"'@SUM(A1:A9)"`); expect(text).toContain(`"'+1+1"`)
  })

  test('the template download and the reports export are formula-safe too', async ({ page }) => {
    const [dl] = await Promise.all([page.waitForEvent('download'), dialog(page).getByRole('button', { name: /Download a template/ }).click()])
    expect(readFileSync(await dl.path(), 'utf8')).toMatch(/^"Name","Email","Title"/)
    await page.keyboard.press('Escape'); await page.goto('/app/reports')
    const [rp] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()])
    const body = readFileSync(await rp.path(), 'utf8'); for (const cell of body.split(/\r?\n/).flatMap((l) => l.split(','))) expect(cell.replace(/^"/, '')).not.toMatch(/^[=+@\t\r]/)
  })

  test('a dropped file goes through the same checks', async ({ page }) => {
    const d = dialog(page)
    await page.evaluate(() => {
      const dt = new DataTransfer(); dt.items.add(new File(['<script>alert(1)</script>'], 'evil.html', { type: 'text/html' }))
      document.querySelector('.drop')!.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
    })
    await expect(d).toContainText('Choose a .csv file.')
  })
})
