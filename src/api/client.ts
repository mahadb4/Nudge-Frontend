/* The only place that talks to the network.
   - The API is same-origin at /api/v1. In development Vite proxies it to Django, so cookies stay on one origin.
   - The session is an httpOnly refresh cookie. The access token lives in a module variable only: never in
     localStorage, sessionStorage or a cookie the page can read.
   - Unsafe methods send the CSRF token from GET /auth/csrf/ in X-CSRFToken. A stale token is replaced once.
   - A 401 on a normal call refreshes the session once and retries once; if that fails the user is signed out locally.
   - Refresh is single-flight (one request shared by all callers, one lock across tabs), because the backend burns
     the session when a refresh cookie is replayed.
   - Messages shown to people come from ./errors by body.code. Server text is never put on screen. */

import { CODE_SHAPE, Code, FIELD_SHAPE, MESSAGES, isCode, messageFor } from './errors'

declare global {
  interface ImportMetaEnv { readonly VITE_USE_MOCK_API?: string }
}

/** Public, non-secret. Only the exact word "true" turns the mock on. Real mode is the default. */
export const isMock = String(import.meta.env.VITE_USE_MOCK_API ?? '').trim().toLowerCase() === 'true'
export const API_BASE = '/api/v1'

export { MESSAGES }

export type ApiCode = 'network' | 'timeout' | 'unauthorized' | 'forbidden' | 'rate_limited' | 'not_found' | 'invalid' | 'server' | 'bad_credentials' | 'invalid_code'

export class ApiError extends Error {
  status: number
  code: ApiCode
  /** The backend's body.code (UPPER_SNAKE), or '' when there was none. Screens branch on this. */
  apiCode: string
  retryAfter?: number
  /** Field names the server rejected. Names only, never server text. */
  fields: string[]
  /** Per-field backend codes, e.g. { email: 'VALIDATION_EMAIL_INVALID' }. */
  fieldCodes: Record<string, string>
  constructor(status: number, code: ApiCode, message: string, extra: { retryAfter?: number; fields?: string[]; apiCode?: string; fieldCodes?: Record<string, string> } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status; this.code = code
    this.apiCode = extra.apiCode ?? ''
    this.retryAfter = extra.retryAfter
    this.fieldCodes = extra.fieldCodes ?? {}
    this.fields = extra.fields ?? Object.keys(this.fieldCodes)
  }
}

/** What the sign-in, verify and refresh calls return as `user`. Only what the app uses. */
export interface MeDto { name: string; email: string; type: 'individual' | 'business'; verified: boolean }

/* ---------------- session state (memory only) ---------------- */

let accessToken: string | null = null
let bootPromise: Promise<MeDto | null> | null = null

/** Memory only. A new token or none means any remembered boot result is stale. */
export const setAccessToken = (t: string | null) => { accessToken = t; bootPromise = null }

interface Handlers { onUnauthorized: () => void }
let handlers: Handlers = { onUnauthorized: () => {} }
export const setApiHandlers = (h: Handlers) => { handlers = h }

/** Sign out in this tab only: drop the token and tell the app. */
function signOutLocally() { setAccessToken(null); handlers.onUnauthorized() }
/** Quiet end of session (explicit logout). */
export const endSession = () => setAccessToken(null)

/* ---------------- low level ---------------- */

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Paths are written by us, never built from user text. This is a guard against a future slip. */
const PATH_OK = /^\/[A-Za-z0-9_\-./]*(\?[A-Za-z0-9_\-=&.]*)?$/

/** Calls where a 401 means "wrong input", not "token expired", so they never trigger a refresh. */
const NO_REFRESH = new Set(['/auth/csrf/', '/auth/register/', '/auth/verify/', '/auth/resend/', '/auth/login/', '/auth/refresh/', '/auth/logout/', '/auth/reset/', '/auth/reset/confirm/'])

export interface RequestOptions { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal; timeoutMs?: number }

interface Raw { status: number; body: unknown; headers: Headers }

const cookieCsrf = () => (typeof document === 'undefined' ? '' : document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))?.slice(10) ?? '')

async function http(path: string, method: string, headers: Record<string, string>, body: unknown, opts: RequestOptions): Promise<Raw> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 15000)
  opts.signal?.addEventListener('abort', () => ctl.abort(), { once: true })
  try {
    const res = await fetch(API_BASE + path, { method, headers, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal })
    return { status: res.status, body: await readJson(res), headers: res.headers }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new ApiError(0, opts.signal?.aborted ? 'network' : 'timeout', opts.signal?.aborted ? MESSAGES.network : MESSAGES.timeout)
    throw new ApiError(0, 'network', MESSAGES.network)
  } finally { clearTimeout(timer) }
}

async function readJson(res: Response): Promise<unknown> {
  if (!(res.headers.get('Content-Type') ?? '').includes('application/json')) return null
  try { return await res.json() } catch { return null }
}

const bodyCode = (body: unknown): string => {
  const c = body && typeof body === 'object' ? (body as { code?: unknown }).code : undefined
  return isCode(c) ? c : ''
}

/* ---------------- CSRF ---------------- */

let csrfToken = ''
let csrfPending: Promise<void> | null = null

/** GET /auth/csrf/ once; `force` fetches a new one (after a CSRF failure). Concurrent callers share one request. */
function loadCsrf(force = false): Promise<void> {
  if (!force && csrfToken) return Promise.resolve()
  if (!csrfPending) {
    csrfPending = (async () => {
      const r = await http('/auth/csrf/', 'GET', { Accept: 'application/json' }, undefined, {})
      const t = r.body && typeof r.body === 'object' ? (r.body as { csrf_token?: unknown }).csrf_token : undefined
      if (r.status >= 400) throw toError(r)
      csrfToken = typeof t === 'string' && t ? t : cookieCsrf()
    })().finally(() => { csrfPending = null })
  }
  return csrfPending
}

const isCsrfFailure = (r: Raw) => r.status === 403 && bodyCode(r.body) === Code.CSRF_FAILED

/** One HTTP exchange with the CSRF rules: a token before the first unsafe call, and one retry after a CSRF failure. */
async function exchange(path: string, method: string, body: unknown, opts: RequestOptions): Promise<Raw> {
  const unsafe = UNSAFE.has(method)
  const send = async () => {
    if (unsafe) await loadCsrf()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (unsafe && csrfToken) headers['X-CSRFToken'] = csrfToken
    if (accessToken) headers.Authorization = 'Bearer ' + accessToken
    return http(path, method, headers, body, opts)
  }
  let r = await send()
  if (unsafe && isCsrfFailure(r)) { await loadCsrf(true); r = await send() } // once, never more
  return r
}

/* ---------------- refresh (single-flight) ---------------- */

let inflight: Promise<MeDto | null> | null = null

/** Runs fn alone across tabs when the browser has Web Locks; otherwise just runs it (the in-tab promise still applies). */
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? (navigator as Navigator & { locks?: LockManager }).locks : undefined
  if (!locks || typeof locks.request !== 'function') return fn()
  return locks.request('nudge-refresh', fn) as Promise<T>
}

async function doRefresh(): Promise<MeDto | null> {
  const r = await exchange('/auth/refresh/', 'POST', undefined, {})
  if (r.status >= 200 && r.status < 300) {
    const b = r.body as { access?: unknown; user?: MeDto } | null
    if (!b || typeof b.access !== 'string' || !b.user) throw new ApiError(r.status, 'server', MESSAGES.server)
    accessToken = b.access // not setAccessToken: that would forget the boot result this call is producing
    return b.user
  }
  if (r.status === 401 || isCsrfFailure(r)) { accessToken = null; return null } // no session: normal on a first visit
  throw toError(r)
}

/** POST /auth/refresh/. Callers that overlap share one request. Resolves to the user, or null when there is no session. */
export function refreshSession(): Promise<MeDto | null> {
  if (!inflight) inflight = withLock(doRefresh).finally(() => { inflight = null })
  return inflight
}

/** Restore the session on app start. The result is kept, so React StrictMode's second mount sends no second request.
    A missing cookie (401) or any failure means "not signed in", quietly. */
export function bootSession(): Promise<MeDto | null> {
  if (!bootPromise) {
    const p: Promise<MeDto | null> = refreshSession().catch(() => null)
    bootPromise = p
  }
  return bootPromise
}

/* ---------------- errors ---------------- */

function toError(r: Raw): ApiError {
  const code = bodyCode(r.body)
  const retry = Number(r.headers.get('Retry-After'))
  const retryAfter = Number.isFinite(retry) && retry > 0 ? retry : undefined
  const message = messageFor(code, r.status)
  const fieldCodes: Record<string, string> = {}
  const f = r.body && typeof r.body === 'object' ? (r.body as { fields?: unknown }).fields : undefined
  if (f && typeof f === 'object' && !Array.isArray(f)) {
    for (const [k, list] of Object.entries(f as Record<string, unknown>).slice(0, 20)) {
      const first = Array.isArray(list) ? list[0] : undefined
      const c = first && typeof first === 'object' ? (first as { code?: unknown }).code : undefined
      if (FIELD_SHAPE.test(k) && typeof c === 'string' && CODE_SHAPE.test(c)) fieldCodes[k] = c
    }
  }
  const extra = { retryAfter, apiCode: code, fieldCodes }
  switch (r.status) {
    case 401: return new ApiError(401, code === Code.BAD_CREDENTIALS ? 'bad_credentials' : 'unauthorized', message, extra)
    case 403: return new ApiError(403, 'forbidden', message, extra)
    case 404: return new ApiError(404, 'not_found', message, extra)
    case 429: return new ApiError(429, 'rate_limited', message, extra)
    case 400: case 422: return new ApiError(r.status, code === Code.INVALID_CODE ? 'invalid_code' : 'invalid', message, extra)
    default: return new ApiError(r.status, 'server', message, extra)
  }
}

/* ---------------- public ---------------- */

export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (isMock) throw new ApiError(0, 'network', MESSAGES.network)
  if (!PATH_OK.test(path) || path.includes('..') || path.includes('//')) throw new ApiError(0, 'invalid', MESSAGES.invalid)
  const method = opts.method ?? 'GET'

  let r = await exchange(path, method, opts.body, opts)
  if (r.status === 401 && !NO_REFRESH.has(path.split('?')[0]!)) {
    // The access token is gone or expired: refresh once and retry once.
    let refreshed: MeDto | null = null
    try { refreshed = await refreshSession() } catch { refreshed = null }
    if (refreshed) r = await exchange(path, method, opts.body, opts)
    if (!refreshed || r.status === 401) { signOutLocally(); throw new ApiError(401, 'unauthorized', MESSAGES.unauthorized, { apiCode: Code.SESSION_INVALID }) }
  }
  if (r.status >= 200 && r.status < 300) return r.body as T
  throw toError(r)
}

/** What a person may read after a failed call. */
export const apiMessage = (e: unknown, fallback: string = MESSAGES.server): string => (e instanceof ApiError ? e.message : fallback)
