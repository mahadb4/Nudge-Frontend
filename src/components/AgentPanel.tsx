import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icons'
import { Toggle } from './ui'
import { getState, toast, useStore } from '../store'
import { money } from '../data/seed'

interface Msg { me?: boolean; text: string; links?: { l: string; to: string }[]; actions?: { t: string; done: boolean }[]; list?: string[] }

function reply(q: string, agent: boolean): Msg {
  const s = getState()
  const n = q.toLowerCase()
  const open = s.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
  const usd = open.filter((d) => d.currency === 'USD')
  if (/pipeline|deal|forecast|revenue/.test(n))
    return { text: `You have ${usd.length} open deals worth ${money(usd.reduce((a, d) => a + d.amount, 0))}, plus ${open.length - usd.length} in PKR (${money(open.filter((d) => d.currency === 'PKR').reduce((a, d) => a + d.amount, 0), 'PKR')}). I do not add the two currencies together. Proposal is the biggest stage.`, links: [{ l: 'Open pipeline', to: '/app/pipeline' }] }
  if (/review|waiting|reply|replies|approve/.test(n)) {
    const p = s.reviews.filter((r) => r.status === 'pending')
    return { text: p.length ? `${p.length} replies are waiting for you. The lowest confidence is ${Math.min(...p.map((r) => r.confidence))}, below your bar of ${s.settings.threshold}.` : 'You are all caught up. Nothing is waiting for review.', list: p.map((r) => `${s.contacts.find((c) => c.id === r.contactId)!.name}, ${r.confidence}`), links: [{ l: 'Go to Review', to: '/app/review' }] }
  }
  if (/follow/.test(n)) {
    const f = s.followups.filter((x) => !x.done)
    return { text: `${f.length} follow-ups are due soon. I have drafted each one.`, list: f.map((x) => x.title + ', ' + x.due.toLowerCase()), links: [{ l: 'Open follow-ups', to: '/app/follow-ups' }] }
  }
  if (/meeting|calendar|schedule|today|week/.test(n))
    return { text: `You have ${s.events.length} items coming up. The next is ${s.events[0].title} at ${s.events[0].time}.`, list: s.events.map((e) => `${e.date}, ${e.time}: ${e.title}`), links: [{ l: 'Open calendar', to: '/app/calendar' }] }
  if (/sara|northwind/.test(n))
    return { text: 'Sara Ali asked for Thursday at 3 PM and wants to bring Lena Fox. My draft confirms the time. It is in Review, confidence 94.', links: [{ l: 'Review Sara\'s reply', to: '/app/review' }] }
  if (agent && /(draft|write|send|follow up|chase)/.test(n))
    return { text: 'Here is what I would do. Nothing is sent until you approve it in Review.', actions: [{ t: 'Draft a reply for each stalled proposal', done: true }, { t: 'Put the drafts in Follow-ups', done: true }, { t: 'Send them', done: false }] }
  return { text: 'I can answer from your mailboxes, deals and calendar. Try asking what is waiting, how the pipeline looks, or who needs a follow-up.' }
}

export function AgentPanel({ onClose, page }: { onClose?: () => void; page?: boolean }) {
  const nav = useNavigate()
  const mode = useStore((s) => s.settings.mode)
  const [agent, setAgent] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([{ text: 'Hi Mahad. Ask me about your replies, deals or week. I only read your approved facts and I never send on my own.' }])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs, busy])
  const ask = (text: string) => {
    if (!text.trim() || busy) return
    text = text.trim().slice(0, 500)
    setMsgs((m) => [...m, { me: true, text }]); setQ(''); setBusy(true)
    setTimeout(() => { setMsgs((m) => [...m, reply(text, agent)]); setBusy(false) }, 600)
  }
  const sug = ['What is waiting for me?', 'How does the pipeline look?', 'Who needs a follow-up?', 'What is on my calendar?']
  return (
    <>
      <div className="dr-head">
        <span className="logo"><Icon n="sparkle" s={17} style={{ color: '#fff' }} /></span>
        <div className="grow"><b>Ask Nudge</b><span className="s">Reads your mail and CRM. Drafts only.</span></div>
        {onClose && <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon n="x" s={17} /></button>}
      </div>
      <div className="dr-msgs">
        <div className="dr-time">Today</div>
        {msgs.map((m, i) => m.me ? <div key={i} className="bub me">{m.text}</div> : (
          <div key={i} className="bub ai">
            <span className="logo"><Icon n="sparkle" s={14} style={{ color: '#fff' }} /></span>
            <div className="c">
              <div>{m.text}</div>
              {m.list && m.list.length > 0 && <ol>{m.list.map((l) => <li key={l}>{l}</li>)}</ol>}
              {m.actions && (
                <div className="act-card">
                  {m.actions.map((a) => (
                    <div className="ar" key={a.t}>
                      <span className={'ck' + (a.done ? '' : ' todo')}>{a.done && <Icon n="check" s={12} w={3} />}</span>
                      <span className="t">{a.t}</span>
                      {!a.done && <button className="go btn" onClick={() => toast('Sending needs your approval in Review')}>Needs your OK</button>}
                    </div>
                  ))}
                </div>
              )}
              {m.links && <div className="chips">{m.links.map((l) => <button key={l.to} onClick={() => { onClose?.(); nav(l.to) }}>{l.l}<Icon n="arrowR" s={12} /></button>)}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="bub ai"><span className="logo"><Icon n="sparkle" s={14} style={{ color: '#fff' }} /></span><div className="c muted">Thinking…</div></div>}
        <div ref={end} />
      </div>
      <div className="dr-suggest">{sug.map((x) => <button key={x} onClick={() => ask(x)}>{x}</button>)}</div>
      <div className="dr-input">
        <div className="dr-box">
          <textarea className="textarea" rows={1} maxLength={500} placeholder="Ask anything about your replies or deals" value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(q) } }} />
          <button className="send" aria-label="Send" onClick={() => ask(q)}><Icon n="send" s={16} /></button>
        </div>
        <div className="dr-mode">
          <Toggle on={agent} onChange={setAgent} label="Agent mode" />
          <div><b>Agent mode</b> lets Nudge plan steps. {mode === 'draft' ? 'You are in Draft-only, so every send waits for your approval.' : 'Sends stay within your confidence bar.'}</div>
        </div>
      </div>
      {page && null}
    </>
  )
}
