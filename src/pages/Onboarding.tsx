import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { Brand, GoogleG, Icon, MsLogo } from '../components/Icons'
import { Field, Toggle, useTitle } from '../components/ui'
import { LIMITS, clean, nameErr, textErr } from '../data/validate'
import { getState, patch, setSettings, toast, useStore, nid } from '../store'

const STEPS = [['Connect your mailbox', '1 min'], ['Teach Nudge your facts', '2 min'], ['Choose how careful it is', '1 min'], ['Set your hours', '1 min'], ['Review your first reply', '1 min']]

export function Onboarding() {
  const { step = '1' } = useParams()
  const n = /^[1-5]$/.test(step) ? Number(step) : 0
  const nav = useNavigate()
  const st = useStore((s) => s.settings)
  const facts = useStore((s) => s.facts)
  const [prov, setProv] = useState<'Google' | 'Microsoft' | ''>('')
  const [err, setErr] = useState('')
  const [fk, setFk] = useState(''); const [fv, setFv] = useState('')
  useTitle('Set up')
  if (!(n >= 1 && n <= 5)) return <Navigate to="/onboarding/1" replace />

  const next = () => {
    setErr('')
    if (n === 1 && !prov) { setErr('Choose a mailbox to connect, or skip for now.'); return }
    if (n === 2 && facts.filter((f) => f.on).length === 0) { setErr('Turn on at least one fact so Nudge has something it may say.'); return }
    if (n === 5) { toast('You are set up. Welcome to Nudge.'); nav('/app/home'); return }
    nav('/onboarding/' + (n + 1))
  }
  const addFact = () => {
    const fe = nameErr(fk, 'fact name', 2, 60) || textErr(fv, 'fact', 5, LIMITS.fact) || (facts.some((f) => clean(f.key).toLowerCase() === clean(fk).toLowerCase()) ? 'A fact with this name already exists.' : '')
    if (fe) { setErr(fe); return }
    patch('facts', (a) => [...a, { id: nid('fa'), key: clean(fk), value: clean(fv), on: true, by: getState().user?.name ?? '', when: 'Added just now' }]); setFk(''); setFv(''); setErr('')
  }

  return (
    <div className="ob">
      <div className="ob-left">
        <div className="ob-top"><Brand /><Link className="link" to="/app/home" style={{ fontSize: 14 }}>Skip setup</Link></div>
        <div className="steps" aria-label="Progress">
          {STEPS.map(([t, m], i) => <div key={t} className={'step' + (i + 1 < n ? ' done' : i + 1 === n ? ' now' : '')}><span className="num">{i + 1 < n ? <Icon n="check" s={13} w={3} /> : i + 1}</span>{t}<span className="t">{m}</span></div>)}
        </div>

        {n === 1 && <><h1>Connect your mailbox</h1><p className="lead">Nudge reads replies and writes drafts. It cannot send until you approve.</p>
          {([['Google', <GoogleG key="g" s={22} />, 'Gmail or Google Workspace'], ['Microsoft', <MsLogo key="m" s={22} />, 'Outlook or Microsoft 365']] as const).map(([p, ic, d]) => (
            <button key={p} className={'opt-card' + (prov === p ? ' on' : '')} onClick={() => { setProv(p); setErr('') }} aria-pressed={prov === p}>{ic}<div className="grow"><b>{p}</b><div className="muted">{d}</div></div>{prov === p && <Icon n="check" s={18} w={2.4} />}</button>))}
          <p className="hint">Read-only until you approve a draft. You can disconnect any time in Settings.</p></>}

        {n === 2 && <><h1>Teach Nudge your facts</h1><p className="lead">Nudge only states what you approve here. Anything else it leaves for you.</p>
          {facts.map((f) => <div key={f.id} className="row" style={{ padding: '12px 0', borderTop: '1px solid var(--hair)' }}><div className="grow"><b style={{ fontSize: 14 }}>{f.key}</b><div className="muted" style={{ fontSize: 13.5 }}>{f.value}</div></div><Toggle on={f.on} label={f.key} onChange={(v) => patch('facts', (a) => a.map((x) => (x.id === f.id ? { ...x, on: v } : x)))} /></div>)}
          <div className="grid-2" style={{ marginTop: 18 }}><Field><input className="input" maxLength={70} placeholder="Fact name" value={fk} onChange={(e) => setFk(e.target.value)} /></Field><Field><input className="input" maxLength={LIMITS.fact + 20} placeholder="What Nudge may say" value={fv} onChange={(e) => setFv(e.target.value)} /></Field></div>
          <button className="btn sm" style={{ marginTop: 10, alignSelf: 'flex-start' }} onClick={addFact}><Icon n="plus" s={14} />Add fact</button></>}

        {n === 3 && <><h1>Choose how careful it is</h1><p className="lead">You can start with every reply waiting for you. Nudge earns more freedom as you approve.</p>
          <button className={'opt-card' + (st.mode === 'draft' ? ' on' : '')} onClick={() => setSettings({ mode: 'draft' })}><Icon n="shield" s={22} /><div><b>Draft-only (recommended)</b><div className="muted">You approve every reply before it sends.</div></div></button>
          <div className="opt-card locked"><Icon n="lock" s={22} /><div><b>Act when sure</b><div className="muted">Unlocks after 50 approvals. You have {st.approvals}.</div></div></div>
          <div style={{ marginTop: 18 }}><div className="row spread" style={{ fontSize: 14, marginBottom: 10 }}><b style={{ fontWeight: 500 }}>Ask me when confidence is below</b><span className="mono">{st.threshold}</span></div>
            <input className="range" type="range" min={60} max={99} value={st.threshold} style={{ ['--p' as string]: ((st.threshold - 60) / 39) * 100 + '%' }} onChange={(e) => setSettings({ threshold: Number(e.target.value) })} aria-label="Confidence bar" /></div></>}

        {n === 4 && <><h1>Set your hours</h1><p className="lead">Approved replies wait during quiet hours and go out when the day starts.</p>
          <Field label="Time zone"><select className="select" value={st.tz} onChange={(e) => setSettings({ tz: e.target.value })}>{['Asia/Karachi', 'Europe/London', 'America/New_York', 'Asia/Dubai'].map((z) => <option key={z}>{z}</option>)}</select></Field>
          <div className="row spread" style={{ margin: '20px 0 14px' }}><b style={{ fontWeight: 500 }}>Hold sends overnight</b><Toggle on={st.quietOn} label="Quiet hours" onChange={(v) => setSettings({ quietOn: v })} /></div>
          {st.quietOn && <div className="time-row"><Field label="From"><select className="select" value={st.quietFrom} onChange={(e) => setSettings({ quietFrom: e.target.value })}>{['6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'].map((t) => <option key={t}>{t}</option>)}</select></Field><Field label="To"><select className="select" value={st.quietTo} onChange={(e) => setSettings({ quietTo: e.target.value })}>{['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM'].map((t) => <option key={t}>{t}</option>)}</select></Field></div>}</>}

        {n === 5 && <><h1>Review your first reply</h1><p className="lead">We found a sample reply so you can see how approving feels. Nothing here is sent.</p>
          <div className="card pad"><div className="row spread"><b>Sara Ali · Northwind</b><span className="rt"><i style={{ background: 'var(--rt-meeting)' }} />Meeting request</span></div>
            <p style={{ margin: '12px 0', lineHeight: 1.7 }}>Could we do <mark className="ev">Thursday at 3pm to go through rollout?</mark><sup className="ref">[1]</sup></p>
            <div className="callout green"><Icon n="sparkle" s={16} /><span>Draft ready: “Thursday at 3:00 PM works well. I will send an invite now.”</span></div></div></>}

        {err && <p className="err" style={{ marginTop: 14 }}>{err}</p>}
        <div className="ob-actions">
          {n > 1 && <button className="btn lg" onClick={() => nav('/onboarding/' + (n - 1))}><Icon n="arrowL" s={16} />Back</button>}
          <button className="btn primary lg" onClick={next}>{n === 5 ? 'Go to Nudge' : 'Continue'}<Icon n="arrowR" s={16} /></button>
          {(n === 1) && <button className="btn ghost lg" onClick={() => nav('/onboarding/2')}>Skip for now</button>}
        </div>
      </div>

      <div className="ob-right">
        <span className="kicker">Preview</span>
        <div>
          <div className="prev">
            <div className="prev-bar"><i /><i /><i /><span style={{ marginLeft: 8 }}>{['Inbox', 'Approved facts', 'Automation', 'Quiet hours', 'Review'][n - 1]}</span></div>
            <div style={{ padding: 22, minHeight: 260 }}>
              {n === 1 && <FirstLook prov={prov} />}
              {n === 2 && facts.map((f) => <div key={f.id} className="row" style={{ padding: '10px 0', borderTop: '1px solid #eee', opacity: f.on ? 1 : 0.4 }}><span style={{ fontSize: 13.5, fontWeight: 600, width: 130 }}>{f.key}</span><span style={{ fontSize: 13.5, color: '#555' }}>{f.value}</span></div>)}
              {n === 3 && <div><div style={{ fontSize: 13, color: '#777' }}>Confidence for a meeting request</div><div style={{ height: 6, background: '#eee', borderRadius: 4, margin: '14px 0', position: 'relative' }}><div style={{ width: '94%', height: 6, background: '#444', borderRadius: 4 }} /><div style={{ position: 'absolute', left: st.threshold + '%', top: -5, width: 2, height: 16, background: '#8f5200' }} /></div><div style={{ fontSize: 14 }}>94 is {94 >= st.threshold ? 'above' : 'below'} your bar of {st.threshold}.</div><div className="tag green" style={{ marginTop: 12 }}>Draft waits for your approval</div></div>}
              {n === 4 && <div><div style={{ fontSize: 13, color: '#777' }}>{st.tz}</div><div className="row" style={{ margin: '16px 0', gap: 3 }}>{Array.from({ length: 24 }, (_, h) => <i key={h} style={{ flex: 1, height: 38, borderRadius: 3, background: h >= 8 && h < 20 ? '#1a7f37' : '#e6e6e6' }} />)}</div><div className="row spread mono" style={{ fontSize: 11.5, color: '#888' }}><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span></div><div style={{ marginTop: 16, fontSize: 14 }}>{st.quietOn ? `Sends hold from ${st.quietFrom} to ${st.quietTo}.` : 'Sends go out any time.'}</div></div>}
              {n === 5 && <div style={{ fontSize: 14.5, lineHeight: 1.7 }}>Hi Sara,<br /><br />Thursday at 3:00 PM works well. I will send an invite now.<br /><br />Best,<br />Mahad<div className="row" style={{ marginTop: 18 }}><span className="btn approve sm">Approve &amp; queue</span><span className="btn sm">Reject</span></div></div>}
            </div>
          </div>
          <p className="prev-cap">{['Replies from this mailbox flow into Review.', 'Only these facts can appear in a draft.', 'The bar decides what waits for you.', 'Shaded hours are when Nudge may send.', 'This is the daily loop: read, approve, done.'][n - 1]}</p>
        </div>
      </div>
    </div>
  )
}

const FIRST: [string, string, string, string, string][] = [
  ['HQ', 'Hassan Qureshi · Lumen Textiles', 'Can we do a call on Thursday morning?', 'Meeting request', '92'],
  ['EC', 'Emily Carter · Brookfield Supply', 'What would 40 seats cost per year?', 'Pricing request', '89'],
  ['OF', 'Omar Farooq · Indus Steel', 'Let’s reconnect after Eid, budgets reopen then.', 'Defer', '74'],
  ['ZM', 'Zara Malik · Harbor Freight Co', 'We already use something similar, why switch?', 'Objection', '86'],
]
const FIRST_VAR: Record<string, string> = { 'Meeting request': 'meeting', 'Pricing request': 'pricing', Defer: 'defer', Objection: 'objection' }
function FirstLook({ prov }: { prov: string }) {
  return (
    <div className="firstlook">
      <div className="fl-head"><b>{prov ? 'Reading the last 30 days' : 'Waiting for a mailbox'}</b><span className="mono">{prov ? '1,284 emails' : '0 emails'}</span></div>
      <div className="fl-bar"><i style={{ width: prov ? '100%' : '0%' }} /></div>
      <div className="fl-stats"><div><b>{prov ? 214 : '–'}</b><span>replies to outreach</span></div><div><b>{prov ? 18 : '–'}</b><span>need a decision</span></div><div><b>{prov ? 31 : '–'}</b><span>contacts found</span></div></div>
      {prov ? FIRST.map(([a, who, q, t, c]) => (
        <div key={a} className="fl-row"><span className="av">{a}</span><div><b>{who}</b><div className="q">{q}</div></div><span className="rt-s"><i className="dot" style={{ background: 'var(--rt-' + FIRST_VAR[t] + ')' }} />{t}</span><span className="mono">{c}</span></div>
      )) : <p className="fl-empty">Your replies show up here once you connect.</p>}
    </div>
  )
}
