import { describe, expect, it } from 'vitest'
import {
  CSV_MAX_BYTES, LIMITS, amountErr, clean, cleanMulti, csvFileErr, csvSafe, dateErr, decodeUtf8, domainErr, emailErr, emailOk, idOk,
  nameErr, normEmail, parseCSV, passwordErr, personErr, phoneErr, pwScore, safeHref, safeInternalPath, stripFormulaStart, textErr, urlErr,
} from '../../src/data/validate'

const XSS = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', 'javascript:alert(1)', "=cmd|' /C calc'!A0"]

describe('email', () => {
  it.each(['a@b.co', 'ali@razatraders.com', 'first.last+tag@sub.example.org', "o'brien@example.ie", 'x@xn--80ak6aa92e.com'])('accepts %s', (e) => expect(emailOk(e)).toBe(true))
  it.each([
    '', ' ', 'ali@raza', 'ali@', '@x.com', 'a b@x.com', 'a@x..com', '.a@x.com', 'a.@x.com', 'a@-x.com', 'a@x-.com', 'a@x.c', 'a@@x.com',
    'a'.repeat(65) + '@x.com', 'a@' + 'b'.repeat(250) + '.com', 'a\n@x.com', 'a@x.com\nbcc:evil@x.com', 'a\u0000@x.com', 'a@x.com<script>', ...XSS,
  ])('rejects %j', (e) => expect(emailOk(e)).toBe(false))
  it('enforces the 254 limit', () => { expect(LIMITS.email).toBe(254); expect(emailOk('a@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(63) + '.' + 'e'.repeat(60) + '.com')).toBe(false) })
  it('normalises: trim, lowercase, no invisible characters', () => { expect(normEmail('  ALI@Raza.COM ')).toBe('ali@raza.com'); expect(normEmail('a​li@x.com')).toBe('ali@x.com') })
  it('gives a clear message', () => { expect(emailErr('')).toMatch(/Enter your email/); expect(emailErr('nope')).toMatch(/valid email address/); expect(emailErr('a@b.co')).toBe('') })
})

describe('person names', () => {
  it.each(["O'Brien", 'José Álvarez', 'Anne-Marie Dubois', '李雷', '王小明', 'محمد علي', 'Zoë Müller', 'Nguyễn Văn An', 'Ali Raza', '😀 Ali'])('accepts the real name %s', (n) => expect(personErr(n)).toBe(''))
  it.each(['', '   ', 'A', '12345', '٣٤٥٦', '---', '...', '<b>Ali</b>', 'Ali>', 'x'.repeat(81), '​​​', ...XSS.filter((x) => /[<>]/.test(x) || x.length < 3)])('rejects %j', (n) => expect(personErr(n)).not.toBe(''))
  it('invisible characters cannot make a name look filled', () => { expect(personErr('​‌‍')).not.toBe(''); expect(clean('A​l‮i')).toBe('Ali') })
  it('null bytes and control characters are removed', () => { expect(clean('Al\u0000i\u0007')).toBe('Ali') })
  it('newlines in a single-line field collapse to one space', () => { expect(clean('Ali\n\r\nRaza')).toBe('Ali Raza') })
  it('very long input is refused, not truncated silently', () => { expect(nameErr('x'.repeat(10_000))).toMatch(/under 80/) })
  it('keeps SQL-like text as plain text', () => { expect(personErr("Robert'); DROP TABLE users;--")).toBe('') })
})

describe('password', () => {
  const ok = 'Tr1cky-Horse'
  it('accepts a good password', () => { expect(passwordErr(ok)).toBe(''); expect(passwordErr('A'.repeat(60) + 'a1'.repeat(30))).toBe('') })
  it('accepts spaces, unicode and symbols', () => { expect(passwordErr('Correct Horse 9!')).toBe(''); expect(passwordErr('Żółć-Gęślą-7x')).toBe('') })
  it('does not trim or change the value (leading and trailing spaces are kept)', () => { expect(passwordErr('  Abcdefg1  ')).toBe('') })
  it.each([
    ['', /Enter a password/], ['Ab1', /at least 8/], ['abcdefg1', /upper and lower/], ['ABCDEFG1', /upper and lower/], ['Abcdefgh', /number/],
    ['Aa1' + 'x'.repeat(126), /at most 128/], ['Abcdef\u00001', /control/], ['Password1', /common/], ['Passw0rd!', /common/], ['Nudge2026', /common/],
  ])('rejects %j', (p, msg) => expect(passwordErr(p)).toMatch(msg))
  it('rejects the 129th character and accepts the 128th', () => { expect(passwordErr('Aa1' + 'x'.repeat(125))).toBe(''); expect(passwordErr('Aa1' + 'x'.repeat(126))).not.toBe('') })
  it('rejects the email and the name inside the password', () => {
    expect(passwordErr('Razatraders99', { email: 'razatraders@example.com' })).toMatch(/email/)
    expect(passwordErr('Mahadbaloch99', { name: 'Mahad Baloch' })).toMatch(/name/)
  })
  it('scores strength without changing the input', () => { expect(pwScore('')).toBe(0); expect(pwScore('Tr1cky-Horse-Battery')).toBe(4) })
})

describe('amount', () => {
  it.each(['25000', '25000.5', '25000.50', '1,200', '0.01', '999999999999.99'])('accepts %s', (a) => expect(amountErr(a)).toBe(''))
  it.each(['', ' ', 'abc', '25k', '1e5', '1E5', '-1', '+5', '0', '0.00', '12.345', 'NaN', 'Infinity', '-Infinity', '1000000000000', '1e999', '0x10', '١٢٣', '5;DROP', ...XSS])('rejects %j', (a) => expect(amountErr(a)).not.toBe(''))
})

describe('phone, domain, url, date', () => {
  it.each(['', '+92 300 5550142', '300 5550142', '(555) 123-4567', '+14155552671'])('phone ok %j', (p) => expect(phoneErr(p)).toBe(''))
  it.each(['abc', '123', '1234567890123456', '12-ab-3456', '++9230055501', ...XSS])('phone bad %j', (p) => expect(phoneErr(p)).not.toBe(''))
  it.each(['', 'acme.com', 'sub.acme.co.uk', 'xn--80ak6aa92e.com'])('domain ok %j', (d) => expect(domainErr(d)).toBe(''))
  it.each(['acme', '-a.com', 'a-.com', 'a_b.com', 'http://acme.com', 'acme.c', 'a..com', 'a.com/path', 'a b.com', ...XSS])('domain bad %j', (d) => expect(domainErr(d)).not.toBe(''))
  it('urlErr: http, https and mailto only', () => {
    for (const u of ['https://acme.com', 'http://acme.com/a?b=1', 'mailto:ali@x.com', '']) expect(urlErr(u)).toBe('')
    for (const u of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:x', 'file:///etc/passwd', 'ftp://x.com', '//evil.com', 'https://user:pw@x.com', 'https://a.com/ x', 'java\tscript:alert(1)']) expect(urlErr(u)).not.toBe('')
  })
  it('dates: real, not past, before 2100', () => {
    expect(dateErr('2099-12-31')).toBe(''); expect(dateErr('')).toBe('')
    expect(dateErr('2020-01-01')).toMatch(/today or a later/); expect(dateErr('2020-01-01', { allowPast: true })).toBe('')
    expect(dateErr('2027-02-30')).toMatch(/real date/); expect(dateErr('2027-13-01')).toMatch(/real date/); expect(dateErr('not-a-date')).toMatch(/real date/); expect(dateErr('2101-01-01')).toMatch(/2100/)
  })
  it('free text has min and max', () => { expect(textErr('', 'note', 1, 10)).not.toBe(''); expect(textErr('x'.repeat(11), 'note', 1, 10)).not.toBe(''); expect(textErr('hello', 'note', 1, 10)).toBe('') })
  it('multi-line text keeps newlines but drops control and invisible characters', () => { expect(cleanMulti('  a\r\nb\u0000​  ')).toBe('a\nb') })
})

describe('urls and redirects', () => {
  it('safeHref allows only http, https and mailto', () => {
    expect(safeHref('https://acme.com/x')).toBe('https://acme.com/x'); expect(safeHref('mailto:a@b.co')).toBe('mailto:a@b.co')
    for (const u of ['javascript:alert(1)', ' javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', '', 'x'.repeat(3000)]) expect(safeHref(u)).toBe('')
  })
  it('safeInternalPath blocks open redirects', () => {
    expect(safeInternalPath('/app/pipeline/d3')).toBe('/app/pipeline/d3'); expect(safeInternalPath('/onboarding/2')).toBe('/onboarding/2')
    for (const p of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '/app/../../etc', '/app/%2e%2e/x', '/sign-in', '/app//x', 'app/home', '', null, undefined, 5, '/app/x\n', '/app/' + 'a'.repeat(400)])
      expect(safeInternalPath(p)).toBe('/app/home')
  })
  it('idOk accepts plain ids only', () => {
    for (const i of ['d3', 'p1', 'c10', '9f1c-22', 'A_b-1']) expect(idOk(i)).toBe(true)
    for (const i of ['', '<script>', '../x', 'a b', 'a/b', "x'--", undefined, 5, 'x'.repeat(65), 'a\u0000']) expect(idOk(i)).toBe(false)
  })
})

describe('csv', () => {
  it('neutralises formula cells on export', () => {
    for (const c of ["=cmd|' /C calc'!A0", '+1+1', '-2+3', '@SUM(A1)', '\tx', '\rx']) expect(csvSafe(c)).toBe("'" + c)
    expect(csvSafe('Ada')).toBe('Ada'); expect(csvSafe('a=b')).toBe('a=b')
  })
  it('neutralises formula starts on import', () => { expect(stripFormulaStart("=cmd|' /C calc'!A0")).toBe("cmd|' /C calc'!A0"); expect(stripFormulaStart('+-=@ CTO')).toBe('CTO') })
  it('parses quoted commas, doubled quotes, CRLF, BOM and blank lines', () => {
    const rows = parseCSV('﻿Name,Email,Title\r\n"Lovelace, Ada",ada@x.com,"CTO ""boss"""\r\n\r\n,,\nBob,bob@x.com,')
    expect(rows).toHaveLength(3); expect(rows[1]).toEqual(['Lovelace, Ada', 'ada@x.com', 'CTO "boss"']); expect(rows[0][0]).toBe('Name')
  })
  it('stops at the row cap', () => { expect(parseCSV('a,b\n'.repeat(5000), 1000).length).toBeLessThanOrEqual(1001) })
  it('checks name, MIME and size', () => {
    expect(csvFileErr({ name: 'c.csv', size: 10, type: 'text/csv' })).toBe(''); expect(csvFileErr({ name: 'c.CSV', size: 10, type: '' })).toBe('')
    expect(csvFileErr({ name: 'c.txt', size: 10, type: 'text/csv' })).toMatch(/\.csv/); expect(csvFileErr({ name: 'c.csv.exe', size: 10, type: 'text/csv' })).toMatch(/\.csv/)
    expect(csvFileErr({ name: 'c.csv', size: 10, type: 'image/png' })).toMatch(/not a CSV/); expect(csvFileErr({ name: 'c.csv', size: 10, type: 'text/html' })).toMatch(/not a CSV/)
    expect(csvFileErr({ name: 'c.csv', size: 0, type: 'text/csv' })).toMatch(/empty/); expect(csvFileErr({ name: 'c.csv', size: CSV_MAX_BYTES + 1, type: 'text/csv' })).toMatch(/1 MB/)
  })
  it('decodes strict UTF-8, drops a BOM and refuses invalid bytes', () => {
    expect(decodeUtf8(new TextEncoder().encode('﻿Name,Email\n李雷,a@b.co').buffer as ArrayBuffer)).toBe('Name,Email\n李雷,a@b.co')
    expect(() => decodeUtf8(new Uint8Array([0x4e, 0xff, 0xfe, 0x80]).buffer)).toThrow()
  })
})
