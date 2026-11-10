import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COUNTRY_CODES, joinPhone, splitPhone, timeZones, to12h, to24h } from '../../src/data/phone'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const ME = {
  name: 'Sara Ali', email: 'sara@x.com', type: 'business', verified: true, phone: '+923005550142', timezone: 'Asia/Karachi', quiet_hours_start: '20:00', quiet_hours_end: '08:00',
  organization: { id: 'o1', name: 'Acme Ltd', type: 'business', timezone: 'Asia/Karachi' }, role: 'owner',
}

describe('phone helpers', () => {
  it('has about thirty common codes', () => { expect(COUNTRY_CODES.length).toBeGreaterThanOrEqual(28); expect(COUNTRY_CODES.length).toBeLessThanOrEqual(34); expect(COUNTRY_CODES).toContain('+92') })
  it('splits E.164 by the longest known code', () => {
    expect(splitPhone('+923005550142')).toEqual({ code: '+92', national: '3005550142' })
    expect(splitPhone('+14155552671')).toEqual({ code: '+1', national: '4155552671' })
    expect(splitPhone('+8801712345678')).toEqual({ code: '+880', national: '1712345678' })
  })
  it('shows an unknown prefix as-is, and an empty phone as the default code', () => {
    expect(splitPhone('+9981234567')).toEqual({ code: '', national: '+9981234567' })
    expect(splitPhone(null)).toEqual({ code: '+92', national: '' }); expect(splitPhone('')).toEqual({ code: '+92', national: '' })
  })
  it('joins to one E.164 string, dropping spaces, dashes and the trunk zero', () => {
    expect(joinPhone('+92', '300 5550142')).toBe('+923005550142'); expect(joinPhone('+92', '0300-5550142')).toBe('+923005550142')
    expect(joinPhone('+1', '(415) 555-2671')).toBe('+14155552671'); expect(joinPhone('', '+998 12 34567')).toBe('+998' + '1234567')
  })
  it('round-trips', () => { for (const n of ['+923005550142', '+442071838750', '+9981234567']) { const s = splitPhone(n); expect(joinPhone(s.code, s.national)).toBe(n) } })
  it('time zones come from the browser list and always include UTC and the current value', () => {
    const z = timeZones('Asia/Karachi'); expect(z).toContain('UTC'); expect(z).toContain('Asia/Karachi'); expect(z).toContain('Europe/London'); expect(timeZones('Mars/Base')).toContain('Mars/Base')
  })
  it('converts quiet-hour times between the form (12 hour) and the API (24 hour)', () => {
    expect(to24h('8:00 PM')).toBe('20:00'); expect(to24h('8:00 AM')).toBe('08:00'); expect(to24h('12:00 AM')).toBe('00:00'); expect(to24h('12:00 PM')).toBe('12:00'); expect(to24h('nonsense')).toBeNull()
    expect(to12h('20:00')).toBe('8:00 PM'); expect(to12h('08:00')).toBe('8:00 AM'); expect(to12h('00:00')).toBe('12:00 AM'); expect(to12h('12:30')).toBe('12:30 PM')
  })
})

describe('profile and workspace updates (real mode)', () => {
  const calls: Array<{ key: string; body?: unknown }> = []
  beforeEach(() => {
    calls.length = 0; vi.resetModules(); vi.stubEnv('VITE_USE_MOCK_API', ''); vi.stubGlobal('document', { cookie: '' }); vi.stubGlobal('navigator', {})
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  const serve = (patch: () => Response) => vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const key = (init.method ?? 'GET') + ' ' + url.replace('/api/v1', '')
    calls.push({ key, body: init.body ? JSON.parse(String(init.body)) : undefined })
    return key === 'GET /auth/csrf/' ? json(200, { csrf_token: 't' }) : patch()
  }))
  const signedIn = async () => {
    const s = await import('../../src/store')
    s.hydrateWorkspace({ name: 'Sara Ali', email: 'sara@x.com', type: 'business', verified: true, organization: ME.organization as never })
    return s
  }

  it('sends only the fields given, with the wire names, and returns the user the server now has', async () => {
    await signedIn(); const { profile } = await import('../../src/api/profile'); serve(() => json(200, { ...ME, name: 'Sara B' }))
    const u = await profile.update({ name: 'Sara B', phone: null, quietStart: '21:00', quietEnd: '07:00' })
    expect(calls.find((c) => c.key === 'PATCH /auth/me/')!.body).toEqual({ name: 'Sara B', phone: null, quiet_hours_start: '21:00', quiet_hours_end: '07:00' })
    expect(u.name).toBe('Sara B'); expect(u.quietStart).toBe('20:00'); expect(u.organization?.name).toBe('Acme Ltd')
  })
  it('a failed save throws and leaves the store untouched (nothing is shown as saved)', async () => {
    const s = await signedIn(); const { profile } = await import('../../src/api/profile')
    serve(() => json(400, { code: 'COMMON_VALIDATION_FAILED', detail: 'x', fields: { phone: [{ code: 'VALIDATION_PHONE_NEEDS_PLUS', detail: 'x' }] } }))
    const err = (await profile.update({ phone: '3005550142' }).catch((e) => e)) as { apiCode: string; fieldCodes: Record<string, string> }
    expect(err.apiCode).toBe('COMMON_VALIDATION_FAILED'); expect(err.fieldCodes.phone).toBe('VALIDATION_PHONE_NEEDS_PLUS')
    expect(s.getState().user?.phone).toBeUndefined()
  })
  it('workspace update sends name and time zone to the organization endpoint and returns the user with the new organization', async () => {
    await signedIn(); const { workspace } = await import('../../src/api/profile'); serve(() => json(200, { id: 'o1', name: 'Acme Group', type: 'business', timezone: 'Europe/London', automation_paused: false }))
    const u = await workspace.update({ name: 'Acme Group', timezone: 'Europe/London' })
    expect(calls.find((c) => c.key === 'PATCH /organizations/current/')!.body).toEqual({ name: 'Acme Group', timezone: 'Europe/London' })
    expect(u.organization).toEqual({ id: 'o1', name: 'Acme Group', type: 'business', timezone: 'Europe/London' }); expect(u.name).toBe('Sara Ali')
  })
  it('a non-admin gets 403 and the screen can show the fixed message', async () => {
    await signedIn(); const { workspace } = await import('../../src/api/profile'); serve(() => json(403, { code: 'COMMON_FORBIDDEN', detail: 'only owners' }))
    const err = (await workspace.update({ name: 'X Corp' }).catch((e) => e)) as { status: number; message: string }
    expect(err.status).toBe(403); expect(err.message).toBe('You do not have access to that.')
  })
})
