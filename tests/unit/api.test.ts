import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ErrLike = { code: string; apiCode: string; message: string; status: number; retryAfter?: number; fields: string[]; fieldCodes: Record<string, string> }
/** Tests only: a caught rejection is an ApiError. Typed loosely so each test can read .code, .status and .message. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asErr = (x: unknown): any => x as ErrLike

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
const err = (status: number, code: string, extra: Record<string, unknown> = {}) => json(status, { code, detail: 'SERVER TEXT must never be shown', ...extra })
const ME = { id: 'u1', name: 'Sara Ali', email: 'sara@x.com', type: 'business', verified: true }

async function loadClient(mock = false) {
  vi.resetModules(); vi.stubEnv('VITE_USE_MOCK_API', mock ? 'true' : '')
  return import('../../src/api/client')
}

type Init = RequestInit & { headers: Record<string, string> }

/** Routes by "METHOD path" so a test can say what each endpoint answers. Returns the fetch spy. */
function serve(routes: Record<string, (n: number) => Response>) {
  const count: Record<string, number> = {}
  const keyOf = (u: unknown, o: RequestInit) => (o.method ?? 'GET') + ' ' + String(u).replace('/api/v1', '')
  const f = vi.fn(async (url: string, init: RequestInit) => {
    const key = keyOf(url, init)
    count[key] = (count[key] ?? 0) + 1
    const h = routes[key]; if (!h) throw new Error('unexpected call ' + key)
    return h(count[key]!)
  })
  vi.stubGlobal('fetch', f)
  const calls = (key: string) => f.mock.calls.filter(([u, o]) => keyOf(u, o) === key).map(([, o]) => o as Init)
  return { f, calls, keys: () => f.mock.calls.map(([u, o]) => keyOf(u, o)) }
}
const csrfOk = (t = 'csrf-1') => () => json(200, { csrf_token: t })

describe('api client (real mode)', () => {
  const storage = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() }
  const cookieWrites: string[] = []
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage); vi.stubGlobal('sessionStorage', storage)
    cookieWrites.length = 0
    vi.stubGlobal('document', { get cookie() { return '' }, set cookie(v: string) { cookieWrites.push(v) } })
    vi.stubGlobal('navigator', {})
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); storage.setItem.mockClear() })

  it('real mode is the default and uses the same-origin /api/v1', async () => {
    const c = await loadClient(); expect(c.isMock).toBe(false); expect(c.API_BASE).toBe('/api/v1')
    expect((await loadClient(true)).isMock).toBe(true)
  })

  it('sends cookies, never caches, refuses redirects; GET needs no CSRF; the first POST fetches it once and sends it every time', async () => {
    const c = await loadClient()
    const s = serve({ 'GET /auth/csrf/': csrfOk('tok-A'), 'GET /deals/': () => json(200, { ok: 1 }), 'POST /deals/': () => json(200, { ok: 1 }) })
    await c.request('/deals/'); expect(s.keys()).toEqual(['GET /deals/'])
    await c.request('/deals/', { method: 'POST', body: { a: 1 } }); await c.request('/deals/', { method: 'POST', body: { a: 2 } })
    expect(s.keys()).toEqual(['GET /deals/', 'GET /auth/csrf/', 'POST /deals/', 'POST /deals/'])
    const o = s.calls('POST /deals/')[0]!
    expect(o.credentials).toBe('include'); expect(o.cache).toBe('no-store'); expect(o.redirect).toBe('error')
    expect(o.headers['X-CSRFToken']).toBe('tok-A'); expect(o.headers['Content-Type']).toBe('application/json'); expect(o.body).toBe('{"a":1}')
    expect(s.calls('POST /deals/')[1]!.headers['X-CSRFToken']).toBe('tok-A')
  })

  it('a stale CSRF token: fetch a new one and retry that POST once', async () => {
    const c = await loadClient()
    const s = serve({ 'GET /auth/csrf/': (n) => json(200, { csrf_token: 'tok-' + n }), 'POST /deals/': (n) => (n === 1 ? err(403, 'AUTH_CSRF_FAILED') : json(200, { ok: 1 })) })
    await expect(c.request('/deals/', { method: 'POST', body: {} })).resolves.toEqual({ ok: 1 })
    expect(s.keys()).toEqual(['GET /auth/csrf/', 'POST /deals/', 'GET /auth/csrf/', 'POST /deals/'])
    expect(s.calls('POST /deals/')[1]!.headers['X-CSRFToken']).toBe('tok-2')
  })
  it('a CSRF failure is retried once and never more', async () => {
    const c = await loadClient()
    const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /deals/': () => err(403, 'AUTH_CSRF_FAILED') })
    const e = (await c.request('/deals/', { method: 'POST', body: {} }).catch(asErr)) as ErrLike
    expect(e.apiCode).toBe('AUTH_CSRF_FAILED'); expect(e.status).toBe(403)
    expect(s.calls('POST /deals/')).toHaveLength(2); expect(s.calls('GET /auth/csrf/')).toHaveLength(2)
  })

  it('a 401 refreshes once, then retries the call once with the new token', async () => {
    const c = await loadClient(); c.setAccessToken('old')
    const s = serve({
      'GET /auth/csrf/': csrfOk(), 'POST /auth/refresh/': () => json(200, { access: 'new', user: ME }),
      'GET /deals/': (n) => (n === 1 ? err(401, 'AUTH_ACCESS_TOKEN_INVALID') : json(200, { ok: 1 })),
    })
    await expect(c.request('/deals/')).resolves.toEqual({ ok: 1 })
    expect(s.calls('POST /auth/refresh/')).toHaveLength(1); expect(s.calls('GET /deals/')).toHaveLength(2)
    expect(s.calls('GET /deals/')[0]!.headers.Authorization).toBe('Bearer old')
    expect(s.calls('GET /deals/')[1]!.headers.Authorization).toBe('Bearer new')
  })
  it('only one retry: a second 401 signs out locally', async () => {
    const c = await loadClient(); const onUnauthorized = vi.fn(); c.setApiHandlers({ onUnauthorized }); c.setAccessToken('old')
    const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/refresh/': () => json(200, { access: 'new', user: ME }), 'GET /deals/': () => err(401, 'AUTH_ACCESS_TOKEN_INVALID') })
    const e = (await c.request('/deals/').catch(asErr)) as ErrLike
    expect(e.code).toBe('unauthorized'); expect(onUnauthorized).toHaveBeenCalledOnce()
    expect(s.calls('GET /deals/')).toHaveLength(2); expect(s.calls('POST /auth/refresh/')).toHaveLength(1)
  })
  it('when the refresh fails the user is signed out locally, the token is dropped and nothing is retried', async () => {
    const c = await loadClient(); const onUnauthorized = vi.fn(); c.setApiHandlers({ onUnauthorized }); c.setAccessToken('old')
    const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/refresh/': () => err(401, 'AUTH_SESSION_INVALID'), 'GET /deals/': () => err(401, 'AUTH_ACCESS_TOKEN_INVALID'), 'GET /x/': () => json(200, {}) })
    const e = (await c.request('/deals/').catch(asErr)) as ErrLike
    expect(e.code).toBe('unauthorized'); expect(e.message).toBe(c.MESSAGES.unauthorized); expect(e.message).not.toContain('SERVER TEXT')
    expect(onUnauthorized).toHaveBeenCalledOnce(); expect(s.calls('GET /deals/')).toHaveLength(1)
    await c.request('/x/'); expect(s.calls('GET /x/')[0]!.headers.Authorization).toBeUndefined()
  })
  it('a wrong password (401 on login) is not an expired token: no refresh, no sign-out', async () => {
    const c = await loadClient(); const onUnauthorized = vi.fn(); c.setApiHandlers({ onUnauthorized })
    const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/login/': () => err(401, 'AUTH_BAD_CREDENTIALS') })
    const e = (await c.request('/auth/login/', { method: 'POST', body: {} }).catch(asErr)) as ErrLike
    expect(e.code).toBe('bad_credentials'); expect(e.apiCode).toBe('AUTH_BAD_CREDENTIALS'); expect(e.message).toBe('That email and password do not match.')
    expect(onUnauthorized).not.toHaveBeenCalled(); expect(s.keys()).not.toContain('POST /auth/refresh/')
  })

  it('refresh is single-flight: three calls that need it at once send one refresh', async () => {
    const c = await loadClient(); c.setAccessToken('old')
    let release!: () => void; const gate = new Promise<void>((r) => { release = r })
    const f = vi.fn(async (url: string, init: RequestInit) => {
      const key = (init.method ?? 'GET') + ' ' + String(url).replace('/api/v1', '')
      if (key === 'GET /auth/csrf/') return json(200, { csrf_token: 't' })
      if (key === 'POST /auth/refresh/') { await gate; return json(200, { access: 'new', user: ME }) }
      return (init as Init).headers.Authorization === 'Bearer new' ? json(200, { ok: key }) : err(401, 'AUTH_ACCESS_TOKEN_INVALID')
    })
    vi.stubGlobal('fetch', f)
    const all = Promise.all([c.request('/a/'), c.request('/b/'), c.request('/c/')])
    await vi.waitFor(() => expect(f.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh/'))).toHaveLength(1))
    release(); await all
    expect(f.mock.calls.filter(([u]) => String(u).endsWith('/auth/refresh/'))).toHaveLength(1)
  })
  it('restoring the session on start sends one refresh even when the effect runs twice (StrictMode)', async () => {
    const c = await loadClient()
    const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/refresh/': () => json(200, { access: 'tok', user: ME }) })
    const [a, b] = await Promise.all([c.bootSession(), c.bootSession()]); const again = await c.bootSession()
    expect(a).toEqual(ME); expect(b).toEqual(ME); expect(again).toEqual(ME)
    expect(s.calls('POST /auth/refresh/')).toHaveLength(1)
  })
  it('a first visit with no cookie: the boot refresh 401 means "not signed in", quietly, with no retry', async () => {
    const c = await loadClient(); const onUnauthorized = vi.fn(); c.setApiHandlers({ onUnauthorized })
    const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/refresh/': () => err(401, 'AUTH_SESSION_INVALID') })
    expect(await c.bootSession()).toBeNull(); expect(await c.bootSession()).toBeNull()
    expect(s.calls('POST /auth/refresh/')).toHaveLength(1); expect(onUnauthorized).not.toHaveBeenCalled()
  })
  it('a network failure while restoring is also "not signed in", not a crash', async () => {
    const c = await loadClient(); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    expect(await c.bootSession()).toBeNull()
  })
  it('without Web Locks the in-tab single-flight still works and nothing crashes', async () => {
    const c = await loadClient()
    const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/refresh/': () => json(200, { access: 'tok', user: ME }) })
    const [a, b] = await Promise.all([c.refreshSession(), c.refreshSession()])
    expect(a).toEqual(ME); expect(b).toEqual(ME); expect(s.calls('POST /auth/refresh/')).toHaveLength(1)
  })
  it('with Web Locks the refresh runs inside the shared lock', async () => {
    const request = vi.fn((_name: string, fn: () => Promise<unknown>) => fn()); vi.stubGlobal('navigator', { locks: { request } })
    const c = await loadClient(); serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/refresh/': () => json(200, { access: 'tok', user: ME }) })
    await c.refreshSession(); expect(request).toHaveBeenCalledOnce(); expect(request.mock.calls[0]![0]).toBe('nudge-refresh')
  })

  it('the access token lives in memory only: no storage and no cookie is written', async () => {
    const c = await loadClient()
    const { auth } = await import('../../src/api/auth')
    serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/login/': () => json(200, { access: 'SECRET-JWT', user: ME }), 'POST /auth/refresh/': () => json(200, { access: 'SECRET-2', user: ME }), 'GET /x/': () => json(200, {}) })
    await auth.login({ email: 'a@x.com', password: 'pw', remember: true }); await c.refreshSession(); await c.request('/x/')
    expect(storage.setItem).not.toHaveBeenCalled(); expect(cookieWrites).toEqual([])
    c.setAccessToken(null)
  })
  it('the bearer token is sent from memory and dropped when cleared', async () => {
    const c = await loadClient(); const s = serve({ 'GET /x/': () => json(200, {}) })
    c.setAccessToken('mem-token'); await c.request('/x/'); c.setAccessToken(null); await c.request('/x/')
    expect(s.calls('GET /x/')[0]!.headers.Authorization).toBe('Bearer mem-token')
    expect(s.calls('GET /x/')[1]!.headers.Authorization).toBeUndefined()
  })

  it('errors are mapped by body.code, never by the server text', async () => {
    const c = await loadClient(); const codes: Array<[string, number, string]> = [
      ['AUTH_EMAIL_UNVERIFIED', 403, 'Verify your email first. Check your inbox for the code.'],
      ['AUTH_INVALID_CODE', 400, 'That code is not valid or has expired.'],
      ['AUTH_CODE_ATTEMPTS_EXCEEDED', 429, 'Too many wrong codes. Send a new code to try again.'],
      ['AUTH_INVALID_TOKEN', 400, 'This link is not valid or has expired. Ask for a new one.'],
      ['SOMETHING_NEW_FROM_SERVER', 400, c.MESSAGES.invalid], ['SOMETHING_NEW_FROM_SERVER', 500, c.MESSAGES.server],
    ]
    for (const [code, status, text] of codes) {
      serve({ 'GET /auth/csrf/': csrfOk(), 'POST /x/': () => err(status, code) })
      const e = (await c.request('/x/', { method: 'POST', body: {} }).catch(asErr)) as ErrLike
      expect(e.apiCode).toBe(code); expect(e.message).toBe(text); expect(e.message).not.toContain('SERVER TEXT')
    }
    const { Code } = await import('../../src/api/errors'); expect(Code.BAD_CREDENTIALS).toBe('AUTH_BAD_CREDENTIALS')
  })
  it('400 reads body.fields: field names and field codes only, odd keys and odd codes dropped', async () => {
    const c = await loadClient(); const { fieldMessages } = await import('../../src/api/errors')
    serve({ 'GET /auth/csrf/': csrfOk(), 'POST /x/': () => err(400, 'COMMON_VALIDATION_FAILED', { fields: {
      email: [{ code: 'VALIDATION_EMAIL_INVALID', detail: '<script>alert(1)</script>' }], 'bad key!': [{ code: 'VALIDATION_REQUIRED' }], password: [{ code: 'VALIDATION_PASSWORD_TOO_COMMON' }], name: [{ code: 'lower case', detail: 'x' }], current: [{ code: 'AUTH_WRONG_CURRENT_PASSWORD' }],
    } }) })
    const e = (await c.request('/x/', { method: 'POST', body: {} }).catch(asErr)) as ErrLike
    expect(e.apiCode).toBe('COMMON_VALIDATION_FAILED'); expect(e.message).toBe(c.MESSAGES.invalid)
    expect(e.fields).toEqual(['email', 'password', 'current'])
    expect(fieldMessages(e)).toEqual({ email: 'Enter a valid email address.', password: 'That password is too common.', current: 'Your current password is not right.' })
  })
  it('top-level keys are ignored; an unknown field code gets a neutral message', async () => {
    const c = await loadClient(); const { fieldMessages } = await import('../../src/api/errors')
    serve({ 'GET /auth/csrf/': csrfOk(), 'POST /x/': () => json(400, { email: ['old style'], code: 'COMMON_VALIDATION_FAILED', fields: { email: [{ code: 'VALIDATION_FROM_THE_FUTURE' }] } }) })
    const e = (await c.request('/x/', { method: 'POST', body: {} }).catch(asErr)) as ErrLike
    expect(fieldMessages(e)).toEqual({ email: 'Check this field.' })
  })
  it('429 keeps Retry-After; 403 and 5xx and non-JSON bodies give fixed messages', async () => {
    const c = await loadClient()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(429, { code: 'COMMON_RATE_LIMITED' }, { 'Retry-After': '30' })))
    let e = (await c.request('/a/').catch(asErr)) as ErrLike; expect(e.code).toBe('rate_limited'); expect(e.retryAfter).toBe(30); expect(e.message).toBe('Too many attempts, try again later.')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(err(403, 'COMMON_FORBIDDEN')))
    e = (await c.request('/a/').catch(asErr)) as ErrLike; expect(e.code).toBe('forbidden'); expect(e.message).toBe(c.MESSAGES.forbidden)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Traceback (most recent call last)', { status: 500 })))
    e = (await c.request('/a/').catch(asErr)) as ErrLike; expect(e.code).toBe('server'); expect(e.message).toBe(c.MESSAGES.server); expect(e.message).not.toContain('Traceback')
  })
  it('a network failure is a friendly error', async () => {
    const c = await loadClient(); vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const e = (await c.request('/x/').catch(asErr)) as ErrLike; expect(e.code).toBe('network'); expect(e.message).toBe(c.MESSAGES.network)
  })
  it('a slow request times out', async () => {
    const c = await loadClient()
    vi.stubGlobal('fetch', vi.fn((_u: string, o: RequestInit) => new Promise((_r, rej) => o.signal?.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))))))
    const e = (await c.request('/x/', { timeoutMs: 20 }).catch(asErr)) as ErrLike; expect(e.code).toBe('timeout')
  })
  it('only same-API relative paths are allowed', async () => {
    const c = await loadClient(); const f = vi.fn(); vi.stubGlobal('fetch', f)
    for (const p of ['//evil.com/x', 'https://evil.com/x', '/a/../b', 'javascript:alert(1)', '/a b', '/x?<script>']) { const e = (await c.request(p).catch(asErr)) as ErrLike; expect(e.code).toBe('invalid') }
    expect(f).not.toHaveBeenCalled()
  })
})

describe('auth calls (real mode)', () => {
  beforeEach(() => { vi.stubGlobal('document', { cookie: '' }); vi.stubGlobal('navigator', {}); vi.resetModules(); vi.stubEnv('VITE_USE_MOCK_API', '') })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
  const body = (s: ReturnType<typeof serve>, key: string, i = 0) => JSON.parse(String(s.calls(key)[i]!.body))

  it('sign-up sends the lowercase type and the browser time zone; individual accounts send no company', async () => {
    const { auth } = await import('../../src/api/auth')
    const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/register/': () => json(202, { code: 'AUTH_CODE_SENT' }) })
    await auth.register({ name: 'Sara Ali', company: 'Acme', email: ' Sara@X.com ', password: 'Tr1cky-Horse', type: 'business' })
    await auth.register({ name: 'Sara Ali', company: undefined, email: 'sara@x.com', password: 'Tr1cky-Horse', type: 'individual' })
    const a = body(s, 'POST /auth/register/'); const b = body(s, 'POST /auth/register/', 1)
    expect(a).toMatchObject({ name: 'Sara Ali', company: 'Acme', email: 'sara@x.com', type: 'business' }); expect(a.timezone).toMatch(/\S/)
    expect(b.type).toBe('individual'); expect('company' in b).toBe(false); expect(b.timezone).toMatch(/\S/)
  })
  it('login sends remember; the user comes back in the app shape with a lowercase type', async () => {
    const { auth } = await import('../../src/api/auth')
    const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/login/': () => json(200, { access: 'a', user: ME }) })
    const u = await auth.login({ email: 'Sara@X.com', password: 'pw', remember: false })
    expect(body(s, 'POST /auth/login/')).toEqual({ email: 'sara@x.com', password: 'pw', remember: false })
    expect(u).toEqual({ name: 'Sara Ali', email: 'sara@x.com', type: 'business', verified: true })
  })
  it('logout calls the API and drops the token', async () => {
    const { auth } = await import('../../src/api/auth'); const c = await import('../../src/api/client')
    c.setAccessToken('t'); const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/logout/': () => new Response(null, { status: 204 }), 'GET /x/': () => json(200, {}) })
    await auth.logout(); await c.request('/x/')
    expect(s.calls('POST /auth/logout/')).toHaveLength(1); expect(s.calls('GET /x/')[0]!.headers.Authorization).toBeUndefined()
  })
  it('reset, reset/confirm, password change and resend use the contract paths and bodies', async () => {
    const { auth } = await import('../../src/api/auth')
    const s = serve({ 'GET /auth/csrf/': csrfOk(), 'POST /auth/reset/': () => json(202, {}), 'POST /auth/reset/confirm/': () => new Response(null, { status: 204 }), 'POST /auth/password/': () => new Response(null, { status: 204 }), 'POST /auth/resend/': () => json(202, {}) })
    await auth.requestReset('A@x.com'); await auth.resetPassword({ token: 'abc-123', password: 'Tr1cky-Horse' }); await auth.changePassword({ current: 'old', password: 'Tr1cky-Horse' }); await auth.resendCode('A@x.com')
    expect(body(s, 'POST /auth/reset/')).toEqual({ email: 'a@x.com' }); expect(body(s, 'POST /auth/reset/confirm/')).toEqual({ token: 'abc-123', password: 'Tr1cky-Horse' })
    expect(body(s, 'POST /auth/password/')).toEqual({ current: 'old', password: 'Tr1cky-Horse' }); expect(body(s, 'POST /auth/resend/')).toEqual({ email: 'a@x.com' })
  })
})

describe('auth rules (mock mode)', () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_USE_MOCK_API', 'true') })
  afterEach(() => vi.unstubAllEnvs())
  const load = () => import('../../src/api/auth')

  it('a wrong email and a wrong password give the same message', async () => {
    const { auth } = await load()
    const a = await auth.login({ email: 'nobody@x.com', password: 'abc', remember: false }).catch(asErr)
    const b = await auth.login({ email: 'mahad@acme.com', password: 'abc', remember: false }).catch(asErr)
    expect(a.message).toBe('That email and password do not match.'); expect(b.message).toBe(a.message); expect(a.status).toBe(401)
  })
  it('login is rate limited by the server after 5 bad tries', async () => {
    const { auth } = await load(); let last: Partial<ErrLike> = {}
    for (let i = 0; i < 6; i++) last = await auth.login({ email: 'a@x.com', password: 'x', remember: false }).catch(asErr)
    expect(last.status).toBe(429); expect(last.code).toBe('rate_limited')
  })
  it('a verification code works once, and a wrong code gets a generic message', async () => {
    const { auth } = await load()
    const bad = await auth.verifyEmail({ email: 'a@x.com', code: '000000' }).catch(asErr); expect(bad.message).toBe('That code is not valid or has expired.')
    const user = await auth.verifyEmail({ email: 'a@x.com', code: '246810' }); expect(user.verified).toBe(true)
    const again = await auth.verifyEmail({ email: 'a@x.com', code: '246810' }).catch(asErr); expect(again.message).toBe(bad.message)
  })
  it('verify locks after 5 wrong codes, even for the right code', async () => {
    const { auth } = await load()
    for (let i = 0; i < 5; i++) await auth.verifyEmail({ email: 'z@x.com', code: '111111' }).catch(() => {})
    const e = await auth.verifyEmail({ email: 'z@x.com', code: '246810' }).catch(asErr); expect(e.status).toBe(429)
  })
  it('reset answers every address the same way, and a link works once', async () => {
    const { auth } = await load()
    const a = await auth.requestReset('real@acme.com'); const b = await auth.requestReset('ghost@nowhere.com')
    expect(Object.keys(a)).toEqual(Object.keys(b))
    await auth.resetPassword({ token: a.demoToken!, password: 'Tr1cky-Horse' })
    const again = await auth.resetPassword({ token: a.demoToken!, password: 'Tr1cky-Horse' }).catch(asErr); expect(again.message).toMatch(/not valid or has expired/)
    const forged = await auth.resetPassword({ token: 'demo-999', password: 'Tr1cky-Horse' }).catch(asErr); expect(forged.message).toBe(again.message)
  })
  it('logout clears the demo flag and me() is then null', async () => { const { auth } = await load(); await auth.logout(); expect(await auth.me()).toBeNull() })
})

describe('sign-out clears the in-memory store', () => {
  it('hydrate fills it, clear empties every private list and keeps only the theme', async () => {
    vi.resetModules()
    const s = await import('../../src/store'); const { DEMO_USER } = await import('../../src/api/auth')
    expect(s.getState().deals).toHaveLength(0); expect(s.hasSession()).toBe(false)
    s.hydrateWorkspace(DEMO_USER)
    expect(s.hasSession()).toBe(true); expect(s.getState().deals.length).toBe(13); expect(s.getState().contacts.length).toBe(12)
    s.setSettings({ theme: 'dark' }); s.toast('Approved for Sara Ali'); s.clearWorkspace()
    const st = s.getState()
    expect(s.hasSession()).toBe(false); expect(st.user).toBeNull()
    for (const k of ['deals', 'contacts', 'companies', 'reviews', 'followups', 'threads', 'templates', 'facts', 'mailboxes', 'members', 'audit', 'events', 'toasts', 'approvedToday'] as const) expect(st[k]).toHaveLength(0)
    expect(st.settings.theme).toBe('dark')
  })
  it('refuses to approve to an opted-out contact, an empty draft, or twice', async () => {
    vi.resetModules()
    const s = await import('../../src/store'); const { DEMO_USER } = await import('../../src/api/auth'); s.hydrateWorkspace(DEMO_USER)
    s.setReviewDraft('r1', '   '); s.approveReview('r1'); expect(s.getState().reviews.find((r) => r.id === 'r1')!.status).toBe('pending')
    s.setReviewDraft('r1', 'Thursday works.'); s.approveReview('r1'); s.approveReview('r1')
    expect(s.getState().settings.approvals).toBe(33)
    s.setState((x) => ({ contacts: x.contacts.map((c) => (c.id === 'p2' ? { ...c, status: 'Opted out' as const } : c)) })); s.approveReview('r2')
    expect(s.getState().reviews.find((r) => r.id === 'r2')!.status).toBe('pending')
  })
})
