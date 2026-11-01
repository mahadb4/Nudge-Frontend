/* One place for every input rule, so every form agrees.
   These checks give fast feedback only. The Django API must repeat all of them. */

export const LIMITS = {
  name: 80, email: 254, company: 120, title: 80, phone: 20, subject: 200, body: 5000,
  password: 128, note: 1000, stage: 40, fact: 200, domain: 253, search: 100, chat: 500, amount: 1_000_000_000_000,
}

/** C0 controls (null bytes included) except tab and newline, plus DEL. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g
/** Zero-width, soft hyphen, bidi override and isolate characters. They hide text or reorder it on screen. */
const INVISIBLE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g

const strip = (v: string) => String(v ?? '').normalize('NFC').replace(CONTROL, '').replace(INVISIBLE, '')

/** Trim, strip control and invisible characters and collapse inner whitespace. Use for single-line text. */
export const clean = (v: string) => strip(v).replace(/\s+/g, ' ').trim()
/** Strip control and invisible characters but keep line breaks. Use for multi-line text. */
export const cleanMulti = (v: string) => strip(v).replace(/\r\n?/g, '\n').trim()

export const normEmail = (v: string) => strip(v).trim().toLowerCase()

const EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i
export const emailOk = (v: string) => {
  const e = v.trim()
  if (e.length > LIMITS.email || e.includes('..') || e.startsWith('.')) return false
  const [local] = e.split('@')
  if (local.length > 64 || local.endsWith('.')) return false
  return EMAIL.test(e) && /\.[a-z]{2,}$/i.test(e)
}
export const emailErr = (v: string, example = 'name@company.com') =>
  !v.trim() ? 'Enter your email address.' : !emailOk(v) ? `Enter a valid email address, like ${example}.` : ''

export const nameErr = (v: string, what = 'name', min = 2, max = LIMITS.name) => {
  const t = clean(v)
  if (t.length < min) return t ? `The ${what} is too short.` : `Enter the ${what}.`
  if (t.length > max) return `Keep the ${what} under ${max} characters.`
  if (/[<>]/.test(t)) return `The ${what} cannot contain < or >.`
  return ''
}
/** For people: needs a letter, and a digits-only or symbols-only name is refused. Real names (O'Brien, José, Anne-Marie, 李雷, محمد) pass. */
export const personErr = (v: string) => nameErr(v, 'full name') || (!/\p{L}/u.test(clean(v)) ? 'Use letters in the name.' : '')

/** The most common passwords, compared after dropping trailing digits and symbols. */
const COMMON = new Set(['password', 'passw0rd', 'qwerty', 'qwertyui', 'qwertyuiop', 'letmein', 'welcome', 'admin', 'administrator', 'iloveyou', 'monkey', 'dragon', 'football', 'baseball', 'trustno', 'changeme', 'abcdefgh', 'abc', 'login', 'master', 'sunshine', 'princess', 'nudge', 'nudge2026', 'acme', 'test', 'testing'])

/** 8 to 128 characters, upper, lower and a number. The value is never trimmed or lowercased. */
export const passwordErr = (p: string, ctx: { email?: string; name?: string } = {}) => {
  if (!p) return 'Enter a password.'
  if (p.length < 8) return 'Use at least 8 characters.'
  if (p.length > LIMITS.password) return `Use at most ${LIMITS.password} characters.`
  if (/[\u0000-\u001F\u007F]/.test(p)) return 'Remove the control characters.'
  if (!/[a-z]/.test(p) || !/[A-Z]/.test(p)) return 'Mix upper and lower case letters.'
  if (!/\d/.test(p)) return 'Add a number.'
  const low = p.toLowerCase()
  const local = (ctx.email ?? '').split('@')[0].toLowerCase()
  if (local.length >= 4 && low.includes(local)) return 'Do not use your email in the password.'
  const tokens = clean(ctx.name ?? '').toLowerCase().split(' ').filter((t) => t.length >= 4)
  if (tokens.some((t) => low.includes(t))) return 'Do not use your name in the password.'
  if (COMMON.has(low.replace(/[\d\W_]+$/g, '')) || /^(.)\1+$/.test(p) || /^(?:0123|1234|2345|3456|abcd)/.test(low) && p.length < 10) return 'That password is too common.'
  return ''
}

/** Money: digits with up to 2 decimals, above 0 and below 1 trillion. */
export const amountErr = (v: string) => {
  const t = v.replace(/,/g, '').trim()
  if (!t) return 'Enter an amount.'
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'Numbers only, like 25000.'
  const n = Number(t)
  if (!(n > 0)) return 'Enter an amount greater than 0.'
  if (n >= LIMITS.amount) return 'That amount is too large.'
  return ''
}

export const phoneErr = (v: string) => {
  if (!v.trim()) return ''
  const d = v.replace(/[\s()-]/g, '')
  return /^\+?\d{7,15}$/.test(d) ? '' : 'Enter a valid phone number, 7 to 15 digits.'
}

export const domainErr = (v: string) => {
  const d = v.trim().toLowerCase()
  if (!d) return ''
  if (d.length > LIMITS.domain) return 'That domain is too long.'
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,}$/.test(d) ? '' : 'Use a domain like acme.com.'
}

export const dateErr = (v: string, opts: { allowPast?: boolean } = {}) => {
  if (!v) return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Use a real date.'
  const [y, m, day] = v.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) return 'Use a real date.'
  if (d.getFullYear() > 2100) return 'Pick a date before 2100.'
  if (!opts.allowPast) { const t = new Date(); t.setHours(0, 0, 0, 0); if (d < t) return 'Pick today or a later date.' }
  return ''
}

export const textErr = (v: string, what: string, min: number, max: number) => {
  const t = v.trim()
  if (t.length < min) return t ? `Write a little more for the ${what}.` : `Enter the ${what}.`
  if (t.length > max) return `Keep the ${what} under ${max} characters.`
  return ''
}

/** A cell that a spreadsheet could run as a formula. Prefix it so it stays text. */
export const csvSafe = (v: string | number) => {
  const s = String(v)
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s
}

/** Parse one CSV into rows. Handles quoted commas, doubled quotes and CRLF. */
export function parseCSV(text: string, maxRows = 2000): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length && rows.length <= maxRows; i++) {
    const c = src[i]
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); if (row.some((x) => x.trim())) rows.push(row) }
  return rows.map((r) => r.map((x) => x.trim()))
}

export const pwScore = (p: string) => {
  let s = 0
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/\d/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++
  return p.length === 0 ? 0 : Math.max(1, s)
}

/* ---------- URLs, paths, ids ---------- */

/** Only http, https and mailto may ever reach an href, src, window.open or navigate call. Returns '' for anything else. */
export function safeHref(raw: string): string {
  const v = strip(raw).trim()
  if (!v || v.length > 2048 || /[\s\\]/.test(v)) return ''
  try {
    const u = new URL(v)
    if (!['http:', 'https:', 'mailto:'].includes(u.protocol)) return ''
    if (u.username || u.password) return ''
    return u.href
  } catch { return '' }
}
export const urlErr = (raw: string) => (!raw.trim() ? '' : safeHref(raw) ? '' : 'Use a web address that starts with http:// or https://.')

/** Same-origin path only. Blocks //host, /\host, scheme:, control characters and anything outside the allowed prefixes. */
export function safeInternalPath(raw: unknown, fallback = '/app/home', prefixes: string[] = ['/app/', '/onboarding/']): string {
  if (typeof raw !== 'string' || raw.length > 300) return fallback
  if (!/^\/[A-Za-z0-9\-._~/]*$/.test(raw) || raw.includes('//') || raw.includes('..')) return fallback
  return prefixes.some((p) => raw.startsWith(p)) ? raw : fallback
}

/** Route ids from the URL. The mock ids look like d3, p1, c10. Real ids will be UUIDs or integers. */
export const idOk = (id: unknown): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id)

/* ---------- Files ---------- */

export const CSV_MAX_BYTES = 1_000_000
export const CSV_MAX_ROWS = 1000
export const CSV_MIMES = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', '']

/** Extension, MIME and size. The browser MIME is a hint only, so the content is checked again when it is read. */
export function csvFileErr(f: { name: string; size: number; type: string }): string {
  if (!/\.csv$/i.test(f.name) || f.name.length > 255) return 'Choose a .csv file.'
  if (!CSV_MIMES.includes((f.type || '').toLowerCase())) return 'That file is not a CSV.'
  if (f.size === 0) return 'The file is empty.'
  if (f.size > CSV_MAX_BYTES) return 'The file is over 1 MB. Split it and try again.'
  return ''
}

/** Strict UTF-8. Throws on invalid bytes, and drops a leading byte order mark. */
export function decodeUtf8(buf: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(buf).replace(/^\uFEFF/, '')
}

/** A value from a CSV that starts with a formula character is not a safe name. */
export const FORMULA_START = /^[=+\-@\t\r]/
export const stripFormulaStart = (v: string) => clean(v).replace(/^[=+\-@\s]+/, '')
