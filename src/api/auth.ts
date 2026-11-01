/* Auth endpoints. In mock mode (no VITE_API_URL) these behave like the Django API will, including the
   rules that matter: generic errors, single-use codes and links, and a server-side attempt limit.
   The limits in the forms are only a UX hint. The API must enforce its own. */

import type { User } from '../store'
import { normEmail } from '../data/validate'
import { ApiError, MESSAGES, isMock, request } from './client'

const wait = (ms = 350) => new Promise<void>((r) => setTimeout(r, ms))

export const DEMO_USER: User = { name: 'Mahad Baig', email: 'mahad@acme.co', type: 'Business', verified: true }

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
const hit = (key: string) => {
  const n = (tries.get(key) ?? 0) + 1; tries.set(key, n)
  if (n > MAX_TRIES) throw new ApiError(429, 'rate_limited', MESSAGES.rate_limited, { retryAfter: 30 })
}

export const auth = {
  /** Always the same error for a wrong email or a wrong password. */
  async login(input: { email: string; password: string; remember: boolean }): Promise<User> {
    if (!isMock) return request<User>('/auth/login/', { method: 'POST', body: { email: normEmail(input.email), password: input.password, remember: input.remember } })
    await wait()
    hit('login:' + normEmail(input.email))
    if (input.password.length < 6) throw new ApiError(401, 'bad_credentials', 'That email and password do not match.')
    tries.delete('login:' + normEmail(input.email)); flag.set()
    return DEMO_USER
  },

  /** Social and SSO sign-in. Real mode redirects to the provider, so there is nothing to do in the page. */
  async oauth(_provider: 'google' | 'microsoft' | 'sso'): Promise<User> {
    if (!isMock) throw new ApiError(0, 'invalid', MESSAGES.invalid)
    await wait(); flag.set(); return DEMO_USER
  },

  async register(input: { name: string; company?: string; email: string; password: string; type: 'Individual' | 'Business' }): Promise<void> {
    if (!isMock) return request('/auth/register/', { method: 'POST', body: { ...input, email: normEmail(input.email) } })
    await wait()
    usedCodes.delete(normEmail(input.email) + ':' + DEMO_CODE)
  },

  /** A code works once. A wrong or used code gets the same message. */
  async verifyEmail(input: { email: string; code: string }): Promise<User> {
    if (!isMock) return request<User>('/auth/verify/', { method: 'POST', body: { email: normEmail(input.email), code: input.code } })
    await wait()
    const key = normEmail(input.email)
    hit('verify:' + key)
    const used = usedCodes.has(key + ':' + input.code)
    if (input.code !== DEMO_CODE || used) throw new ApiError(400, 'invalid_code', 'That code is not valid or has expired.')
    usedCodes.add(key + ':' + input.code); tries.delete('verify:' + key); flag.set()
    return DEMO_USER
  },

  async resendCode(email: string): Promise<void> {
    if (!isMock) return request('/auth/resend/', { method: 'POST', body: { email: normEmail(email) } })
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
    if (!isMock) return request('/auth/reset/confirm/', { method: 'POST', body: input })
    await wait()
    if (!resetTokens.has(input.token)) throw new ApiError(400, 'invalid', 'This link is not valid or has expired. Ask for a new one.')
    resetTokens.delete(input.token)
  },

  async changePassword(input: { current: string; password: string }): Promise<void> {
    if (!isMock) return request('/auth/password/', { method: 'POST', body: input })
    await wait(); hit('change')
    if (input.current.length < 6) throw new ApiError(400, 'invalid', 'Your current password is not right.')
    tries.delete('change')
  },

  /** Who is signed in, or null. A 401 here is normal on a first visit, so it is not an error. */
  async me(): Promise<User | null> {
    if (!isMock) { try { return await request<User>('/auth/me/') } catch (e) { if (e instanceof ApiError && e.code === 'unauthorized') return null; throw e } }
    await wait(60)
    return flag.get() ? DEMO_USER : null
  },

  async logout(): Promise<void> {
    flag.clear()
    if (!isMock) { try { await request('/auth/logout/', { method: 'POST' }) } catch { /* the cookie is cleared server-side or it expires */ } }
  },

  /** Landing page demo link. Mock mode only. */
  startDemo(): User | null { if (!isMock) return null; flag.set(); return DEMO_USER },
}
