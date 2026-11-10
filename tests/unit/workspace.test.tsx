// @vitest-environment jsdom
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const org = (name: string) => ({ id: 'o1', name, type: 'business' as const, timezone: 'Asia/Karachi' })
const user = (orgName: string) => ({ name: 'Sara Ali', email: 'sara@x.com', type: 'business' as const, verified: true, organization: org(orgName), role: 'owner' as const })

async function load(mock: boolean) {
  vi.resetModules(); vi.stubEnv('VITE_USE_MOCK_API', mock ? 'true' : '')
  return import('../../src/store')
}

describe('what a signed-in user gets on screens that have no backend yet', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('a real user gets empty lists', async () => {
    const s = await load(false); s.hydrateWorkspace(user('Acme Ltd'))
    for (const k of ['deals', 'contacts', 'companies', 'reviews', 'followups', 'threads', 'templates', 'facts', 'mailboxes', 'members', 'audit', 'events'] as const) expect(s.getState()[k]).toHaveLength(0)
    expect(s.getState().user?.organization?.name).toBe('Acme Ltd')
  })
  it('the demo workspace (and only it) keeps the sample data', async () => {
    const s = await load(false); s.hydrateWorkspace(user('Nudge Demo Workspace'))
    expect(s.getState().deals.length).toBeGreaterThan(0); expect(s.getState().contacts.length).toBeGreaterThan(0)
    const { isDemoWorkspace } = await import('../../src/data/demoWorkspace')
    expect(isDemoWorkspace(user('Nudge Demo Workspace'))).toBe(true); expect(isDemoWorkspace(user('nudge demo workspace '))).toBe(false); expect(isDemoWorkspace(null)).toBe(false)
  })
  it('mock mode is unchanged: sample data for everyone', async () => {
    const s = await load(true); s.hydrateWorkspace(user('Acme Ltd')); expect(s.getState().deals.length).toBeGreaterThan(0)
  })
})

const ROUTES = ['/app/home', '/app/review', '/app/inbox', '/app/follow-ups', '/app/calendar', '/app/agent', '/app/pipeline', '/app/pipeline/d3', '/app/contacts', '/app/contacts/p1',
  '/app/companies', '/app/companies/c1', '/app/templates', '/app/reports', '/app/settings/profile', '/app/settings/security', '/app/settings/workspace', '/app/settings/team',
  '/app/settings/mailboxes', '/app/settings/automation', '/app/settings/facts', '/app/settings/notifications', '/app/settings/integrations', '/app/settings/audit',
  '/onboarding/1', '/onboarding/2', '/onboarding/3', '/onboarding/4']

describe('every route renders for a real user with empty data', () => {
  beforeEach(() => { Element.prototype.scrollIntoView = () => {}; window.scrollTo = () => {}; vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} }); vi.spyOn(console, 'error').mockImplementation(() => {}); vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500, headers: { 'Content-Type': 'application/json' } }))) })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); document.body.innerHTML = '' })

  for (const path of ROUTES) {
    it(path, async () => {
      const s = await load(false); s.hydrateWorkspace(user('Acme Ltd'))
      const { default: App } = await import('../../src/App'); const { ErrorBoundary } = await import('../../src/components/guards')
      const host = document.createElement('div'); document.body.appendChild(host)
      await act(async () => { createRoot(host).render(<ErrorBoundary><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></ErrorBoundary>) })
      expect(host.textContent).not.toContain('Reload Nudge')
      expect(host.textContent).not.toContain('Acme Sales')
      if (path.startsWith('/app/') && !/settings\/(profile|security|workspace)|^\/app\/(companies|contacts)/.test(path)) expect(host.textContent).toContain('This screen is not connected yet. Nothing here is saved.')
    })
  }
})

describe('Settings in real mode', () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const STAGES = [{ id: 's1', name: 'Qualified lead', position: 0, outcome: 'open', deal_count: 3 }, { id: 's2', name: 'Won', position: 1, outcome: 'won', deal_count: 1 }]
  let calls: string[] = []
  beforeEach(() => {
    calls = []; Element.prototype.scrollIntoView = () => {}; window.scrollTo = () => {}
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} })
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      const key = (init.method ?? 'GET') + ' ' + url.replace('/api/v1', ''); calls.push(key)
      if (key === 'GET /auth/csrf/') return json(200, { csrf_token: 't' })
      if (key === 'GET /deal-stages/') return json(200, STAGES)
      return json(400, { code: 'COMMON_VALIDATION_FAILED', detail: 'x', fields: { name: [{ code: 'VALIDATION_TOO_SHORT', detail: 'x' }] } })
    }))
  })
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); document.body.innerHTML = '' })
  const open = async (path: string, role: 'owner' | 'member') => {
    const s = await load(false)
    s.hydrateWorkspace({ ...user('Acme Ltd'), role, phone: '+923005550142', timezone: 'Asia/Karachi' })
    const { default: App } = await import('../../src/App')
    const host = document.createElement('div'); document.body.appendChild(host)
    await act(async () => { createRoot(host).render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>) })
    return { host, s }
  }
  const type = async (el: HTMLInputElement, v: string) => {
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) })
  }
  const click = async (host: HTMLElement, label: string) => { await act(async () => { [...host.querySelectorAll('button')].find((b) => b.textContent === label)!.click() }) }

  it('Workspace: real name, no currency select, stages read-only from the server, no stage editor', async () => {
    const { host } = await open('/app/settings/workspace', 'owner')
    expect((host.querySelector('input[maxlength]') as HTMLInputElement).value).toBe('Acme Ltd')
    expect(host.textContent).not.toContain('Default currency'); expect(host.textContent).not.toContain('Save stages'); expect(host.querySelector('input[aria-label="Stage 1"]')).toBeNull()
    expect(calls).toContain('GET /deal-stages/'); expect(host.textContent).toContain('Qualified lead'); expect(host.textContent).toContain('3 deals'); expect(host.textContent).toContain('1 deal')
    expect(host.textContent).not.toContain('Nothing here is saved')
  })
  it('Workspace: a member sees the fields read-only with no save button', async () => {
    const { host } = await open('/app/settings/workspace', 'member')
    expect((host.querySelector('input[maxlength]') as HTMLInputElement).disabled).toBe(true)
    expect(host.textContent).toContain('Only owners and admins can change these.')
    expect([...host.querySelectorAll('button')].some((b) => b.textContent === 'Save changes')).toBe(false)
  })
  it('Workspace: a rejected save shows the server error and never says saved', async () => {
    const { host } = await open('/app/settings/workspace', 'owner')
    await type(host.querySelector('input[maxlength]') as HTMLInputElement, 'Acme Group'); await click(host, 'Save changes')
    expect(calls).toContain('PATCH /organizations/current/'); expect(host.textContent).not.toContain('Workspace saved'); expect(host.textContent).toContain('That is too short.')
  })
  it('Profile: shows the real email and phone split, and a rejected save never says saved', async () => {
    const { host, s } = await open('/app/settings/profile', 'owner')
    expect((host.querySelector('input.readonly') as HTMLInputElement).value).toBe('sara@x.com'); expect((host.querySelector('input[type=tel]') as HTMLInputElement).value).toBe('3005550142')
    expect((host.querySelector('select[aria-label="Country code"]') as HTMLSelectElement).value).toBe('+92')
    await type(host.querySelector('input[autocomplete=name]') as HTMLInputElement, 'Sara B'); await click(host, 'Save changes')
    expect(calls).toContain('PATCH /auth/me/'); expect(s.getState().toasts.some((t) => t.text === 'Profile saved')).toBe(false); expect(s.getState().user?.name).toBe('Sara Ali')
    expect(host.textContent).toContain('That is too short.')
  })
  it('Profile: with nothing changed, no request is made', async () => {
    const { host } = await open('/app/settings/profile', 'owner'); await click(host, 'Save changes')
    expect(calls.some((c) => c.startsWith('PATCH'))).toBe(false)
  })
})
