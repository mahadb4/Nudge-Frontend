/* Phone numbers and time zones for the profile form.
   The API stores one E.164 string ("+923005550142") and refuses a number without "+". The form shows a country
   code select and the rest of the number, so these helpers join and split. */

/** About thirty common country codes. Longest first is not needed: splitPhone picks the longest match itself. */
export const COUNTRY_CODES: ReadonlyArray<string> = [
  '+1', '+7', '+20', '+27', '+31', '+33', '+34', '+39', '+44', '+46', '+49', '+52', '+55', '+60', '+61', '+62', '+63', '+64', '+65',
  '+81', '+82', '+86', '+90', '+91', '+92', '+94', '+880', '+966', '+971', '+974',
]

/** "+923005550142" -> { code: "+92", national: "3005550142" }. An unknown prefix keeps the whole number and an empty code. */
export function splitPhone(e164: string | null | undefined): { code: string; national: string } {
  const v = (e164 ?? '').trim()
  if (!v) return { code: '+92', national: '' }
  if (!v.startsWith('+')) return { code: '', national: v }
  const best = [...COUNTRY_CODES].sort((a, b) => b.length - a.length).find((c) => v.startsWith(c))
  return best ? { code: best, national: v.slice(best.length) } : { code: '', national: v }
}

/** Country code and typed number -> E.164 for the API. With no code select, the number must carry its own "+". */
export function joinPhone(code: string, national: string): string {
  const digits = national.replace(/\D/g, '')
  if (code === '') return '+' + digits
  return code + digits.replace(/^0+/, '')
}

/** IANA zone names from the browser, with the current value and UTC always present. */
export function timeZones(current?: string): string[] {
  let list: string[] = []
  try { list = Intl.supportedValuesOf('timeZone') } catch { list = ['Asia/Karachi', 'Europe/London', 'America/New_York', 'Asia/Dubai'] }
  const set = new Set(list); set.add('UTC'); if (current) set.add(current)
  return [...set].sort()
}

/** "8:00 PM" -> "20:00" for the API. Anything else returns null. */
export function to24h(label: string): string | null {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(label.trim())
  if (!m) return null
  let h = Number(m[1]) % 12; if (m[3] === 'PM') h += 12
  return String(h).padStart(2, '0') + ':' + m[2]
}

/** "20:00" -> "8:00 PM" for the form. */
export function to12h(hhmm: string): string {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm)
  if (!m) return hhmm
  const h = Number(m[1]); return (h % 12 === 0 ? 12 : h % 12) + ':' + m[2] + ' ' + (h >= 12 ? 'PM' : 'AM')
}
