import { useState } from 'react'
import { NavLink, Navigate, useParams } from 'react-router-dom'
import { Icon, GoogleG, MsLogo } from '../components/Icons'
import { Avatar, Field, Modal, ReplyMark, Toggle, downloadCSV, emailOk, pwScore, useTitle } from '../components/ui'
import { LIMITS, clean, emailErr, nameErr, normEmail, passwordErr, personErr, phoneErr, textErr } from '../data/validate'
import { api, apiMessage } from '../api'
import { useSubmit } from '../components/guards'
import { logAudit, nid, patch, setSettings, setTheme, toast, useStore } from '../store'
import { REPLY_TYPES, type Fact, type Member } from '../data/seed'

const TABS = [
  { g: 'Personal', items: [['profile', 'Profile'], ['security', 'Security']] },
  { g: 'Workspace', items: [['workspace', 'Workspace'], ['team', 'Team and roles'], ['mailboxes', 'Mailboxes'], ['automation', 'Automation'], ['facts', 'Approved facts'], ['notifications', 'Notifications'], ['integrations', 'Integrations'], ['audit', 'Audit log']] },
]

export function Settings() {
  const { tab = 'profile' } = useParams()
  const mbWarn = useStore((s) => s.mailboxes.some((m) => m.status === 'expired'))
  const known = TABS.flatMap((g) => g.items.map((i) => i[0]))
  useTitle('Settings')
  if (!known.includes(tab)) return <Navigate to="/app/settings/profile" replace />
  return (
    <div className="page">
      <h1 className="h1">Settings</h1>
      <div className="set-grid">
        <nav className="set-nav" aria-label="Settings">
          {TABS.map((g) => <div key={g.g} style={{ display: 'contents' }}><div className="grp">{g.g}</div>
            {g.items.map(([k, l]) => <NavLink key={k} to={'/app/settings/' + k} className={({ isActive }) => (isActive ? 'on' : '')}>{l}{k === 'mailboxes' && mbWarn && <i className="warn" />}</NavLink>)}</div>)}
        </nav>
        <div style={{ minWidth: 0 }}>
          {tab === 'profile' && <Profile />}{tab === 'security' && <Security />}{tab === 'workspace' && <Workspace />}{tab === 'team' && <Team />}
          {tab === 'mailboxes' && <Mailboxes />}{tab === 'automation' && <Automation />}{tab === 'facts' && <Facts />}
          {tab === 'notifications' && <Notifications />}{tab === 'integrations' && <Integrations />}{tab === 'audit' && <Audit />}
        </div>
      </div>
    </div>
  )
}

function Head({ t, d, children }: { t: string; d?: string; children?: React.ReactNode }) {
  return <div className="sc-head"><div><div className="card-title">{t}</div>{d && <div className="card-sub">{d}</div>}</div>{children}</div>
}

function Profile() {
  const theme = useStore((s) => s.settings.theme)
  const [name, setName] = useState('Mahad Baig'); const [phone, setPhone] = useState('300 5550142'); const [tz, setTz] = useState('Asia/Karachi')
  const [tried, setTried] = useState(false)
  const e = { name: personErr(name), phone: phoneErr(phone) }
  return (<>
    <div className="card set-card"><Head t="Profile" d="Your name appears on drafts you approve." />
      <div className="form-stack">
        <Field label="Full name" error={tried ? e.name : ''}><input className={'input' + (tried && e.name ? ' invalid' : '')} maxLength={LIMITS.name} autoComplete="name" value={name} onChange={(x) => setName(x.target.value)} /></Field>
        <Field label="Email" hint="Email is your sign-in. Contact support to change it."><input className="input readonly" value="mahad@acme.co" readOnly /></Field>
        <Field label="Phone" opt error={tried ? e.phone : ''}><div className="phone-row"><select className="select" defaultValue="+92"><option>+92</option><option>+1</option><option>+44</option><option>+971</option></select><input className={'input' + (tried && e.phone ? ' invalid' : '')} type="tel" inputMode="tel" autoComplete="tel-national" maxLength={LIMITS.phone} value={phone} onChange={(x) => setPhone(x.target.value)} /></div></Field>
        <Field label="Time zone"><select className="select" value={tz} onChange={(x) => setTz(x.target.value)}>{['Asia/Karachi', 'Europe/London', 'America/New_York', 'Asia/Dubai'].map((z) => <option key={z}>{z}</option>)}</select></Field>
      </div>
      <div className="actions-end"><button className="btn primary" onClick={() => { setTried(true); if (e.name || e.phone) return; setSettings({ tz }); toast('Profile saved') }}>Save changes</button></div></div>
    <div className="card set-card"><Head t="Appearance" d="Choose how Nudge looks on this device." />
      <div className="appearance">{([['light', 'Light'], ['dark', 'Dark'], ['system', 'System']] as const).map(([k, l]) => (
        <button key={k} className={'app-opt' + (theme === k ? ' on' : '')} onClick={() => setTheme(k)} role="radio" aria-checked={theme === k}><span className={'swatch ' + (k === 'dark' ? 'dark' : k === 'system' ? 'sys' : '')} />{l}</button>))}</div></div>
  </>)
}

function Security() {
  const twoFA = useStore((s) => s.settings.twoFA)
  const { busy, run } = useSubmit()
  const [cur, setCur] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [show, setShow] = useState(false); const [tried, setTried] = useState(false)
  const [sessions, setSessions] = useState([{ id: 1, d: 'Chrome on Windows', m: 'Karachi, PK · This device · Active now', me: true }, { id: 2, d: 'Safari on iPhone', m: 'Karachi, PK · 2 hours ago', me: false }, { id: 3, d: 'Chrome on macOS', m: 'Lahore, PK · 6 days ago', me: false }])
  const sc = pwScore(pw)
  const e = { cur: !cur ? 'Enter your current password.' : cur.length > LIMITS.password ? 'That password is too long.' : '', pw: passwordErr(pw, { email: 'mahad@acme.co', name: 'Mahad Baig' }) || (pw === cur ? 'Choose a password you have not used here.' : ''), pw2: !pw2 ? 'Confirm your new password.' : pw2 !== pw ? 'Passwords do not match.' : '' }
  return (<>
    <div className="card set-card"><Head t="Password" d="Use a long password you do not use anywhere else." />
      <div className="form-stack" style={{ maxWidth: 440 }}>
        <Field label="Current password" error={tried ? e.cur : ''}><input className={'input' + (tried && e.cur ? ' invalid' : '')} type={show ? 'text' : 'password'} autoComplete="current-password" maxLength={LIMITS.password} value={cur} onChange={(x) => setCur(x.target.value)} /></Field>
        <Field label="New password" error={tried ? e.pw : ''}><input className={'input' + (tried && e.pw ? ' invalid' : '')} type={show ? 'text' : 'password'} autoComplete="new-password" maxLength={LIMITS.password} value={pw} onChange={(x) => setPw(x.target.value)} /><div className={'strength s' + sc}><i /><i /><i /><i /></div></Field>
        <Field label="Confirm new password" error={tried ? e.pw2 : ''}><input className={'input' + (tried && e.pw2 ? ' invalid' : '')} type={show ? 'text' : 'password'} autoComplete="new-password" maxLength={LIMITS.password} value={pw2} onChange={(x) => setPw2(x.target.value)} /></Field>
        <label className="row" style={{ fontSize: 13.5 }}><input type="checkbox" className="check" checked={show} onChange={(x) => setShow(x.target.checked)} />Show passwords</label>
      </div>
      <div className="actions-end"><button className="btn primary" disabled={busy} onClick={() => { setTried(true); if (e.cur || e.pw || e.pw2) return; void run(async () => { try { await api.auth.changePassword({ current: cur, password: pw }); setCur(''); setPw(''); setPw2(''); setTried(false); logAudit('Changed password', 'Account'); toast('Password updated') } catch (err) { toast(apiMessage(err)) } }) }}>{busy ? 'Updating…' : 'Update password'}</button></div></div>
    <div className="card set-card"><Head t="Two-step sign-in" d="Ask for a 6-digit code from your authenticator app at sign-in." />
      <div className="set-row" style={{ borderTop: 0, paddingBottom: 0 }}><div className="grow"><b>Authenticator app <span className={'tag ' + (twoFA ? 'green' : 'grey')}>{twoFA ? 'On' : 'Off'}</span></b></div><Toggle on={twoFA} label="Two-step sign-in" onChange={(v) => { setSettings({ twoFA: v }); toast(v ? 'Two-step sign-in is on' : 'Two-step sign-in is off') }} /></div></div>
    <div className="card set-card"><Head t="Active sessions" />
      {sessions.map((s) => <div className="session" key={s.id}><div><b>{s.d}{s.me && <span className="tag green">This device</span>}</b><div className="m">{s.m}</div></div>{!s.me && <button className="btn sm danger" onClick={() => { setSessions(sessions.filter((x) => x.id !== s.id)); toast('Session signed out') }}>Sign out</button>}</div>)}</div>
  </>)
}

function Workspace() {
  const st = useStore((s) => s.settings)
  const [name, setName] = useState('Acme Sales'); const [stages, setStages] = useState(st.dealStages); const [nw, setNw] = useState('')
  const wsErr = nameErr(name, 'workspace name', 2, LIMITS.company)
  const [stTried, setStTried] = useState(false)
  const stageErr = (list: string[]) => list.map((x, i) => {
    const t = clean(x)
    if (!t) return 'Name this stage.'
    if (t.length > LIMITS.stage) return `Keep it under ${LIMITS.stage} characters.`
    if (/[<>]/.test(t)) return 'Remove < and >.'
    if (list.findIndex((y) => clean(y).toLowerCase() === t.toLowerCase()) !== i) return 'Another stage has this name.'
    return ''
  })
  const sErr = stageErr(stages)
  const nwErr = !clean(nw) ? '' : stageErr([...stages, nw]).pop() ?? ''
  const mv = (i: number, d: number) => { if (i < 1 || i + d < 1 || i + d > stages.length - 3) return; const a = [...stages]; [a[i], a[i + d]] = [a[i + d], a[i]]; setStages(a) }
  return (<>
    <div className="card set-card"><Head t="Workspace" /><div className="form-stack">
      <Field label="Workspace name" error={wsErr}><input className={'input' + (wsErr ? ' invalid' : '')} maxLength={LIMITS.company} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label="Default currency" hint="Deals keep their own currency. USD and PKR are never added together."><select className="select" defaultValue="USD"><option>USD</option><option>PKR</option></select></Field>
      <Field label="Time zone"><select className="select" value={st.tz} onChange={(e) => setSettings({ tz: e.target.value })}>{['Asia/Karachi', 'Europe/London', 'America/New_York'].map((z) => <option key={z}>{z}</option>)}</select></Field></div>
      <div className="actions-end"><button className="btn primary" onClick={() => { if (wsErr) return; toast('Workspace saved') }}>Save changes</button></div></div>
    <div className="card set-card"><Head t="Quiet hours" d="Nudge holds approved sends outside these hours." />
      <div className="set-row" style={{ borderTop: 0 }}><div className="grow"><b>Hold sends overnight</b></div><Toggle on={st.quietOn} label="Quiet hours" onChange={(v) => setSettings({ quietOn: v })} /></div>
      {st.quietOn && <div className="time-row"><Field label="From"><select className="select" value={st.quietFrom} onChange={(e) => setSettings({ quietFrom: e.target.value })}>{['6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'].map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="To"><select className="select" value={st.quietTo} onChange={(e) => setSettings({ quietTo: e.target.value })}>{['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM'].map((t) => <option key={t}>{t}</option>)}</select></Field></div>}</div>
    <div className="card set-card"><Head t="Deal stages" d="Won and Lost are fixed. Rename or reorder the rest." />
      <div className="stage-list">{stages.map((s, i) => { const fixed = i >= stages.length - 2; return (
        <div className="stage-li" key={i}><span className="n">{i + 1}</span><i className="dot round" style={{ background: `var(--st-${['new', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost'][Math.min(i, 6)]})` }} />
          {fixed ? <span>{s}<span className="w"> · fixed</span></span> : <span className="grow"><input className={'input' + (stTried && sErr[i] ? ' invalid' : '')} style={{ height: 34 }} maxLength={LIMITS.stage + 10} aria-label={'Stage ' + (i + 1)} value={s} onChange={(e) => setStages(stages.map((x, j) => (j === i ? e.target.value : x)))} />{stTried && sErr[i] && <span className="err">{sErr[i]}</span>}</span>}
          {!fixed && <span className="row" style={{ gap: 2 }}><button className="icon-btn" aria-label="Move up" onClick={() => mv(i, -1)}><Icon n="chevD" s={15} style={{ transform: 'rotate(180deg)' }} /></button><button className="icon-btn" aria-label="Move down" onClick={() => mv(i, 1)}><Icon n="chevD" s={15} /></button></span>}</div>)})}</div>
      <div className="row" style={{ marginTop: 14 }}><input className={'input' + (nwErr ? ' invalid' : '')} style={{ maxWidth: 280, height: 36 }} maxLength={LIMITS.stage + 10} placeholder="New stage name" value={nw} onChange={(e) => setNw(e.target.value)} /><button className="btn" disabled={!clean(nw) || !!nwErr || stages.length >= 12} onClick={() => { const a = [...stages]; a.splice(a.length - 2, 0, clean(nw)); setStages(a); setNw('') }}>Add stage</button>{nwErr && <span className="err">{nwErr}</span>}{stages.length >= 12 && <span className="hint">Twelve stages is the limit.</span>}</div>
      <div className="actions-end"><button className="btn primary" onClick={() => { setStTried(true); if (sErr.some(Boolean)) { toast('Fix the stage names first'); return } setSettings({ dealStages: stages.map(clean) }); toast('Stages saved') }}>Save stages</button></div></div>
  </>)
}

function Team() {
  const members = useStore((s) => s.members)
  const [inv, setInv] = useState(false)
  return (<>
    <div className="card set-card"><Head t="People" d={members.length + ' members. Owners and admins can change settings.'}><button className="btn primary" onClick={() => setInv(true)}><Icon n="plus" s={15} w={2.2} />Invite</button></Head>
      <div className="person-row head"><span>Name</span><span>Role</span><span>Team</span><span>Last active</span><span /></div>
      {members.map((m) => <div className="person-row" key={m.id}>
        <div className="person-cell"><Avatar name={m.name} tint={m.tint} /><div><b>{m.name}</b><span className="mono">{m.email}</span></div></div>
        {m.role === 'Owner' ? <span>Owner</span> : <select className="select" value={m.role} aria-label="Role" onChange={(e) => { patch('members', (a) => a.map((x) => (x.id === m.id ? { ...x, role: e.target.value as Member['role'] } : x))); logAudit('Changed role to ' + e.target.value, m.name); toast(m.name + ' is now ' + e.target.value) }}><option>Admin</option><option>Member</option></select>}
        <span>{m.team}</span><span className="muted">{m.last}</span>
        <span style={{ textAlign: 'right' }}>{m.role !== 'Owner' && <button className="btn sm danger" onClick={() => { patch('members', (a) => a.filter((x) => x.id !== m.id)); toast(m.name + ' removed') }}>Remove</button>}</span></div>)}</div>
    <div className="card set-card"><Head t="Teams" />
      {[['Sales', 'Replies and deals for new business', members.filter((m) => m.team === 'Sales')], ['Support', 'Existing customers and renewals', members.filter((m) => m.team === 'Support')]].map(([n, d, ms]) => (
        <div className="team-row" key={n as string}><div className="grow"><b>{n as string}</b><div className="muted" style={{ fontSize: 13 }}>{d as string}</div></div>
          <div className="stack-av">{(ms as Member[]).map((m) => <Avatar key={m.id} name={m.name} tint={m.tint} size="sm" />)}</div><span className="muted" style={{ fontSize: 13 }}>{(ms as Member[]).length} people</span></div>))}</div>
    {inv && <Invite onClose={() => setInv(false)} />}
  </>)
}
function Invite({ onClose }: { onClose: () => void }) {
  const members = useStore((s) => s.members)
  const [email, setEmail] = useState(''); const [role, setRole] = useState<'Admin' | 'Member'>('Member'); const [tried, setTried] = useState(false)
  const err = emailErr(email) || (members.some((m) => normEmail(m.email) === normEmail(email)) ? 'Already on the team.' : '')
  return (<Modal title="Invite teammate" onClose={onClose} foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
    <button className="btn primary" onClick={() => { setTried(true); if (err) return; const nm = normEmail(email).split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()); patch('members', (a) => [...a, { id: nid('u'), name: nm, initials: nm.slice(0, 2).toUpperCase(), tint: 't-lav', email: normEmail(email), role, team: 'Sales', last: 'Invited just now', status: 'Invited' }]); toast('Invite sent to ' + email); onClose() }}>Send invite</button></div></>}>
    <Field label="Email" error={tried ? err : ''}><input className={'input' + (tried && err ? ' invalid' : '')} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={LIMITS.email} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setEmail((v) => normEmail(v))} autoFocus /></Field>
    <Field label="Role"><select className="select" value={role} onChange={(e) => setRole(e.target.value as 'Admin')}><option>Member</option><option>Admin</option></select></Field></Modal>)
}

function Mailboxes() {
  const mbs = useStore((s) => s.mailboxes)
  const [add, setAdd] = useState(false)
  return (<>
    <div className="card set-card" style={{ paddingBottom: 6 }}><Head t="Connected mailboxes" d="Nudge reads and drafts. It sends only after you approve."><button className="btn primary" onClick={() => setAdd(true)}><Icon n="plus" s={15} w={2.2} />Connect mailbox</button></Head>
      {mbs.map((m) => <div className={'mbx' + (m.status === 'expired' ? ' warn' : '')} key={m.id}>
        <span className="logo">{m.provider === 'Google' ? <GoogleG /> : <MsLogo />}</span>
        <div className="grow"><div className="em">{m.email}</div><div className="sub">{m.provider} · {m.owner}</div></div>
        <span className={'sync' + (m.status === 'expired' ? ' warn' : '')}>{m.sync}</span>
        {m.status === 'expired' ? <button className="btn sm primary" onClick={() => { patch('mailboxes', (a) => a.map((x) => (x.id === m.id ? { ...x, status: 'ok', sync: 'Synced just now' } : x))); toast(m.email + ' reconnected') }}>Sign in again</button>
          : <button className="btn sm danger" onClick={() => { patch('mailboxes', (a) => a.filter((x) => x.id !== m.id)); toast(m.email + ' disconnected') }}>Disconnect</button>}</div>)}</div>
    {add && <Modal title="Connect a mailbox" onClose={() => setAdd(false)}>
      {[['Google', <GoogleG key="g" s={20} />, 'Gmail and Google Workspace'], ['Microsoft', <MsLogo key="m" s={20} />, 'Outlook and Microsoft 365']].map(([p, ic, d]) => (
        <button key={p as string} className="provider" style={{ justifyContent: 'flex-start', padding: '0 16px' }} onClick={() => { const em = `new${mbs.length}@acme.co`; patch('mailboxes', (a) => [...a, { id: nid('m'), email: em, provider: p as 'Google', status: 'ok', sync: 'Synced just now', owner: 'Mahad Baig' }]); toast(em + ' connected'); setAdd(false) }}>{ic}<span>{p as string}</span><span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>{d as string}</span></button>))}
      <p className="hint">In this demo, connecting adds a sample mailbox.</p></Modal>}
  </>)
}

function Automation() {
  const st = useStore((s) => s.settings)
  const [ask, setAsk] = useState<Record<string, boolean>>(Object.fromEntries(REPLY_TYPES.map((r) => [r.id, true])))
  const unlocked = st.approvals >= 50
  return (<>
    <div className="card set-card"><Head t="How much should Nudge do on its own?" />
      <div className="mode-grid">
        <button className={'mode' + (st.mode === 'draft' ? ' on' : '')} onClick={() => setSettings({ mode: 'draft' })}><input type="radio" className="radio" readOnly checked={st.mode === 'draft'} /><div><b>Draft-only</b><div className="muted" style={{ marginTop: 4 }}>Nudge drafts every reply. You approve each one before it sends.</div></div></button>
        <button className={'mode' + (st.mode === 'auto' ? ' on' : '') + (unlocked ? '' : ' locked')} onClick={() => { if (!unlocked) { toast(`Unlocks after 50 approvals. You have ${st.approvals}.`); return } setSettings({ mode: 'auto' }) }}><input type="radio" className="radio" readOnly checked={st.mode === 'auto'} disabled={!unlocked} /><div><b>Act when sure {!unlocked && <Icon n="lock" s={14} />}</b><div className="muted" style={{ marginTop: 4 }}>Nudge sends on its own only above your confidence bar, and never to someone who opted out.</div></div></button>
      </div>
      <div style={{ marginTop: 22, fontSize: 13.5 }}>{unlocked ? 'Unlocked.' : <><b>{st.approvals}</b> of 50 approvals to unlock "Act when sure"</>}</div>
      <div className="progress"><i style={{ width: Math.min(100, (st.approvals / 50) * 100) + '%' }} /></div></div>
    <div className="card set-card"><Head t="Confidence bar" d="Replies below this number always wait for you." />
      <div className="slider-block"><div className="t"><b>Ask me when confidence is below</b><span className="mono">{st.threshold}</span></div>
        <input className="range" type="range" min={60} max={99} value={st.threshold} style={{ ['--p' as string]: ((st.threshold - 60) / 39) * 100 + '%' }} onChange={(e) => setSettings({ threshold: Number(e.target.value) })} aria-label="Confidence bar" />
        <div className="row spread muted mono" style={{ fontSize: 11.5, marginTop: 8 }}><span>60</span><span>99</span></div></div></div>
    <div className="card set-card"><Head t="By reply type" d="Always ask for the types you never want handled automatically." />
      <div className="prep head"><span>Reply type</span><span>When Nudge is sure</span><span>Always ask me</span></div>
      {REPLY_TYPES.map((r) => { const forced = r.id === 'optout' || r.id === 'unclear'; return (<div className="prep" key={r.id}><span className="rt"><ReplyMark t={r.id} /></span><span className="when">{forced ? 'Always needs you' : st.mode === 'draft' ? 'Draft for approval' : 'Send automatically'}</span>
        <Toggle on={forced || ask[r.id]} disabled={forced} label={'Always ask for ' + r.label} onChange={(v) => setAsk({ ...ask, [r.id]: v })} /></div>) })}</div>
  </>)
}

function Facts() {
  const facts = useStore((s) => s.facts)
  const [edit, setEdit] = useState<Fact | 'new' | null>(null)
  return (<>
    <div className="card set-card"><Head t="Approved facts" d="Nudge may only state what is on this list. A fact that is off never appears in a draft."><button className="btn primary" onClick={() => setEdit('new')}><Icon n="plus" s={15} w={2.2} />Add fact</button></Head>
      {facts.map((f) => <div className="fact-row" key={f.id}><div><b>{f.key}</b><div className="v">{f.value}</div><div className="m">{f.when} · {f.by}</div></div>
        <button className="btn sm" onClick={() => setEdit(f)}>Edit</button><Toggle on={f.on} label={f.key} onChange={(v) => { patch('facts', (a) => a.map((x) => (x.id === f.id ? { ...x, on: v } : x))); logAudit(v ? 'Turned on fact' : 'Turned off fact', f.key) }} /></div>)}</div>
    {edit && <FactModal fact={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
  </>)
}
function FactModal({ fact, onClose }: { fact: Fact | null; onClose: () => void }) {
  const [key, setKey] = useState(fact?.key ?? ''); const [val, setVal] = useState(fact?.value ?? ''); const [tried, setTried] = useState(false)
  const facts = useStore((x) => x.facts)
  const e = {
    key: nameErr(key, 'fact name', 2, 60) || (facts.some((f) => f.id !== fact?.id && clean(f.key).toLowerCase() === clean(key).toLowerCase()) ? 'A fact with this name already exists.' : ''),
    val: textErr(val, 'fact', 5, LIMITS.fact),
  }
  return (<Modal title={fact ? 'Edit fact' : 'Add fact'} onClose={onClose} foot={<><span className="note">Only state what is true today.</span><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
    <button className="btn primary" onClick={() => { setTried(true); if (e.key || e.val) return
      if (fact) patch('facts', (a) => a.map((x) => (x.id === fact.id ? { ...x, key: clean(key), value: clean(val), when: 'Updated just now', by: 'Mahad Baig' } : x)))
      else patch('facts', (a) => [...a, { id: nid('fa'), key: clean(key), value: clean(val), on: true, by: 'Mahad Baig', when: 'Added just now' }])
      logAudit(fact ? 'Changed approved fact' : 'Added approved fact', key); toast('Fact saved'); onClose() }}>Save</button></div></>}>
    <Field label="Name" error={tried ? e.key : ''}><input className={'input' + (tried && e.key ? ' invalid' : '')} maxLength={70} value={key} onChange={(x) => setKey(x.target.value)} autoFocus /></Field>
    <Field label="What Nudge may say" error={tried ? e.val : ''}><textarea className={'textarea' + (tried && e.val ? ' invalid' : '')} rows={3} maxLength={LIMITS.fact + 20} value={val} onChange={(x) => setVal(x.target.value)} /><span className="hint">{clean(val).length}/{LIMITS.fact}</span></Field></Modal>)
}

function Notifications() {
  const n = useStore((s) => s.settings.notif)
  const rows: [string, string, string][] = [['review', 'New reply to review', 'When a customer reply needs your approval'], ['followup', 'Follow-ups due', 'A morning list of people who went quiet'], ['meeting', 'Meetings', 'Reminders 15 minutes before'], ['mailbox', 'Mailbox problems', 'When a connection expires or fails'], ['digest', 'Weekly summary', 'A Monday email with last week in numbers']]
  return (<div className="card set-card"><Head t="Notifications" d="Sent to mahad@acme.co. Quiet hours still apply." />
    {rows.map(([k, t, d], i) => <div className="set-row" key={k} style={i === 0 ? { borderTop: 0 } : undefined}><div className="grow"><b>{t}</b><div className="d">{d}</div></div><Toggle on={n[k]} label={t} onChange={(v) => setSettings({ notif: { ...n, [k]: v } })} /></div>)}</div>)
}

function Integrations() {
  const ints = useStore((s) => s.settings.ints)
  const list: [string, string, React.ReactNode][] = [['google', 'Google Workspace', <GoogleG key="g" s={22} />], ['microsoft', 'Microsoft 365', <MsLogo key="m" s={22} />], ['calendar', 'Calendar', <Icon key="c" n="calendar" s={20} />], ['slack', 'Slack', <Icon key="s" n="bolt" s={20} />], ['hubspot', 'HubSpot', <Icon key="h" n="users" s={20} />], ['webhooks', 'Webhooks', <Icon key="w" n="link" s={20} />]]
  const desc: Record<string, string> = { google: 'Read mail and create drafts in Gmail.', microsoft: 'Read mail and create drafts in Outlook.', calendar: 'Check availability and hold meeting times.', slack: 'Get a message when a reply needs review.', hubspot: 'Sync contacts and deals both ways.', webhooks: 'Send events to your own systems.' }
  return (<div className="card set-card"><Head t="Integrations" d="Connect the tools your team already uses." />
    <div className="int-grid">{list.map(([k, t, ic]) => <div className="int-card" key={k}><div className="hd"><span className="logo-box" style={{ color: '#171717' }}>{ic}</span><div><b>{t}</b><span className={'s' + (ints[k] ? ' on' : '')}><i />{ints[k] ? 'Connected' : 'Not connected'}</span></div></div>
      <div className="d">{desc[k]}</div><div><button className={'btn sm' + (ints[k] ? '' : ' primary')} onClick={() => { setSettings({ ints: { ...ints, [k]: !ints[k] } }); toast(ints[k] ? t + ' disconnected' : t + ' connected') }}>{ints[k] ? 'Disconnect' : 'Connect'}</button></div></div>)}</div></div>)
}

function Audit() {
  const audit = useStore((s) => s.audit)
  const [f, setF] = useState('all')
  const rows = audit.filter((a) => f === 'all' || (f === 'nudge' ? a.who === 'Nudge' : a.who !== 'Nudge'))
  return (<div className="card set-card"><Head t="Audit log" d="Everything people and Nudge did. Entries cannot be edited.">
    <div className="row"><select className="select" style={{ width: 140, height: 34 }} value={f} onChange={(e) => setF(e.target.value)} aria-label="Filter"><option value="all">Everyone</option><option value="people">People</option><option value="nudge">Nudge</option></select>
      <button className="btn" onClick={() => downloadCSV('audit-log.csv', [['When', 'Who', 'Action', 'On'], ...rows.map((a) => [a.time, a.who, a.action, a.on])])}><Icon n="download" s={15} />Export</button></div></Head>
    <div className="audit-row head"><span>When</span><span>Who</span><span>Action</span><span>On</span></div>
    {rows.map((a) => <div className="audit-row" key={a.id}><span className="tm">{a.time}</span><span className="who"><Avatar name={a.ini === 'N' ? 'Nudge' : a.who} tint={a.tint} size="xs" />{a.who}</span><span>{a.action}</span><span className="on">{a.on}</span></div>)}</div>)
}
