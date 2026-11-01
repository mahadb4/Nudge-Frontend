import { Link } from 'react-router-dom'
import { Brand, Icon } from '../components/Icons'
import { api } from '../api'
import { hydrateWorkspace } from '../store'
import { Conf, RT_VAR, ST_VAR, useTitle } from '../components/ui'
import { REPLY_TYPES, STAGES } from '../data/seed'

export function Landing() {
  useTitle('Every sales reply, handled')
  return (
    <div className="land">
      <nav className="land-nav">
        <Brand />
        <div className="links"><a href="#how">How it works</a><a href="#trust">Why teams trust it</a></div>
        <div className="right"><Link to="/sign-in">Sign in</Link><Link className="btn primary" to="/sign-up">Start free</Link></div>
      </nav>
      <section className="land-hero">
        <div>
          <div className="eyebrow-l"><i />For B2B sales teams with more replies than time</div>
          <h1>Every sales reply, handled. Nothing sent without you.</h1>
          <p className="lead">Nudge reads the replies to your outreach, works out what each one means, and prepares the next step: the draft, the follow-up, the deal update. You approve it in one click.</p>
          <div className="cta"><Link className="btn primary lg" to="/sign-up">Start free</Link><Link className="btn lg" to="/app/home" onClick={() => { const u = api.auth.startDemo(); if (u) hydrateWorkspace(u) }}>See the demo workspace</Link></div>
          <div className="small">Works with Gmail, Outlook and any IMAP mailbox.</div>
        </div>
        <div className="hero-card">
          <div className="mail">
            <div className="top"><span className="avatar sm t-pink">SA</span><b>Sara Ali</b><span className="muted">CTO · Northwind</span><span className="tm">10:42 AM</span></div>
            <p style={{ lineHeight: 1.7, margin: 0 }}>Thanks, this looks like a strong fit for how our team works. <mark className="ev">Could we do next Tuesday afternoon?</mark><sup className="ref">[1]</sup> I would like to bring our Head of Sales as well.</p>
          </div>
          <div className="acts">
            <div className="row spread" style={{ marginBottom: 12 }}><span className="row" style={{ gap: 10 }}><span className="rt"><i style={{ background: 'var(--rt-meeting)' }} />Meeting request</span><Conf v={94} /></span><span className="mono muted" style={{ fontSize: 12 }}>Based on [1]</span></div>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>When you approve, Nudge will</div>
            <ul className="will">
              <li><i style={{ background: 'var(--st-meeting, #4cae6a)' }} />Move Northwind Expansion to Meeting scheduled</li>
              <li><i style={{ background: 'var(--rt-meeting)' }} />Offer Tue 27 Oct at 2:00 or 3:30 PM</li>
              <li><i style={{ background: 'var(--approve)' }} />Send Sara the reply you checked</li>
            </ul>
            <div className="row" style={{ marginTop: 14 }}><Link className="btn approve" to="/app/review">Approve<span className="kbd">A</span></Link><button className="btn">Edit reply</button></div>
          </div>
        </div>
      </section>
      <section className="land-sec" id="how">
        <h2>How it works</h2><p className="lead">The same four steps for every reply, so you always know what happened and why.</p>
        <div className="how">{[['Reads the reply', 'From every connected mailbox, the moment it lands.'], ['Shows its evidence', 'The exact sentence behind its decision, highlighted.'], ['You approve', 'Edit the draft, untick an action, or reject it.'], ['The deal moves', 'Stage, follow-up and contacts update, with undo.']].map(([t, d], i) => (
          <div key={t} style={{ ['--c' as string]: ST_VAR[(['new', 'contacted', 'meeting', 'proposal'] as const)[i]] }}><div className="n">0{i + 1}</div><b>{t}</b><p>{d}</p></div>))}</div>
      </section>
      <section className="trust" id="trust">
        {[['lock', 'Draft-only until you say so', 'Nudge starts by asking before every change. It earns more freedom one reply type at a time, only after 50 approved reviews.'], ['check', 'Only facts you approved', 'Drafts quote prices and claims from your approved list. Anything else is left out, never made up.'], ['template', 'A record of everything', 'Every action by a person or by Nudge goes into an audit log nobody can edit.']].map(([i, t, d]) => (
          <div key={t}><Icon n={i} s={22} /><b>{t}</b><p>{d}</p></div>))}
      </section>
      <section className="land-cta"><h2>Know why, before you approve.</h2><div><p>Connect a mailbox and Nudge starts in draft-only mode. Nothing in your current process changes until your team approves it.</p><Link className="btn" to="/sign-up">Create your workspace</Link></div></section>
      <footer className="land-foot"><span>Nudge, a final year project at SZABIST Karachi</span><Link to="/foundations" className="underline">Privacy and terms</Link></footer>
    </div>
  )
}

const LIGHT: [string, string, string][] = [['Ground', '#FAFAFA', '#fafafa'], ['Surface', '#FFFFFF', '#ffffff'], ['Line', '#D9D9D9', '#d9d9d9'], ['Ink · primary', '#171717', '#171717'], ['Approve', '#1A7F37', '#1a7f37'], ['Evidence', '#FFE27A', '#ffe27a'], ['Needs you', '#8F5200', '#8f5200'], ['Info · focus', '#1F55C6', '#1f55c6'], ['Destructive', '#B42318', '#b42318']]
const DARK: [string, string][] = [['Ground', '#0A0A0A'], ['Surface', '#141414'], ['Line', '#363636'], ['Ink · primary', '#EDEDED'], ['Approve', '#3ECF8E'], ['Evidence', '#F2D25C'], ['Needs you', '#E9B451'], ['Info · focus', '#8DB0FF'], ['Destructive', '#F27561']]
const TYPES: [string, number, number, string, string][] = [
  ['Display 52', 52, 600, 'Nothing sent without you.', '-0.045em'],
  ['Title 30', 30, 600, '5 replies are waiting on you.', '-0.035em'],
  ['Section 14.5', 14.5, 600, 'Waiting for review', '-0.01em'],
  ['Reading 15.5', 15.5, 400, 'Thanks, this looks like a strong fit for how our team works.', '0'],
  ['UI 13.5', 13.5, 500, 'Move Northwind Expansion to Meeting scheduled', '0'],
]
const PEOPLE: [string, string][] = [['SA', 't-pink'], ['NW', 't-lav'], ['MP', 't-mint'], ['RM', 't-peach'], ['UT', 't-teal'], ['MB', 't-grey']]
const STATUS: [string, string][] = [['Active', 'var(--approve)'], ['Opted out', 'var(--destructive)'], ['Sync failed', 'var(--needs)'], ['Suspended', 'var(--ink-4)']]

export function Foundations() {
  useTitle('Foundations')
  return (
    <div className="found">
      <div className="fd-top"><Link to="/"><Brand /></Link></div>
      <h1>Foundations</h1>
      <p className="lead">A quiet working tool in true neutral greys. Black is the default action. Colour is spent only where it carries meaning: green to approve, yellow for evidence, amber when Nudge needs you, and a soft tint per person so faces are easy to find.</p>
      <div className="fd-ver mono">v0.3 · Geist · Geist Mono · neutral greys</div>

      <div className="fd-row fd-two">
        <div className="f-card"><div className="hd"><b>Type</b><span>display for titles · Geist for work · mono for data</span></div>
          {TYPES.map(([k, s, w, t, ls]) => <div className="t-row" key={k}><span className="k">{k}</span><span style={{ fontSize: s, fontWeight: w, letterSpacing: ls, lineHeight: 1.15 }}>{t}</span></div>)}
          <div className="t-row"><span className="k">Meta 12.5</span><span className="muted" style={{ fontSize: 12.5 }}>CTO · Northwind · replied 10:42 AM</span></div>
          <div className="t-row"><span className="k">Mono 13</span><span className="mono" style={{ fontSize: 13 }}>$96,000 · PKR 4,200,000 · 94 · Tue 27 Oct</span></div>
        </div>
        <div className="f-card"><div className="hd"><b>Colour roles</b><span>light · dark</span></div>
          <div className="fd-colors">
            <div>{LIGHT.map(([n, h, v]) => <div className="sw" key={n}><i style={{ background: v, border: '1px solid var(--hair)' }} />{n}<span className="hex">{h}</span></div>)}</div>
            <div className="dk">{DARK.map(([n, h]) => <div className="sw" key={n}><i style={{ background: h }} />{n}<span className="hex">{h}</span></div>)}</div>
          </div>
        </div>
      </div>

      <div className="fd-row fd-three">
        <div className="f-card"><div className="hd"><b>Reply types</b><span>a mark, never a pill</span></div>
          <div className="fd-types">{REPLY_TYPES.map((r) => <div key={r.id} className="rt"><i style={{ background: RT_VAR[r.id] }} />{r.label}</div>)}</div></div>
        <div className="f-card"><div className="hd"><b>Deal stages</b><span>one green, getting deeper</span></div>
          <div className="fd-stagebar">{STAGES.slice(0, 5).map((s) => <i key={s.id} style={{ background: ST_VAR[s.id] }} />)}</div>
          <div className="fd-types">{STAGES.map((s) => <div key={s.id} className="rt"><i style={{ background: ST_VAR[s.id] }} />{s.label}</div>)}</div></div>
        <div className="f-card"><div className="hd"><b>People</b><span>six soft tints</span></div>
          <div className="row wrap" style={{ gap: 8 }}>{PEOPLE.map(([n, t]) => <span key={n} className={'avatar ' + t}>{n}</span>)}</div>
          <div className="row wrap" style={{ gap: 14, margin: '16px 0 12px' }}>{STATUS.map(([n, c]) => <span key={n} className="rt"><i className="dot round" style={{ background: c }} />{n}</span>)}</div>
          <div className="row wrap" style={{ gap: 8 }}><span className="tag green">Uses approved facts</span><span className="tag amber">Below your bar</span><span className="tag outline">Draft</span></div></div>
      </div>

      <div className="f-card fd-bottom">
        <div><div className="hd"><b>Actions</b></div>
          <div className="row wrap" style={{ gap: 10 }}><button className="btn approve">Approve<span className="kbd">A</span></button><button className="btn primary">Continue</button><button className="btn">Skip<span className="kbd">S</span></button></div>
          <div className="row" style={{ gap: 10, marginTop: 10 }}><button className="btn danger">Reject<span className="kbd">R</span></button><button className="link plain">Edit reply</button></div>
          <div className="fd-toast"><Icon n="check" s={14} w={2.4} />Moved to Meeting scheduled<b>Undo</b></div></div>
        <div><div className="hd"><b>Evidence and confidence</b></div>
          <p style={{ lineHeight: 1.7, margin: 0 }}>The team liked it. <mark className="ev">Could we revisit this at the start of April?</mark><sup className="ref">[1]</sup></p>
          <div className="row" style={{ gap: 10, marginTop: 16 }}><Conf v={94} /><span className="muted">above your 85 bar</span></div>
          <div className="row" style={{ gap: 10, marginTop: 8 }}><Conf v={71} /><span style={{ color: 'var(--needs)' }}>below, asking you</span></div></div>
        <div><div className="hd"><b>Fields</b></div>
          <label className="lbl-s">Work email</label><input className="input" defaultValue="mahad@acme.com" />
          <label className="lbl-s" style={{ marginTop: 14 }}>Amount</label><input className="input invalid" defaultValue="25k" /><span className="err">Numbers only, like 25000.</span></div>
      </div>
    </div>
  )
}
