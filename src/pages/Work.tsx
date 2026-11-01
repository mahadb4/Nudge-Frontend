import { useState } from 'react'
import { Icon } from '../components/Icons'
import { Avatar, contactById, useTitle } from '../components/ui'
import { AgentPanel } from '../components/AgentPanel'
import { sendFollowup, toast, useStore } from '../store'

export function FollowUps() {
  useTitle('Follow-ups')
  const fus = useStore((s) => s.followups)
  const [open, setOpen] = useState<string | null>(fus.find((f) => !f.done)?.id ?? null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const left = fus.filter((f) => !f.done).length
  return (
    <div className="page mid">
      <div className="page-head"><div><h1 className="h1">Follow-ups</h1><p className="page-sub">{left ? `${left} people have gone quiet. I drafted a nudge for each.` : 'Nobody is waiting on a nudge.'}</p></div></div>
      {fus.map((f) => {
        const c = contactById(f.contactId)!
        const isOpen = open === f.id && !f.done
        return (
          <div className="fu-card" key={f.id} style={f.done ? { opacity: .55 } : undefined}>
            <div className="fu-top">
              <Avatar name={c.name} tint={c.tint} size="md" />
              <div className="grow"><div className="tt">{f.title}</div><div className="sub">{f.sub}</div></div>
              {f.done ? <span className="tag green"><Icon n="check" s={13} w={2.4} />Queued</span> : <>
                <span className="tm">{f.due}</span>
                <button className="btn sm" onClick={() => setOpen(isOpen ? null : f.id)}>{isOpen ? 'Close' : 'Review draft'}</button></>}
            </div>
            {isOpen && (
              <div className="fu-open">
                <div className="to">To <span className="mono">{c.email}</span></div>
                <textarea className="textarea" value={drafts[f.id] ?? f.draft} onChange={(e) => setDrafts({ ...drafts, [f.id]: e.target.value })} aria-label="Follow-up draft" />
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn approve" onClick={() => { sendFollowup(f.id, drafts[f.id] ?? f.draft); setOpen(null) }}><Icon n="check" s={16} w={2.4} />Approve &amp; queue</button>
                  <button className="btn" onClick={() => toast('Snoozed until tomorrow')}>Snooze a day</button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function CalendarPage() {
  useTitle('Calendar')
  const events = useStore((s) => s.events)
  const days = [...new Set(events.map((e) => e.day))]
  const [approved, setApproved] = useState(false)
  return (
    <div className="page mid">
      <div className="page-head"><div><h1 className="h1">Calendar</h1><p className="page-sub">Asia/Karachi · Quiet hours 8 PM to 8 AM</p></div>
        <button className="btn" onClick={() => toast('Calendar opens in Google Calendar in the live app')}><Icon n="calendar" s={15} />Open in Google</button></div>
      {days.map((d) => (
        <div className="cal-block" key={d}>
          <div className="cal-day">{d}<span>{events.find((e) => e.day === d)!.date}</span></div>
          {events.filter((e) => e.day === d).map((e) => {
            const held = e.kind === 'hold' && !approved
            return (
              <div className="cal-ev" key={e.id}>
                <div className="tm"><b>{e.time}</b><span>{e.dur}</span><i className="bar" style={{ background: held ? 'var(--needs)' : 'var(--info)' }} /></div>
                <div><div className="tt">{e.title}</div><div className="sub">{e.sub}</div></div>
                {e.kind === 'hold' && (held
                  ? <button className="btn sm" onClick={() => { setApproved(true); toast('Invite sent to Sara and Lena') }}>Confirm hold</button>
                  : <span className="tag green">Confirmed</span>)}
              </div>
            )
          })}
        </div>
      ))}
      <div className="hold" style={{ marginTop: 34 }}><Icon n="info" s={17} /><span>Nudge never books a meeting on its own. A hold stays amber until you approve the reply that confirms it.</span></div>
    </div>
  )
}

export function AgentPage() {
  useTitle('Agent')
  return (
    <div className="page narrow">
      <div className="page-head"><div><h1 className="h1">Agent</h1><p className="page-sub">Ask about your replies, deals and week. Switch on Agent mode to let Nudge plan steps for you to approve.</p></div></div>
      <div className="drawer page"><AgentPanel page /></div>
    </div>
  )
}
