// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ID1 = 'c0000000-0000-4000-8000-000000000001'
const ID2 = 'c0000000-0000-4000-8000-000000000002'
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(body === null ? null : JSON.stringify(body), { status, headers: body === null ? headers : { 'Content-Type': 'application/json', ...headers } })

interface Co { id: string; name: string; domain: string | null; industry: string | null; size_range: string | null; owner: { id: string; name: string }; visibility: string; team_id: null; people_count: number; open_deal_count: number; open_value: Array<{ currency: string; amount: string }>; created_at: string; updated_at: string }
const co = (id: string, name: string, extra: Partial<Co> = {}): Co => ({
  id, name, domain: name.toLowerCase().replace(/\W/g, '') + '.com', industry: 'Software', size_range: '11-50', owner: { id: 'u1', name: 'Hira Owner' }, visibility: 'organization', team_id: null,
  people_count: 2, open_deal_count: 1, open_value: [{ currency: 'USD', amount: '18000.00' }, { currency: 'PKR', amount: '500000.00' }], created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-02T10:00:00Z', ...extra,
})
const PERSON = { id: 'p0000000-0000-4000-8000-000000000001', first_name: 'Ada', last_name: 'Lovelace', name: 'Ada Lovelace', email: 'ada@x.com', phone: null, title: 'CTO', company: { id: ID1, name: 'Acme' }, owner: { id: 'u1', name: 'Hira Owner' }, visibility: 'organization', team_id: null, status: 'active', opted_out_at: null, source: 'manual', last_contact_at: null, created_at: '', updated_at: '' }

/** A tiny fake of the companies API that remembers what it was asked, in order. */
function fakeApi(initial: Co[]) {
  const rows = [...initial]; const log: string[] = []; const bodies: Record<string, unknown[]> = {}
  let total: number | null = null
  let patchAnswer: ((body: Record<string, unknown>, row: Co) => Response) | null = null
  let createAnswer: ((body: Record<string, unknown>) => Response) | null = null
  let deleteAnswer: (() => Response) | null = null
  const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
    const method = init.method ?? 'GET'; const u = new URL(url, 'http://x'); const path = u.pathname.replace('/api/v1', ''); const key = method + ' ' + path + (u.search || '')
    log.push(key); if (init.body) (bodies[method + ' ' + path] ??= []).push(JSON.parse(String(init.body)))
    if (path === '/auth/csrf/') return json(200, { csrf_token: 't' })
    if (path === '/companies/' && method === 'GET') { const q = u.searchParams.get('q')?.toLowerCase(); const list = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows; return json(200, { count: total ?? list.length, next: null, previous: null, results: list }) }
    if (path === '/companies/' && method === 'POST') {
      const body = JSON.parse(String(init.body)); if (createAnswer) return createAnswer(body)
      const row = co('c0000000-0000-4000-8000-0000000000aa', body.name, { domain: body.domain ?? null, industry: body.industry ?? null, size_range: body.size_range ?? null, people_count: 0, open_deal_count: 0, open_value: [] }); rows.push(row); return json(201, row)
    }
    const m = /^\/companies\/([0-9a-f-]{36})\/$/.exec(path)
    if (m) {
      const row = rows.find((r) => r.id === m[1]); if (!row) return json(404, { code: 'COMMON_NOT_FOUND', detail: 'x' })
      if (method === 'GET') return json(200, row)
      if (method === 'PATCH') { const body = JSON.parse(String(init.body)); if (patchAnswer) return patchAnswer(body, row); Object.assign(row, body, { updated_at: '2026-11-09T10:00:00Z' }); delete (row as Partial<Co> & { updated_at_in?: string }).updated_at_in; return json(200, row) }
      if (method === 'DELETE') { if (deleteAnswer) return deleteAnswer(); rows.splice(rows.indexOf(row), 1); return json(204, null) }
    }
    if (path === '/contacts/') return json(200, { count: 1, next: null, previous: null, results: [PERSON] })
    return json(500, { code: 'COMMON_SERVER_ERROR', detail: 'unexpected ' + key })
  })
  return {
    rows, log, bodies, fetchFn,
    setTotal: (n: number) => { total = n }, onPatch: (f: typeof patchAnswer) => { patchAnswer = f }, onCreate: (f: typeof createAnswer) => { createAnswer = f }, onDelete: (f: typeof deleteAnswer) => { deleteAnswer = f },
    calls: (prefix: string) => log.filter((l) => l.startsWith(prefix)),
  }
}

async function mount(path: string, api: ReturnType<typeof fakeApi>) {
  vi.resetModules(); vi.stubEnv('VITE_USE_MOCK_API', '')
  vi.stubGlobal('fetch', api.fetchFn); vi.stubGlobal('document', document)
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
const click = async (root: ParentNode, label: string | RegExp) => {
  const b = buttons(root).find((x) => (typeof label === 'string' ? x.textContent === label : label.test(x.textContent ?? '')))
  if (!b) throw new Error('no button ' + label); await act(async () => { b.click() }); await settle()
}
const dlg = () => document.querySelector('[role=dialog]') as HTMLElement
const toasts = (s: typeof import('../../src/store')) => s.getState().toasts.map((t) => t.text)

beforeEach(() => { Element.prototype.scrollIntoView = () => {}; window.scrollTo = () => {}; vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} }) })
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); document.body.innerHTML = '' })

describe('Companies list (real mode)', () => {
  it('shows the API rows: owner from the API, open value per currency, no location or website', async () => {
    const api = fakeApi([co(ID1, 'Acme'), co(ID2, 'Orbit', { owner: { id: 'u2', name: 'Zed Other' }, open_value: [], open_deal_count: 0 })])
    const { host } = await mount('/app/companies', api)
    expect(api.calls('GET /companies/')).toHaveLength(1)
    const t = host.textContent ?? ''
    expect(t).toContain('Acme'); expect(t).toContain('Hira Owner'); expect(t).toContain('Zed Other'); expect(t).toContain('2 companies')
    expect(t).toContain('$18,000.00'); expect(t).toContain('500,000.00'); expect(t).not.toContain('Location'); expect(t).not.toContain('Website')
    expect(t).not.toContain('Northwind'); expect(t).not.toContain('Mahad'); expect(t).not.toContain('This screen is not connected yet')
  })
  it('an empty workspace shows a friendly empty state with an Add button', async () => {
    const { host } = await mount('/app/companies', fakeApi([]))
    expect(host.textContent).toContain('No companies yet. Add your first one.'); expect(buttons(host).filter((b) => b.textContent === 'Add company').length).toBe(2)
  })
  it('search waits, sends q only from 2 characters, and says so when nothing matches', async () => {
    const api = fakeApi([co(ID1, 'Acme'), co(ID2, 'Orbit')]); const { host } = await mount('/app/companies', api)
    const box = host.querySelector('input[aria-label="Search companies"]') as HTMLInputElement
    await type(box, 'a'); await wait(400); expect(api.calls('GET /companies/?q=')).toHaveLength(0)
    await type(box, 'orb'); await wait(400); expect(api.calls('GET /companies/?q=orb')).toHaveLength(1); expect(host.querySelector('tbody')!.textContent).toContain('Orbit'); expect(host.querySelector('tbody')!.textContent).not.toContain('Acme')
    await type(box, 'zzz'); await wait(400); expect(host.textContent).toContain('No companies match your search.')
  })
  it('pages through the server: Next asks for page 2', async () => {
    const api = fakeApi([co(ID1, 'Acme')]); api.setTotal(60); const { host } = await mount('/app/companies', api)
    expect(host.textContent).toContain('Page 1 of 3'); await click(host, 'Next'); expect(api.calls('GET /companies/?page=2')).toHaveLength(1)
  })
  it('a server error shows the mapped message and a retry', async () => {
    const api = fakeApi([]); api.fetchFn.mockImplementation(async (url: string) => (String(url).includes('/auth/csrf/') ? json(200, { csrf_token: 't' }) : json(500, { code: 'COMMON_SERVER_ERROR', detail: 'Traceback secret' })))
    const { host } = await mount('/app/companies', api)
    expect(host.textContent).toContain('Something went wrong on our side.'); expect(host.textContent).not.toContain('Traceback'); expect(buttons(host).some((b) => b.textContent === 'Try again')).toBe(true)
  })
})

describe('Add company (real mode)', () => {
  const openAdd = async (api: ReturnType<typeof fakeApi>) => {
    const m = await mount('/app/companies', api); await click(m.host, 'Add company'); return m
  }
  const fill = async (d: HTMLElement, name: string, domain = '') => {
    await type(d.querySelector('input[maxlength="120"]') as HTMLInputElement, name); if (domain) await type(d.querySelector('input[placeholder="acme.com"]') as HTMLInputElement, domain)
  }
  it('invalid input is stopped in the form: no request is sent', async () => {
    const api = fakeApi([]); await openAdd(api); const d = dlg(); await fill(d, 'A'); await click(d, 'Add company')
    expect(api.calls('POST /companies/')).toHaveLength(0); expect(d.textContent).toContain('too short')
  })
  it('saves through the API first, then opens the row read back from the server, and only then says added', async () => {
    const api = fakeApi([]); const { host, s } = await openAdd(api); const d = dlg()
    await fill(d, 'Fresh Co', ' Fresh.CO '); await type(d.querySelector('select') as HTMLSelectElement, '51-200'); await click(d, 'Add company')
    expect(api.bodies['POST /companies/']![0]).toEqual({ name: 'Fresh Co', domain: 'fresh.co', size_range: '51-200' })
    expect(toasts(s)).toContain('Fresh Co added'); expect(dlg()).toBeNull()
    expect(api.log.indexOf('POST /companies/')).toBeLessThan(api.log.findIndex((l) => l.startsWith('GET /companies/c0000000-0000-4000-8000-0000000000aa/')))
    expect(host.textContent).toContain('Fresh Co'); expect(host.textContent).toContain('fresh.co')
  })
  it('a taken name is a field error, no success toast, nothing added', async () => {
    const api = fakeApi([co(ID1, 'Acme')]); api.onCreate(() => json(409, { code: 'CRM_COMPANY_NAME_TAKEN', detail: 'raw server text' }))
    const { s } = await openAdd(api); const d = dlg(); await fill(d, 'Acme'); await click(d, 'Add company')
    expect(d.textContent).toContain('A company with that name already exists.'); expect(d.textContent).not.toContain('raw server text')
    expect(toasts(s).some((x) => x.includes('added'))).toBe(false); expect(api.rows).toHaveLength(1)
  })
  it('a taken domain and a bad domain from the server land on the domain field', async () => {
    const api = fakeApi([]); api.onCreate(() => json(409, { code: 'CRM_COMPANY_DOMAIN_TAKEN', detail: 'x' }))
    await openAdd(api); let d = dlg(); await fill(d, 'Orbit', 'orbit.com'); await click(d, 'Add company'); expect(d.textContent).toContain('A company with that domain already exists.')
    api.onCreate(() => json(400, { code: 'COMMON_VALIDATION_FAILED', detail: 'x', fields: { domain: [{ code: 'VALIDATION_DOMAIN_INVALID', detail: 'x' }] } }))
    d = dlg(); await click(d, 'Add company'); expect(d.textContent).toContain('Enter a web domain like acme.com')
  })
  it('an unexpected error shows a banner in the form and the form stays open', async () => {
    const api = fakeApi([]); api.onCreate(() => json(500, { code: 'COMMON_SERVER_ERROR', detail: 'x' }))
    const { s } = await openAdd(api); const d = dlg(); await fill(d, 'Orbit'); await click(d, 'Add company')
    expect(dlg()).not.toBeNull(); expect(d.querySelector('[role=alert]')?.textContent).toContain('Something went wrong on our side.'); expect(toasts(s).some((x) => x.includes('added'))).toBe(false)
  })
})

describe('Company detail, edit and delete (real mode)', () => {
  const open = (api: ReturnType<typeof fakeApi>, id = ID1) => mount('/app/companies/' + id, api)

  it('reads the company and its people from the API; shows owner from the API; no location, website or deals card', async () => {
    const api = fakeApi([co(ID1, 'Acme')]); const { host } = await open(api)
    expect(api.calls('GET /companies/' + ID1 + '/')).toHaveLength(1); expect(api.calls('GET /contacts/?')[0]).toContain('company_id=' + ID1)
    const t = (host.textContent ?? '').replace(/ /g, ' ')
    expect(t).toContain('Acme'); expect(t).toContain('acme.com'); expect(t).toContain('Hira Owner'); expect(t).toContain('Ada Lovelace'); expect(t).toContain('$18,000.00 + PKR 500,000.00')
    for (const gone of ['Location', 'Website', 'Mahad', 'Northwind']) expect(t).not.toContain(gone)
  })
  it('a company that does not exist, or a bad id, is "not found" without leaking anything', async () => {
    const api = fakeApi([co(ID1, 'Acme')]); expect((await open(api, ID2)).host.textContent).toContain('Company not found.')
    document.body.innerHTML = ''; const api2 = fakeApi([]); const m = await mount('/app/companies/not-a-uuid', api2)
    expect(m.host.textContent).toContain('Company not found.'); expect(api2.log.some((l) => l.includes('not-a-uuid'))).toBe(false)
  })
  it('edit sends only what changed plus updated_at, then re-reads from the server before saying saved', async () => {
    const api = fakeApi([co(ID1, 'Acme')]); const { host, s } = await open(api); await click(host, 'Edit'); const d = dlg()
    await type(d.querySelector('input[maxlength="120"]') as HTMLInputElement, 'Acme Group'); await type(d.querySelector('input[placeholder="acme.com"]') as HTMLInputElement, ''); await click(d, 'Save changes')
    expect(api.bodies['PATCH /companies/' + ID1 + '/']![0]).toEqual({ name: 'Acme Group', domain: null, updated_at: '2026-11-02T10:00:00Z' })
    const patchAt = api.log.findIndex((l) => l.startsWith('PATCH')); expect(api.log.slice(patchAt + 1).some((l) => l === 'GET /companies/' + ID1 + '/')).toBe(true)
    expect(toasts(s)).toContain('Company saved'); expect(dlg()).toBeNull(); expect(host.textContent).toContain('Acme Group')
  })
  it('edit with no change sends nothing', async () => {
    const api = fakeApi([co(ID1, 'Acme')]); const { host } = await open(api); await click(host, 'Edit'); await click(dlg(), 'Save changes')
    expect(api.calls('PATCH')).toHaveLength(0)
  })
  it('a stale version (409) shows a clear message, no saved toast, keeps the old data, and Reload latest re-reads the row', async () => {
    const api = fakeApi([co(ID1, 'Acme')]); api.onPatch(() => json(409, { code: 'COMMON_VERSION_CONFLICT', detail: 'x', current: co(ID1, 'Acme Renamed Elsewhere') }))
    const { host, s } = await open(api); await click(host, 'Edit'); const d = dlg()
    await type(d.querySelector('input[maxlength="120"]') as HTMLInputElement, 'Mine'); await click(d, 'Save changes')
    expect(d.textContent).toContain('Someone else changed this while you were editing. Reload it and try again.'); expect(toasts(s)).not.toContain('Company saved')
    expect(api.rows[0]!.name).toBe('Acme'); expect(buttons(d).some((b) => b.textContent === 'Save changes')).toBe(false)
    api.rows[0]!.name = 'Acme Renamed Elsewhere'; await click(d, 'Reload latest')
    expect(dlg()).toBeNull(); expect(host.textContent).toContain('Acme Renamed Elsewhere')
  })
  it('a duplicate name on edit is a field error and nothing changes', async () => {
    const api = fakeApi([co(ID1, 'Acme')]); api.onPatch(() => json(409, { code: 'CRM_COMPANY_NAME_TAKEN', detail: 'x' }))
    const { host, s } = await open(api); await click(host, 'Edit'); const d = dlg(); await type(d.querySelector('input[maxlength="120"]') as HTMLInputElement, 'Orbit'); await click(d, 'Save changes')
    expect(d.textContent).toContain('A company with that name already exists.'); expect(toasts(s)).not.toContain('Company saved'); expect(dlg()).not.toBeNull()
  })
  it('delete asks first, calls DELETE, then goes back to a list read from the server', async () => {
    const api = fakeApi([co(ID1, 'Acme'), co(ID2, 'Orbit')]); const { host, s } = await open(api)
    await click(host, 'Delete'); expect(dlg().textContent).toContain('Delete Acme?'); expect(api.calls('DELETE')).toHaveLength(0)
    await click(dlg(), 'Delete company')
    expect(api.calls('DELETE /companies/' + ID1 + '/')).toHaveLength(1); expect(toasts(s)).toContain('Acme deleted')
    expect(api.log.slice(api.log.findIndex((l) => l.startsWith('DELETE')) + 1)).toContain('GET /companies/?page_size=25')
    expect(host.querySelector('tbody')!.textContent).toContain('Orbit'); expect(host.querySelector('tbody')!.textContent).not.toContain('Acme')
  })
  it('cancel does not delete; a failed delete shows the message, keeps the row and says nothing was deleted', async () => {
    const api = fakeApi([co(ID1, 'Acme')]); const { host, s } = await open(api)
    await click(host, 'Delete'); await click(dlg(), 'Cancel'); expect(api.calls('DELETE')).toHaveLength(0)
    api.onDelete(() => json(500, { code: 'COMMON_SERVER_ERROR', detail: 'boom' }))
    await click(host, 'Delete'); await click(dlg(), 'Delete company')
    expect(dlg().textContent).toContain('Something went wrong on our side.'); expect(toasts(s).some((x) => x.includes('deleted'))).toBe(false); expect(api.rows).toHaveLength(1)
  })
})
