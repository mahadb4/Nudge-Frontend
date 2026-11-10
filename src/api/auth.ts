/* Auth endpoints. Real mode (the default) calls the Django API from docs/backend/API_CONTRACT.md.
   Mock mode (VITE_USE_MOCK_API=true) behaves like the API will, including the rules that matter:
   generic errors, single-use codes and links, and a server-side attempt limit.
   The limits in the forms are only a UX hint. The API enforces its own. */

import type { User } from '../store'
import { normEmail } from '../data/validate'
import { ApiError, MESSAGES, bootSession, endSession, isMock, request, setAccessToken, type MeDto } from './client'
import { Code, messageFor } from './errors'

const wait = (ms = 350) => new Promise<void>((r) => setTimeout(r, ms))

export type AccountType = 'individual' | 'business'

export const DEMO_USER: User = { name: 'Mahad Baig', email: 'mahad@acme.co', type: 'business', verified: true }

/** The browser's IANA time zone, sent at sign-up and shown on the form. */
export const browserTimeZone = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

const toUser = (m: MeDto): User => ({ name: m.name, email: m.email, type: m.type, verified: m.verified })

/** Sign-in and verify both answer { access, user }. The token goes to memory, the user to the caller. */
const startSession = (r: { access: string; user: MeDto }): User => { setAccessToken(r.access); return toUser(r.user) }

/* ---------- mock backend state (memory only) ---------- */
const DEMO_CODE = '246810'
const MAX_TRIES = 5
const tries = new Map<string, number>()
const usedCodes = new Set<string>()
const resetTokens = new Set<string>()
let resetCounter = 0
/** A tab-scoped, non-sensitive flag so a reload does not sign the demo user out. Real mode uses the cookie. */
const DEMO_FLAG = 'nudge.demo'
const flag = {
  get: () => { try { return sessionStorage.getItem(DEMO_FLAG) === '1' } catch { return false } },
  set: () => { try { sessionStorage.setItem(DEMO_FLAG, '1') } catch { /* ignore */ } },
  clear: () => { try { sessionStorage.removeItem(DEMO_FLAG) } catch { /* ignore */ } },
}
const hit = (key: string, apiCode: string = Code.RATE_LIMITED) => {
  const n = (tries.get(key) ?? 0) + 1; tries.set(key, n)
  if (n > MAX_TRIES) throw new ApiError(429, 'rate_limited', messageFor(apiCode, 429), { retryAfter: 30, apiCode })
}

export const auth = {
  /** Always the same error for a wrong email or a wrong password. */
  async login(input: { email: string; password: string; remember: boolean }): Promise<User> {
    if (!isMock) return startSession(await request<{ access: string; user: MeDto }>('/auth/login/', { method: 'POST', body: { email: normEmail(input.email), password: input.password, remember: input.remember } }))
    await wait()
    hit('login:' + normEmail(input.email))
    if (input.password.length < 6) throw new ApiError(401, 'bad_credentials', messageFor(Code.BAD_CREDENTIALS, 401), { apiCode: Code.BAD_CREDENTIALS })
    tries.delete('login:' + normEmail(input.email)); flag.set()
    return DEMO_USER
  },

  /** Social and SSO sign-in. Not built on the backend yet; the buttons are hidden in real mode. */
  async oauth(_provider: 'google' | 'microsoft' | 'sso'): Promise<User> {
    if (!isMock) throw new ApiError(0, 'invalid', MESSAGES.invalid)
    await wait(); flag.set(); return DEMO_USER
  },

  async register(input: { name: string; company?: string; email: string; password: string; type: AccountType }): Promise<void> {
    if (!isMock) {
      // company is left out for individual accounts; the backend refuses a non-empty one.
      await request('/auth/register/', { method: 'POST', body: { name: input.name, ...(input.type === 'business' ? { company: input.company } : {}), email: normEmail(input.email), password: input.password, type: input.type, timezone: browserTimeZone() } })
      return
    }
    await wait()
    usedCodes.delete(normEmail(input.email) + ':' + DEMO_CODE)
  },

  /** A code works once. A wrong or used code gets the same message. */
  async verifyEmail(input: { email: string; code: string }): Promise<User> {
    if (!isMock) return startSession(await request<{ access: string; user: MeDto }>('/auth/verify/', { method: 'POST', body: { email: normEmail(input.email), code: input.code } }))
    await wait()
    const key = normEmail(input.email)
    hit('verify:' + key, Code.CODE_ATTEMPTS_EXCEEDED)
    const used = usedCodes.has(key + ':' + input.code)
    if (input.code !== DEMO_CODE || used) throw new ApiError(400, 'invalid_code', messageFor(Code.INVALID_CODE, 400), { apiCode: Code.INVALID_CODE })
    usedCodes.add(key + ':' + input.code); tries.delete('verify:' + key); flag.set()
    return DEMO_USER
  },

  async resendCode(email: string): Promise<void> {
    if (!isMock) { await request('/auth/resend/', { method: 'POST', body: { email: normEmail(email) } }); return }
    await wait(); tries.delete('verify:' + normEmail(email)); usedCodes.delete(normEmail(email) + ':' + DEMO_CODE)
  },

  /** Resolves the same way for every address, so it cannot be used to find out who has an account. */
  async requestReset(email: string): Promise<{ demoToken?: string }> {
    if (!isMock) { await request('/auth/reset/', { method: 'POST', body: { email: normEmail(email) } }); return {} }
    await wait(); hit('reset:' + normEmail(email))
    const t = 'demo-' + ++resetCounter; resetTokens.add(t)
    return { demoToken: t }
  },

  /** A reset link works once. */
  async resetPassword(input: { token: string; password: string }): Promise<void> {
    if (!isMock) { await request('/auth/reset/confirm/', { method: 'POST', body: { token: input.token, password: input.password } }); return }
    await wait()
    if (!resetTokens.has(input.token)) throw new ApiError(400, 'invalid', messageFor(Code.INVALID_TOKEN, 400), { apiCode: Code.INVALID_TOKEN })
    resetTokens.delete(input.token)
  },

  async changePassword(input: { current: string; password: string }): Promise<void> {
    if (!isMock) { await request('/auth/password/', { method: 'POST', body: { current: input.current, password: input.password } }); return }
    await wait(); hit('change')
    if (input.current.length < 6) throw new ApiError(400, 'invalid', messageFor(Code.WRONG_CURRENT_PASSWORD, 400), { apiCode: Code.VALIDATION_FAILED, fieldCodes: { current: Code.WRONG_CURRENT_PASSWORD } })
    tries.delete('change')
  },

  /** App start: restore the session from the refresh cookie (one request, shared). Null when signed out, with no error. */
  async restore(): Promise<User | null> {
    if (!isMock) { const m = await bootSession(); return m ? toUser(m) : null }
    await wait(60)
    return flag.get() ? DEMO_USER : null
  },

  /** Who is signed in, or null. A 401 here is normal on a first visit, so it is not an error. */
  async me(): Promise<User | null> {
    if (!isMock) { try { return toUser(await request<MeDto>('/auth/me/')) } catch (e) { if (e instanceof ApiError && e.code === 'unauthorized') return null; throw e } }
    await wait(60)
    return flag.get() ? DEMO_USER : null
  },

  async logout(): Promise<void> {
    flag.clear()
    if (!isMock) {
      try { await request('/auth/logout/', { method: 'POST' }) } catch { /* the cookie is cleared server-side or it expires */ }
      endSession()
    }
  },

  /** Landing page demo link. Mock mode only. */
  startDemo(): User | null { if (!isMock) return null; flag.set(); return DEMO_USER },
}
