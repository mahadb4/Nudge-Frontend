import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom'
import { Icon, Brand } from './Icons'
import { Avatar, Field, Kbd, Modal, Pop, Toasts, emailOk } from './ui'
import { money as _m } from '../data/seed'
import { getState, setState, setTheme, useStore, sendNewEmail, toast } from '../store'
import { AgentPanel } from './AgentPanel'

void _m

const NAV = [
  { to: '/app/home', label: 'Home', icon: 'home' },
  { to: '/app/review', label: 'Review', icon: 'review', count: 'review' },
  { to: '/app/inbox', label: 'Inbox', icon: 'inbox' },
  { to: '/app/follow-ups', label: 'Follow-ups', icon: 'clock', count: 'fu' },
  { to: '/app/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/app/agent', label: 'Agent', icon: 'sparkle', isNew: true },
]
const CRM = [
  { to: '/app/pipeline', label: 'Pipeline', icon: 'pipeline' },
  { to: '/app/contacts', label: 'Contacts', icon: 'users' },
  { to: '/app/companies', label: 'Companies', icon: 'building' },
]
const WS = [
  { to: '/app/templates', label: 'Templates', icon: 'template' },
  { to: '/app/reports', label: 'Reports', icon: 'chart' },
  { to: '/app/settings/profile', label: 'Settings', icon: 'settings' },
]

export function Shell() {
  const nav = useNavigate()
  const loc = useLocation()
  const s = useStore((x) => x)
  const pending = s.reviews.filter((r) => r.status === 'pending').length
  const fu = s.followups.filter((f) => !f.done).length
  const [wsOpen, setWsOpen] = useState(false)
  const [bell, setBell] = useState(false)
  const [me, setMe] = useState(false)
  const [help, setHelp] = useState(false)

  useEffect(() => { setState(() => ({ navOpen: false })) }, [loc.pathname])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setState(() => ({ cmdOpen: true })) }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setState((x) => ({ askOpen: !x.askOpen })) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  const isReview = loc.pathname.startsWith('/app/review') || loc.pathname.startsWith('/app/inbox')

  const item = (n: { to: string; label: string; icon: string; count?: string; isNew?: boolean }) => (
    <NavLink key={n.to} to={n.to} className={({ isActive }) => 'nav' + (isActive || (n.label === 'Settings' && loc.pathname.startsWith('/app/settings')) ? ' on' : '')}>
      <Icon n={n.icon} s={19} />{n.label}
      {n.count === 'review' && pending > 0 && <span className="count blue">{pending}</span>}
      {n.count === 'fu' && fu > 0 && <span className="count amber">{fu}</span>}
      {n.isNew && <span className="new">New</span>}
    </NavLink>
  )

  return (
    <div className={'app' + (s.navOpen ? ' nav-open' : '')}>
      <header className="topbar">
        <button className="icon-btn only-mobile" aria-label="Menu" onClick={() => setState((x) => ({ navOpen: !x.navOpen }))}><Icon n="menu" /></button>
        <Link to="/app/home" style={{ display: 'contents' }}><Brand /></Link>
        <div style={{ position: 'relative' }}>
          <button className="ws-switch" onClick={() => setWsOpen(!wsOpen)} aria-haspopup="menu">
            <Avatar name="Acme Sales" tint="t-blue" />Acme Sales<Icon n="chevD" s={14} />
          </button>
          <Pop open={wsOpen} onClose={() => setWsOpen(false)} style={{ top: 42, left: 0 }}>
            <button className="menu-item hl"><Avatar name="Acme Sales" tint="t-blue" size="sm" />Acme Sales<Icon n="check" s={15} style={{ marginLeft: 'auto' }} /></button>
            <button className="menu-item" onClick={() => { setWsOpen(false); toast('Creating workspaces is not part of this demo') }}><Icon n="plus" s={15} />New workspace</button>
          </Pop>
        </div>
        <button className="search" onClick={() => setState(() => ({ cmdOpen: true }))}>
          <Icon n="search" s={17} /><span className="grow">Search people, deals, emails</span><Kbd>Ctrl K</Kbd>
        </button>
        <div className="top-right">
          <button className="draft-pill" onClick={() => nav('/app/settings/automation')} title="Nudge only drafts. You approve every send."><Icon n="shield" s={15} /><span className="lbl">{s.settings.mode === 'draft' ? 'Draft-only' : 'Act when sure'}</span></button>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" aria-label="Help" onClick={() => setHelp(!help)}><Icon n="help" /></button>
            <Pop open={help} onClose={() => setHelp(false)} style={{ top: 40, right: 0 }}>
              <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--ink-2)' }}>Shortcuts: <b>Ctrl K</b> search, <b>Ctrl J</b> Ask Nudge. In Review: <b>K</b>/<b>J</b> move, <b>A</b> approve, <b>R</b> reject, <b>S</b> skip.</div>
            </Pop>
          </div>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn" aria-label="Notifications" onClick={() => setBell(!bell)}><Icon n="bell" />{pending + fu > 0 && <span className="badge-n">3</span>}</button>
            <Pop open={bell} onClose={() => setBell(false)} style={{ top: 40, right: 0, width: 310 }}>
              {[['5 replies are waiting for review', '/app/review'], ['3 follow-ups are due soon', '/app/follow-ups'], ['hello@acme.com needs you to sign in again', '/app/settings/mailboxes']].map(([t, to]) => (
                <button key={t} className="menu-item" onClick={() => { setBell(false); nav(to) }}>{t}</button>
              ))}
            </Pop>
          </div>
          <button className="icon-btn" aria-label="Toggle theme" onClick={() => setTheme(dark ? 'light' : 'dark')}><Icon n={dark ? 'sun' : 'moon'} /></button>
          <div style={{ position: 'relative' }}>
            <button className="me-avatar" aria-label="Account" onClick={() => setMe(!me)}>MB</button>
            <Pop open={me} onClose={() => setMe(false)} style={{ top: 44, right: 0 }}>
              <div style={{ padding: '8px 10px' }}><b>Mahad Baig</b><div className="muted mono" style={{ fontSize: 12 }}>mahad@acme.co</div></div>
              <button className="menu-item" onClick={() => { setMe(false); nav('/app/settings/profile') }}><Icon n="settings" s={15} />Settings</button>
              <button className="menu-item danger" onClick={() => { setMe(false); nav('/sign-in') }}><Icon n="logout" s={15} />Sign out</button>
            </Pop>
          </div>
        </div>
      </header>

      <aside className="sidebar">
        <div className="side-head">
          <button className="new-email" onClick={() => setState(() => ({ newEmailOpen: true }))}><Icon n="plus" s={18} w={2.2} />New email</button>
        </div>
        {NAV.map(item)}
        <div className="side-section">CRM</div>
        {CRM.map(item)}
        <div className="side-section">Workspace</div>
        {WS.map(item)}
      </aside>

      <main className={'main' + (isReview ? ' flush' : '')}><Outlet /></main>

      {!s.askOpen && (
        <button className="ask-fab" onClick={() => setState(() => ({ askOpen: true }))}>
          <span className="ring"><Icon n="sparkle" s={18} style={{ color: '#111' }} /></span>Ask Nudge<Kbd>Ctrl J</Kbd>
        </button>
      )}
      {s.askOpen && !loc.pathname.startsWith('/app/agent') && (
        <div className="drawer"><AgentPanel onClose={() => setState(() => ({ askOpen: false }))} /></div>
      )}
      {s.cmdOpen && <CommandPalette />}
      {s.newEmailOpen && <NewEmail />}
      <Toasts />
    </div>
  )
}

function CommandPalette() {
  const nav = useNavigate()
  const contacts = useStore((s) => s.contacts)
  const deals = useStore((s) => s.deals)
  const [q, setQ] = useState('')
  const [hl, setHl] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const close = () => setState(() => ({ cmdOpen: false }))
  useEffect(() => { ref.current?.focus() }, [])
  const items = useMemo(() => {
    const pages = [['Home', '/app/home'], ['Review', '/app/review'], ['Inbox', '/app/inbox'], ['Follow-ups', '/app/follow-ups'], ['Calendar', '/app/calendar'], ['Agent', '/app/agent'], ['Pipeline', '/app/pipeline'], ['Contacts', '/app/contacts'], ['Companies', '/app/companies'], ['Templates', '/app/templates'], ['Reports', '/app/reports'], ['Settings', '/app/settings/profile']].map(([l, to]) => ({ g: 'Go to', l, sub: '', to }))
    const ppl = contacts.map((c) => ({ g: 'People', l: c.name, sub: c.email, to: '/app/contacts/' + c.id }))
    const dl = deals.map((d) => ({ g: 'Deals', l: d.name, sub: _m(d.amount, d.currency), to: '/app/pipeline/' + d.id }))
    const all = [...pages, ...ppl, ...dl]
    const n = q.trim().toLowerCase()
    return (n ? all.filter((i) => (i.l + ' ' + i.sub).toLowerCase().includes(n)) : all.filter((i) => i.g === 'Go to')).slice(0, 12)
  }, [q, contacts, deals])
  useEffect(() => setHl(0), [q])
  const go = (i: number) => { const it = items[i]; if (it) { close(); nav(it.to) } }
  let last = ''
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div className="cmdk" role="dialog" aria-label="Search">
        <div className="in"><Icon n="search" s={19} />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, deals, pages"
            onKeyDown={(e) => {
              if (e.key === 'Escape') close()
              if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(items.length - 1, h + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(0, h - 1)) }
              if (e.key === 'Enter') go(hl)
            }} />
          <Kbd>Esc</Kbd></div>
        <div className="list">
          {items.length === 0 && <div className="empty">No results for "{q}"</div>}
          {items.map((it, i) => {
            const head = it.g !== last ? <div className="grp" key={'g' + it.g}>{it.g}</div> : null
            last = it.g
            return [head, <button key={it.to + it.l} className={'it' + (i === hl ? ' hl' : '')} onMouseEnter={() => setHl(i)} onClick={() => go(i)}>{it.l}<span className="sub">{it.sub}</span></button>]
          })}
        </div>
      </div>
    </div>
  )
}

function NewEmail() {
  const mailboxes = useStore((s) => s.mailboxes)
  const [to, setTo] = useState(''); const [subject, setSubject] = useState(''); const [body, setBody] = useState('')
  const [from, setFrom] = useState(mailboxes[0].email)
  const [tried, setTried] = useState(false)
  const close = () => setState(() => ({ newEmailOpen: false }))
  const errs = { to: !emailOk(to) ? 'Enter a valid email address' : getState().contacts.find((c) => c.email === to)?.status === 'Opted out' ? 'This person opted out. Nudge will not send.' : '', subject: !subject.trim() ? 'Add a subject' : '', body: body.trim().length < 5 ? 'Write a message' : '' }
  const bad = Object.values(errs).some(Boolean)
  return (
    <Modal title="New email" onClose={close} wide
      foot={<><span className="note">Goes to Review first. Nothing sends without you.</span><div className="row"><button className="btn" onClick={close}>Cancel</button>
        <button className="btn primary" onClick={() => { setTried(true); if (bad) return; sendNewEmail(to, subject); close() }}>Send for approval</button></div></>}>
      <Field label="From"><select className="select" value={from} onChange={(e) => setFrom(e.target.value)}>{mailboxes.filter((m) => m.status === 'ok').map((m) => <option key={m.id}>{m.email}</option>)}</select></Field>
      <Field label="To" error={tried ? errs.to : ''}><input className={'input' + (tried && errs.to ? ' invalid' : '')} value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.com" /></Field>
      <Field label="Subject" error={tried ? errs.subject : ''}><input className={'input' + (tried && errs.subject ? ' invalid' : '')} value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field label="Message" error={tried ? errs.body : ''}><textarea className={'textarea' + (tried && errs.body ? ' invalid' : '')} value={body} onChange={(e) => setBody(e.target.value)} rows={6} /></Field>
    </Modal>
  )
}
