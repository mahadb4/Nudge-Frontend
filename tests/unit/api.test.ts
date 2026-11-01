import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type ErrLike = { code: string; message: string; status: number; retryAfter?: number; fields: string[] }
/** Tests only: a caught rejection is an ApiError. Typed loosely so each test can read .code, .status and .message. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asErr = (x: unknown): any => x as ErrLike

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

async function loadClient(url = 'https://api.nudge.test') {
  vi.resetModules(); vi.stubEnv('VITE_API_URL', url)
  return import('../../src/api/client')
}

describe('api client (real mode)', () => {
  const storage = { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() }
  beforeEach(() => {
    vi.stubGlobal('localStorage', storage); vi.stubGlobal('sessionStorage', storage)
    vi.stubGlobal('document', { cookie: 'a=1; csrftoken=tok123; b=2' })
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); storage.setItem.mockClear() })

  it('sends cookies, never caches, refuses redirects, and adds the CSRF header only on unsafe methods', async () => {
    const c = await loadClient(); const f = vi.fn().mockResolvedValue(json(200, { ok: 1 })); vi.stubGlobal('fetch', f)
    await c.request('/deals/'); await c.request('/deals/', { method: 'POST', body: { a: 1 } })
    const [u1, o1] = f.mock.calls[0]; const [, o2] = f.mock.calls[1]
    expect(u1).toBe('https://api.nudge.test/deals/')
    expect(o1.credentials).toBe('include'); expect(o1.cache).toBe('no-store'); expect(o1.redirect).toBe('error'); expect(o1.headers['X-CSRFToken']).toBeUndefined()
    expect(o2.headers['X-CSRFToken']).toBe('tok123'); expect(o2.headers['Content-Type']).toBe('application/json'); expect(o2.body).toBe('{"a":1}')
  })
  it('401 clears the token, calls the sign-in handler and throws a fixed message', async () => {
    const c = await loadClient(); const onUnauthorized = vi.fn(); c.setApiHandlers({ onUnauthorized }); c.setAccessToken('secret')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { detail: 'Token abc expired for ali@x.com' })))
    const e = (await c.request('/me/').catch(asErr)) as ErrLike
    expect(onUnauthorized).toHaveBeenCalledOnce(); expect(e.code).toBe('unauthorized'); expect(e.message).toBe(c.MESSAGES.unauthorized)
    expect(e.message).not.toContain('abc'); expect(e.message).not.toContain('ali@x.com')
  })
  it('403 is a fixed message', async () => {
    const c = await loadClient(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(403, { detail: 'Workspace 42 belongs to someone else' })))
    const e = (await c.request('/deals/42/').catch(asErr)) as ErrLike; expect(e.code).toBe('forbidden'); expect(e.message).toBe(c.MESSAGES.forbidden)
  })
  it('429 says "Too many attempts, try again later." and keeps Retry-After', async () => {
    const c = await loadClient(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(429, {}, { 'Retry-After': '30' })))
    const e = (await c.request('/auth/login/', { method: 'POST', body: {} }).catch(asErr)) as ErrLike
    expect(e.code).toBe('rate_limited'); expect(e.message).toBe('Too many attempts, try again later.'); expect(e.retryAfter).toBe(30)
  })
  it('400 keeps field names only, never server text', async () => {
    const c = await loadClient(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, { email: ['<script>alert(1)</script>'], 'bad key!': ['x'], password: ['too short'] })))
    const e = (await c.request('/x/', { method: 'POST', body: {} }).catch(asErr)) as ErrLike
    expect(e.fields).toEqual(['email', 'password']); expect(e.message).toBe(c.MESSAGES.invalid)
  })
  it('5xx and non-JSON bodies give the generic server message', async () => {
    const c = await loadClient(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Traceback (most recent call last)', { status: 500 })))
    const e = (await c.request('/x/').catch(asErr)) as ErrLike; expect(e.code).toBe('server'); expect(e.message).toBe(c.MESSAGES.server); expect(e.message).not.toContain('Traceback')
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
  it('the bearer token lives in memory only', async () => {
    const c = await loadClient(); const f = vi.fn().mockResolvedValue(json(200, {})); vi.stubGlobal('fetch', f)
    c.setAccessToken('mem-token'); await c.request('/x/'); expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer mem-token')
    expect(storage.setItem).not.toHaveBeenCalled()
    c.setAccessToken(null); await c.request('/x/'); expect(f.mock.calls[1][1].headers.Authorization).toBeUndefined()
  })
  it('a hostile API address is ignored and mock mode stays on', async () => {
    for (const u of ['javascript:alert(1)', 'data:text/html,x', 'ftp://x.com', 'not a url']) { const c = await loadClient(u); expect(c.isMock).toBe(true); expect(c.API_BASE).toBe('') }
    const c = await loadClient('https://api.nudge.test/'); expect(c.API_BASE).toBe('https://api.nudge.test')
  })
})

describe('auth rules (mock mode)', () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv('VITE_API_URL', '') })
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
