// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const P1 = 'a0000000-0000-4000-8000-000000000001'
const P2 = 'a0000000-0000-4000-8000-000000000002'
const C1 = 'c0000000-0000-4000-8000-000000000001'
const NEW = 'a0000000-0000-4000-8000-0000000000aa'
const json = (status: number, body: unknown) => new Response(body === null ? null : JSON.stringify(body), { status, headers: body === null ? {} : { 'Content-Type': 'application/json' } })

interface Ct { id: string; first_name: string; last_name: string | null; name: string; email: string; phone: string | null; title: string | null; company: { id: string; name: string } | null; owner: { id: string; name: string }; visibility: string; team_id: null; status: 'active' | 'opted_out'; opted_out_at: string | null; source: string; last_contact_at: string | null; created_at: string; updated_at: string }
const ct = (id: string, first: string, last: string | null, extra: Partial<Ct> = {}): Ct => ({
  id, first_name: first, last_name: last, name: [first, last].filter(Boolean).join(' '), email: first.toLowerCase() + '@x.com', phone: '+923005550142', title: 'CTO', company: { id: C1, name: 'Acme' },
  owner: { id: 'u1', name: 'Hira Owner' }, visibility: 'organization', team_id: null, status: 'active', opted_out_at: null, source: 'manual', last_contact_at: null, created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z', ...extra,
})
const COMPANIES = [{ id: C1, name: 'Acme' }, { id: 'c0000000-0000-4000-8000-000000000002', name: 'Orbit' }].map((c) => ({ ...c, domain: null, industry: null, size_range: null, owner: { id: 'u1', name: 'Hira Owner' }, visibility: 'organization', team_id: null, people_count: 0, open_deal_count: 0, open_value: [], created_at: '', updated_at: '' }))

function fakeApi(initial: Ct[]) {
  const rows = [...initial]; const log: string[] = []; const bodies: Record<string, unknown[]> = {}
  let total: number | null = null
  let patchAnswer: ((body: Record<string, unknown>, row: Ct) => Response) | null = null
  let createAnswer: ((body: Record<string, unknown>) => Response) | null = null
  let deleteAnswer: (() => Response) | null = null
  const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
    const method = init.method ?? 'GET'; const u = new URL(url, 'http://x'); const path = u.pathname.replace('/api/v1', ''); const key = method + ' ' + path + (u.search || '')
    log.push(key); if (init.body) (bodies[method + ' ' + path] ??= []).push(JSON.parse(String(init.body)))
    if (path === '/auth/csrf/') return json(200, { csrf_token: 't' })
    if (path === '/companies/') return json(200, { count: 2, next: null, previous: null, results: COMPANIES })
    const one = /^\/companies\/([0-9a-f-]{36})\/$/.exec(path); if (one && method === 'GET') { const row = COMPANIES.find((c) => c.id === one[1]); return row ? json(200, row) : json(404, { code: 'COMMON_NOT_FOUND', detail: 'x' }) }
    if (path === '/contacts/' && method === 'GET') {
      const q = u.searchParams.get('q')?.toLowerCase(); const st = u.searchParams.get('status'); const cid = u.searchParams.get('company_id')
      const list = rows.filter((r) => (!q || r.name.toLowerCase().includes(q)) && (!st || r.status === st) && (!cid || r.company?.id === cid))
      return json(200, { count: total ?? list.length, next: null, previous: null, results: list })
    }
    if (path === '/contacts/' && method === 'POST') {
      const body = JSON.parse(String(init.body)); if (createAnswer) return createAnswer(body)
      const row = ct(NEW, body.first_name, body.last_name ?? null, { email: body.email, phone: body.phone ?? null, title: body.title ?? null, company: body.company_id ? COMPANIES.filter((c) => c.id === body.company_id).map((c) => ({ id: c.id, name: c.name }))[0]! : null })
      rows.push(row); return json(201, row)
    }
    const m = /^\/contacts\/([0-9a-f-]{36})\/$/.exec(path)
    if (m) {
      const row = rows.find((r) => r.id === m[1]); if (!row) return json(404, { code: 'COMMON_NOT_FOUND', detail: 'x' })
      if (method === 'GET') return json(200, row)
      if (method === 'PATCH') { const body = JSON.parse(String(init.body)); if (patchAnswer) return patchAnswer(body, row); const { updated_at: _u, company_id, ...rest } = body; Object.assign(row, rest, { updated_at: '2026-11-09T10:00:00Z' }); if ('company_id' in body) row.company = COMPANIES.filter((c) => c.id === company_id).map((c) => ({ id: c.id, name: c.name }))[0] ?? null; row.name = [row.first_name, row.last_name].filter(Boolean).join(' '); return json(200, row) }
      if (method === 'DELETE') { if (deleteAnswer) return deleteAnswer(); rows.splice(rows.indexOf(row), 1); return json(204, null) }
    }
    return json(500, { code: 'COMMON_SERVER_ERROR', detail: 'unexpected ' + key })
  })
  return {
    rows, log, bodies, fetchFn, setTotal: (n: number) => { total = n },
    onPatch: (f: typeof patchAnswer) => { patchAnswer = f }, onCreate: (f: typeof createAnswer) => { createAnswer = f }, onDelete: (f: typeof deleteAnswer) => { deleteAnswer = f },
    calls: (prefix: string) => log.filter((l) => l.startsWith(prefix)),
  }
}

async function mount(path: string, api: ReturnType<typeof fakeApi>) {
  vi.resetModules(); vi.stubEnv('VITE_USE_MOCK_API', ''); vi.stubGlobal('fetch', api.fetchFn)
  const s = await import('../../src/store')
  s.hydrateWorkspace({ name: 'Hira Owner', email: 'h@x.com', type: 'business', verified: true, organization: { id: 'o1', name: 'Acme Ltd', type: 'business', timezone: 'UTC' }, role: 'owner' })
  const { default: App } = await import('../../src/App')
  const host = document.createElement('div'); document.body.appendChild(host)
  await act(async () => { createRoot(host).render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>) })
  await settle()
  return { host, s }
}
const settle = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 30)) }) }
const wait = async (ms: number) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)) }) }
const type = async (el: HTMLInputElement | HTMLSelectElement, v: string) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  await act(async () => { Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, v); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })) })
}
const buttons = (root: ParentNode) => [...root.querySelectorAll('button')]
const click = async (root: ParentNode, label: string) => {
  const b = buttons(root).find((x) => x.textContent === label); if (!b) throw new Error('no button ' + label)
  await act(async () => { b.click() }); await settle()
}
const dlg = () => document.querySelector('[role=dialog]') as HTMLElement
const toasts = (s: typeof import('../../src/store')) => s.getState().toasts.map((t) => t.text)
const field = (d: ParentNode, autocomplete: string) => d.querySelector(`input[autocomplete="${autocomplete}"]`) as HTMLInputElement

beforeEach(() => { Element.prototype.scrollIntoView = () => {}; window.scrollTo = () => {}; vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} }) })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); document.body.innerHTML = '' })

describe('Contacts list (real mode)', () => {
  it('shows the API rows with owner and company from the API; no import, export, opt-out, location, suspended or hard-coded owner filter', async () => {
    const api = fakeApi([ct(P1, 'Ada', 'Lovelace'), ct(P2, 'Bo', null, { status: 'opted_out', company: null, owner: { id: 'u2', name: 'Zed Other' } })])
    const { host } = await mount('/app/contacts', api)
    const t = host.textContent ?? ''
    expect(t).toContain('Ada Lovelace'); expect(t).toContain('Hira Owner'); expect(t).toContain('Zed Other'); expect(t).toContain('2 people'); expect(t).toContain('Opted out')
    for (const gone of ['Import CSV', 'Export', 'Mark opted out', 'Location', 'Suspended', 'All owners', 'Sana Iqbal', 'Mahad', 'This screen is not connected yet']) expect(t).not.toContain(gone)
  })
  it('an empty workspace shows a friendly empty state', async () => {
    const { host } = await mount('/app/contacts', fakeApi([]))
    expect(host.textContent).toContain('No contacts yet. Add your first one.'); expect(buttons(host).filter((b) => b.textContent === 'Add contact').length).toBe(2)
  })
  it('search sends q from 2 characters; the status filter asks the server; both can empty the list', async () => {
    const api = fakeApi([ct(P1, 'Ada', 'Lovelace'), ct(P2, 'Bo', null, { status: 'opted_out' })]); const { host } = await mount('/app/contacts', api)
    const box = host.querySelector('input[aria-label="Search contacts"]') as HTMLInputElement
    await type(box, 'b'); await wait(400); expect(api.calls('GET /contacts/?q=')).toHaveLength(0)
    await type(box, 'ada'); await wait(400); expect(api.calls('GET /contacts/?q=ada')).toHaveLength(1); expect(host.querySelector('tbody')!.textContent).not.toContain('Bo')
    await type(box, ''); await wait(400)
    await type(host.querySelector('select[aria-label="Status"]') as HTMLSelectElement, 'opted_out'); await settle()
    expect(api.calls('GET /contacts/?').some((l) => l.includes('status=opted_out'))).toBe(true); expect(host.querySelector('tbody')!.textContent).not.toContain('Ada')
    await type(box, 'zzz'); await wait(400); expect(host.textContent).toContain('No contacts match.')
  })
  it('pages through the server', async () => {
    const api = fakeApi([ct(P1, 'Ada', 'Lovelace')]); api.setTotal(60); const { host } = await mount('/app/contacts', api)
    expect(host.textContent).toContain('Page 1 of 3'); await click(host, 'Next'); expect(api.calls('GET /contacts/?page=2')).toHaveLength(1)
  })
})

describe('Add contact (real mode)', () => {
  const openAdd = async (api: ReturnType<typeof fakeApi>, path = '/app/contacts') => { const m = await mount(path, api); await click(m.host, path.includes('companies') ? 'Add person' : 'Add contact'); return m }
  const fill = async (d: HTMLElement, first: string, email: string, last = '') => {
    await type(field(d, 'given-name'), first); if (last) await type(field(d, 'family-name'), last); await type(d.querySelector('input[type=email]') as HTMLInputElement, email)
  }

  it('has first and last name fields (no single full-name field) and a company picker from the API', async () => {
    const api = fakeApi([]); await openAdd(api); const d = dlg()
    expect(field(d, 'given-name')).not.toBeNull(); expect(field(d, 'family-name')).not.toBeNull(); expect(d.textContent).not.toContain('Full name')
    expect([...d.querySelectorAll('select')].at(-1)!.textContent).toContain('Orbit'); expect(api.calls('GET /companies/?page_size=100')).toHaveLength(1)
  })
  it('invalid input is stopped in the form: no request is sent', async () => {
    const api = fakeApi([]); await openAdd(api); const d = dlg(); await fill(d, '', 'not-an-email'); await click(d, 'Add contact')
    expect(api.calls('POST')).toHaveLength(0); expect(d.textContent).toContain('Enter the first name.')
  })
  it('saves through the API (E.164 phone, first and last name, company id), then opens the row read from the server, and only then says added', async () => {
    const api = fakeApi([]); const { host, s } = await openAdd(api); const d = dlg()
    await fill(d, 'Zoë', ' ZOE@Example.COM ', 'Müller'); await type(d.querySelector('input[type=tel]') as HTMLInputElement, '0300 5550142'); await type([...d.querySelectorAll('select')].at(-1)!, C1); await click(d, 'Add contact')
    expect(api.bodies['POST /contacts/']![0]).toEqual({ first_name: 'Zoë', last_name: 'Müller', email: 'zoe@example.com', phone: '+923005550142', company_id: C1 })
    expect(toasts(s)).toContain('Zoë Müller added'); expect(dlg()).toBeNull()
    expect(api.log.indexOf('POST /contacts/')).toBeLessThan(api.log.findIndex((l) => l === 'GET /contacts/' + NEW + '/')); expect(host.textContent).toContain('zoe@example.com')
  })
  it('a duplicate email is a field error with a link to the existing contact; no success toast; nothing added', async () => {
    const api = fakeApi([ct(P1, 'Ada', 'Lovelace')]); api.onCreate(() => json(409, { code: 'CRM_CONTACT_EMAIL_TAKEN', detail: 'raw text', existing: { id: P1, name: 'Ada Lovelace' } }))
    const { s } = await openAdd(api); const d = dlg(); await fill(d, 'Ada', 'ada@x.com'); await click(d, 'Add contact')
    expect(d.textContent).toContain('A contact with that email already exists.'); expect(d.textContent).not.toContain('raw text'); expect(d.querySelector(`a[href="/app/contacts/${P1}"]`)?.textContent).toBe('Open Ada Lovelace')
    expect(toasts(s).some((x) => x.includes('added'))).toBe(false); expect(api.rows).toHaveLength(1)
  })
  it('server field errors (phone needs +) land on the field; an unexpected error is a banner and the form stays open', async () => {
    const api = fakeApi([]); api.onCreate(() => json(400, { code: 'COMMON_VALIDATION_FAILED', detail: 'x', fields: { phone: [{ code: 'VALIDATION_PHONE_NEEDS_PLUS', detail: 'x' }] } }))
    const { s } = await openAdd(api); const d = dlg(); await fill(d, 'Ada', 'ada@x.com'); await click(d, 'Add contact'); expect(d.textContent).toContain('Start the number with + and the country code.')
    api.onCreate(() => json(500, { code: 'COMMON_SERVER_ERROR', detail: 'x' })); await click(d, 'Add contact')
    expect(dlg()).not.toBeNull(); expect(d.querySelector('[role=alert]')?.textContent).toContain('Something went wrong on our side.'); expect(toasts(s).some((x) => x.includes('added'))).toBe(false)
  })
  it('"Add person" on a company page presets the company and refreshes the people list from the server', async () => {
    const api = fakeApi([]); const { host } = await openAdd(api, '/app/companies/' + C1)
    const d = dlg(); expect([...d.querySelectorAll('select')].at(-1)!.value).toBe(C1)
    await fill(d, 'Ada', 'ada@x.com', 'Lovelace'); await click(d, 'Add contact')
    expect(api.bodies['POST /contacts/']![0]).toMatchObject({ company_id: C1 }); expect(api.calls('GET /contacts/?').filter((l) => l.includes('company_id=' + C1)).length).toBeGreaterThanOrEqual(2)
    expect(host.textContent).toContain('Ada Lovelace')
  })
})

describe('Contact detail, edit and delete (real mode)', () => {
  const open = (api: ReturnType<typeof fakeApi>, id = P1) => mount('/app/contacts/' + id, api)

  it('reads the contact from the API; no location, deals or conversations cards, no opt-out button', async () => {
    const { host } = await open(fakeApi([ct(P1, 'Ada', 'Lovelace')]))
    const t = host.textContent ?? ''
    expect(t).toContain('Ada Lovelace'); expect(t).toContain('ada@x.com'); expect(t).toContain('+923005550142'); expect(t).toContain('Hira Owner'); expect(t).toContain('Acme')
    for (const gone of ['Location', 'Conversations', 'Mark opted out', 'Remove opt-out', 'Mahad']) expect(t).not.toContain(gone)
  })
  it('an opted-out contact shows the read-only banner', async () => {
    const { host } = await open(fakeApi([ct(P1, 'Ada', 'Lovelace', { status: 'opted_out' })])); expect(host.textContent).toContain('This person opted out.')
  })
  it('not found, and a bad id is never put in a URL', async () => {
    expect((await open(fakeApi([ct(P1, 'Ada', 'Lovelace')]), P2)).host.textContent).toContain('Contact not found.')
    document.body.innerHTML = ''; const api = fakeApi([]); const m = await mount('/app/contacts/../x', api); expect(m.host.textContent).toContain('Page not found'); expect(api.log.some((l) => l.includes('..'))).toBe(false)
    document.body.innerHTML = ''; const api2 = fakeApi([]); const m2 = await mount('/app/contacts/p1', api2); expect(m2.host.textContent).toContain('Contact not found.'); expect(api2.log.some((l) => l.includes('p1'))).toBe(false)
  })
  it('edit sends only what changed plus updated_at, null clears, then re-reads before saying saved', async () => {
    const api = fakeApi([ct(P1, 'Ada', 'Lovelace')]); const { host, s } = await open(api); await click(host, 'Edit'); const d = dlg()
    await type(field(d, 'family-name'), 'King'); await type(d.querySelector('input[type=tel]') as HTMLInputElement, ''); await type([...d.querySelectorAll('select')].at(-1)!, ''); await click(d, 'Save changes')
    expect(api.bodies['PATCH /contacts/' + P1 + '/']![0]).toEqual({ last_name: 'King', phone: null, company_id: null, updated_at: '2026-11-02T10:00:00Z' })
    const patchAt = api.log.findIndex((l) => l.startsWith('PATCH')); expect(api.log.slice(patchAt + 1)).toContain('GET /contacts/' + P1 + '/')
    expect(toasts(s)).toContain('Contact saved'); expect(dlg()).toBeNull(); expect(host.textContent).toContain('Ada King')
  })
  it('edit with no change sends nothing', async () => {
    const api = fakeApi([ct(P1, 'Ada', 'Lovelace')]); const { host } = await open(api); await click(host, 'Edit'); await click(dlg(), 'Save changes'); expect(api.calls('PATCH')).toHaveLength(0)
  })
  it('a stale version (409) shows a clear message, no saved toast, keeps the data; Reload latest re-reads', async () => {
    const api = fakeApi([ct(P1, 'Ada', 'Lovelace')]); api.onPatch(() => json(409, { code: 'COMMON_VERSION_CONFLICT', detail: 'x', current: {} }))
    const { host, s } = await open(api); await click(host, 'Edit'); const d = dlg(); await type(field(d, 'given-name'), 'Mine'); await click(d, 'Save changes')
    expect(d.textContent).toContain('Someone else changed this while you were editing. Reload it and try again.'); expect(toasts(s)).not.toContain('Contact saved'); expect(api.rows[0]!.first_name).toBe('Ada')
    expect(buttons(d).some((b) => b.textContent === 'Save changes')).toBe(false)
    api.rows[0]!.first_name = 'Changed Elsewhere'; api.rows[0]!.name = 'Changed Elsewhere Lovelace'; await click(d, 'Reload latest'); expect(dlg()).toBeNull(); expect(host.textContent).toContain('Changed Elsewhere')
  })
  it('a duplicate email on edit is a field error and nothing changes', async () => {
    const api = fakeApi([ct(P1, 'Ada', 'Lovelace')]); api.onPatch(() => json(409, { code: 'CRM_CONTACT_EMAIL_TAKEN', detail: 'x', existing: { id: P2, name: 'Bo' } }))
    const { host, s } = await open(api); await click(host, 'Edit'); const d = dlg(); await type(d.querySelector('input[type=email]') as HTMLInputElement, 'bo@x.com'); await click(d, 'Save changes')
    expect(d.textContent).toContain('A contact with that email already exists.'); expect(d.textContent).toContain('Open Bo'); expect(toasts(s)).not.toContain('Contact saved')
  })
  it('delete asks first, calls DELETE, then returns to a list read from the server', async () => {
    const api = fakeApi([ct(P1, 'Ada', 'Lovelace'), ct(P2, 'Bo', null)]); const { host, s } = await open(api)
    await click(host, 'Delete'); expect(dlg().textContent).toContain('Delete Ada Lovelace?'); expect(api.calls('DELETE')).toHaveLength(0); await click(dlg(), 'Delete contact')
    expect(api.calls('DELETE /contacts/' + P1 + '/')).toHaveLength(1); expect(toasts(s)).toContain('Ada Lovelace deleted')
    expect(api.log.slice(api.log.findIndex((l) => l.startsWith('DELETE')) + 1)).toContain('GET /contacts/?page_size=25')
    expect(host.querySelector('tbody')!.textContent).toContain('Bo'); expect(host.querySelector('tbody')!.textContent).not.toContain('Ada')
  })
  it('cancel does not delete; a failed delete keeps the row and says nothing was deleted', async () => {
    const api = fakeApi([ct(P1, 'Ada', 'Lovelace')]); const { host, s } = await open(api)
    await click(host, 'Delete'); await click(dlg(), 'Cancel'); expect(api.calls('DELETE')).toHaveLength(0)
    api.onDelete(() => json(500, { code: 'COMMON_SERVER_ERROR', detail: 'boom' })); await click(host, 'Delete'); await click(dlg(), 'Delete contact')
    expect(dlg().textContent).toContain('Something went wrong on our side.'); expect(toasts(s).some((x) => x.includes('deleted'))).toBe(false); expect(api.rows).toHaveLength(1)
  })
})

describe('no hard-coded person names in real mode', () => {
  it('a real user sees only their own name and API data on Home, Inbox and the shell', async () => {
    const api = fakeApi([]); const { host } = await mount('/app/home', api)
    const t = host.textContent ?? ''
    expect(t).toContain('Hira'); for (const fixed of ['Mahad', 'Sana Iqbal', 'Zain Ahmed', 'Hira Malik']) expect(t).not.toContain(fixed)
  })
})
