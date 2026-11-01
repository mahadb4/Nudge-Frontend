/* The only place that talks to the network.
   - Sessions are httpOnly cookies set by the Django API, so every call sends credentials: 'include'.
     The page never sees or stores the session. If the API moves to bearer tokens, keep the token in
     memory with setAccessToken() and never in localStorage or sessionStorage.
   - Unsafe methods send the CSRF token that Django puts in the csrftoken cookie.
   - Messages shown to people are fixed strings here. Server text is never put on screen. */

import { safeHref } from '../data/validate'

declare global {
  interface ImportMetaEnv { readonly VITE_API_URL?: string }
}

/** Public, non-secret. Empty means mock mode: no network calls are made. */
const RAW = String(import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')
export const API_BASE = RAW && safeHref(RAW).startsWith('http') ? RAW : ''
export const isMock = API_BASE === ''

export type ApiCode = 'network' | 'timeout' | 'unauthorized' | 'forbidden' | 'rate_limited' | 'not_found' | 'invalid' | 'server' | 'bad_credentials' | 'invalid_code'

export class ApiError extends Error {
  status: number
  code: ApiCode
  retryAfter?: number
  /** Field names the server rejected. Names only, never server text. */
  fields: string[]
  constructor(status: number, code: ApiCode, message: string, extra: { retryAfter?: number; fields?: string[] } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status; this.code = code
    this.retryAfter = extra.retryAfter; this.fields = extra.fields ?? []
  }
}

export const MESSAGES = {
  network: 'Nudge could not be reached. Check your connection and try again.',
  timeout: 'That took too long. Try again.',
  unauthorized: 'Your session has ended. Sign in again.',
  forbidden: 'You do not have access to that.',
  rate_limited: 'Too many attempts, try again later.',
  not_found: 'That could not be found.',
  invalid: 'Check the highlighted fields and try again.',
  server: 'Something went wrong on our side. Try again in a moment.',
} as const

let accessToken: string | null = null
/** Memory only. Cleared on sign-out and on 401. */
export const setAccessToken = (t: string | null) => { accessToken = t }

interface Handlers { onUnauthorized: () => void }
let handlers: Handlers = { onUnauthorized: () => {} }
export const setApiHandlers = (h: Handlers) => { handlers = h }

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const csrf = () => (typeof document === 'undefined' ? '' : document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))?.slice(10) ?? '')

/** Paths are written by us, never built from user text. This is a guard against a future slip. */
const PATH_OK = /^\/[A-Za-z0-9_\-./]*(\?[A-Za-z0-9_\-=&.]*)?$/

export interface RequestOptions { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown; signal?: AbortSignal; timeoutMs?: number }

export async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (isMock) throw new ApiError(0, 'network', MESSAGES.network)
  if (!PATH_OK.test(path) || path.includes('..') || path.includes('//')) throw new ApiError(0, 'invalid', MESSAGES.invalid)
  const method = opts.method ?? 'GET'
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 15000)
  opts.signal?.addEventListener('abort', () => ctl.abort(), { once: true })
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (UNSAFE.has(method)) { const t = csrf(); if (t) headers['X-CSRFToken'] = t }
  if (accessToken) headers.Authorization = 'Bearer ' + accessToken

  let res: Response
  try {
    res = await fetch(API_BASE + path, { method, headers, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'same-origin', body: opts.body === undefined ? undefined : JSON.stringify(opts.body), signal: ctl.signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new ApiError(0, opts.signal?.aborted ? 'network' : 'timeout', opts.signal?.aborted ? MESSAGES.network : MESSAGES.timeout)
    throw new ApiError(0, 'network', MESSAGES.network)
  } finally { clearTimeout(timer) }

  const body = await readJson(res)
  if (res.ok) return body as T

  const retry = Number(res.headers.get('Retry-After'))
  switch (res.status) {
    case 401: setAccessToken(null); handlers.onUnauthorized(); throw new ApiError(401, 'unauthorized', MESSAGES.unauthorized)
    case 403: throw new ApiError(403, 'forbidden', MESSAGES.forbidden)
    case 404: throw new ApiError(404, 'not_found', MESSAGES.not_found)
    case 429: throw new ApiError(429, 'rate_limited', MESSAGES.rate_limited, { retryAfter: Number.isFinite(retry) && retry > 0 ? retry : undefined })
    case 400: case 422: throw new ApiError(res.status, 'invalid', MESSAGES.invalid, { fields: fieldNames(body) })
    default: throw new ApiError(res.status, 'server', MESSAGES.server)
  }
}

async function readJson(res: Response): Promise<unknown> {
  if (!(res.headers.get('Content-Type') ?? '').includes('application/json')) return null
  try { return await res.json() } catch { return null }
}

/** DRF puts errors in { field: [..] }. Keep only the field names, and only plain identifiers. */
function fieldNames(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return []
  return Object.keys(body as Record<string, unknown>).filter((k) => /^[a-z_]{1,40}$/.test(k)).slice(0, 10)
}

/** What a person may read after a failed call. */
export const apiMessage = (e: unknown, fallback: string = MESSAGES.server): string => (e instanceof ApiError ? e.message : fallback)
