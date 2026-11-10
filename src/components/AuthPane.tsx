import { useLayoutEffect, useRef, type RefObject } from 'react'
import { GoogleG, Icon, MsLogo } from './Icons'

export type Pane = 'reply' | 'start' | 'security'

const PANES: Record<Pane, { kicker: string; a: string; b: string }> = {
  reply: { kicker: 'Replies, sorted', a: 'Every reply read, sorted and drafted.', b: 'You just approve.' },
  start: { kicker: 'Draft-only by default', a: 'Live in five minutes.', b: 'Nothing sends without you.' },
  security: { kicker: 'Your account, protected', a: 'Reset links work once.', b: 'Every sign-in is logged.' },
}

function ReplyCard() {
  return (
    <div className="float-card big">
      <div className="fc-person">
        <span className="av t-pink">SA</span>
        <div><b>Sara Ali</b> <span className="mono mut">sara@northwind.io</span><div className="sub">CTO · Northwind</div></div>
        <span className="mono mut when">10:42 AM</span>
      </div>
      <div className="fc-body">
        <div className="fc-subj">Re: Rollout plan for Q1</div>
        <p>Thanks, the pilot numbers look solid. <mark className="ev">Could we do next Tuesday afternoon? I would like to bring our Head of Sales as well.</mark><sup className="ref">[1]</sup></p>
        <div className="chips">
          <span className="chip on"><i className="dot" style={{ background: 'var(--rt-meeting)' }} />Meeting request · 94</span>
          <span className="chip">Pricing request</span><span className="chip">Defer</span><span className="chip">Not interested</span>
        </div>
      </div>
      <div className="fc-draft">
        <p>Tuesday works. I’ve sent an invite for 3:00 PM your time, and your Head of Sales is very welcome to join.</p>
        <div className="fc-actions"><span className="fc-btn go">Approve and send</span><span className="fc-btn">Edit</span><span className="mono mut">Based on [1]</span></div>
      </div>
    </div>
  )
}

function StartCard({ done }: { done: number }) {
  const rows: [string, string][] = [
    ['Confirm your email', 'A 6-digit code, valid 10 minutes'],
    ['Connect a mailbox', 'Gmail or Microsoft 365, read-only first look'],
    ['Pick how Nudge works', 'Draft-only, or auto-send above your bar'],
    ['Review your first replies', 'Usually ready in under 2 minutes'],
  ]
  return (
    <div className="float-card big">
      <div className="fc-h"><span>Your first five minutes</span><span className="mono mut">{done} of 4 done</span></div>
      <div className="fc-prog"><i style={{ width: done * 25 + '%' }} /></div>
      <div className="fc-list">
        {rows.map(([t, d], i) => (
          <div key={t} className={'fc-step' + (i < done ? ' done' : i === done ? ' cur' : '')}>
            <span className="num">{i < done ? '✓' : i + 1}</span><b>{t}</b><span className="mono mut">{d}</span>
          </div>
        ))}
      </div>
      <div className="fc-note">You start in draft-only mode. You can switch on auto-send later, per reply type.</div>
    </div>
  )
}

function SecurityCard() {
  const rows: [string, string, string][] = [
    ['Signed in', 'Chrome on macOS · Karachi', '2 min ago'],
    ['Password changed', 'Safari on iPhone · Dubai', 'Yesterday'],
    ['New device approved', 'Edge on Windows · London', '3 days ago'],
  ]
  return (
    <div className="float-card big">
      <div className="fc-h"><span>Security activity</span><span className="tag green">All good</span></div>
      <div className="fc-list">
        {rows.map(([t, d, w]) => (
          <div key={t} className="fc-sec"><i className="dot round" style={{ background: 'var(--approve)' }} /><div><b>{t}</b><div className="sub">{d}</div></div><span className="mono mut">{w}</span></div>
        ))}
      </div>
      <div className="fc-note plain">Reset links work once and expire in an hour. Every sign-in lands in your workspace audit log.</div>
    </div>
  )
}

/** The panel is exactly one screen tall and never scrolls. If its content is taller, add fit levels until it
    fits: 1 hides the stats row, 2 tightens spacing, 3 scales the cards, 4 drops the floating cards too.
    The main card always stays whole. The levels live in app.css under [data-fit]. */
function useFit(ref: RefObject<HTMLDivElement | null>, deps: readonly unknown[]) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const run = () => {
      for (let level = 0; level <= 4; level++) {
        el.dataset.fit = String(level)
        if (el.scrollHeight <= el.clientHeight + 1) return
      }
    }
    run()
    const ro = new ResizeObserver(run)
    ro.observe(el)
    void document.fonts?.ready.then(run)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export function RightPane({ pane = 'reply', done = 1 }: { pane?: Pane; done?: number }) {
  const t = PANES[pane]
  const ref = useRef<HTMLDivElement>(null)
  useFit(ref, [pane, done])
  return (
    <div className="auth-right" ref={ref}>
      <div className="pane-pad">
        <div className="kicker">{t.kicker}</div>
        <h2 className="hero-h">{t.a} <span>{t.b}</span></h2>
        <div className="pane-stage">
          {pane === 'reply' ? <ReplyCard /> : pane === 'start' ? <StartCard done={done} /> : <SecurityCard />}
          <div className="mini-stat">
            <div className="eyebrow">THIS WEEK</div>
            <div className="v">68% <span className="delta">+6 pts</span></div>
            <div className="sub">of replies handled by Nudge</div>
            <svg viewBox="0 0 200 40" width="100%" height="40" aria-hidden="true">
              <path d="M0 34 L20 31 L40 33 L60 27 L80 29 L100 22 L120 24 L140 17 L160 19 L180 11 L200 8 L200 40 L0 40Z" fill="rgba(26,127,55,.14)" />
              <path d="M0 34 L20 31 L40 33 L60 27 L80 29 L100 22 L120 24 L140 17 L160 19 L180 11 L200 8" fill="none" stroke="#1a7f37" strokeWidth="1.6" />
            </svg>
          </div>
          <div className="works-with">
            <div className="eyebrow">WORKS WITH</div>
            <div className="logos">
              <span className="logo-chip"><GoogleG s={16} /></span><span className="logo-chip"><MsLogo s={16} /></span>
              <span className="logo-chip"><Icon n="calendar" s={16} /></span><span className="logo-chip"><Icon n="sparkle" s={16} /></span><span className="logo-chip"><Icon n="building" s={16} /></span>
            </div>
          </div>
        </div>
      </div>
      <div className="stats3">
        <div><b>9</b><span>reply types, from meeting requests to out-of-office</span></div>
        <div><b>[1]</b><span>Every suggestion shows the sentence it came from</span></div>
        <div><b>0</b><span>emails sent without you in draft-only mode</span></div>
      </div>
    </div>
  )
}
