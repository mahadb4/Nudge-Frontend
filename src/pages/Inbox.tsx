import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { Avatar, Conf, ReplyMark, Segmented, companyName, contactById, useTitle } from '../components/ui'
import { setState, useStore } from '../store'

export function Inbox() {
  useTitle('Inbox')
  const nav = useNavigate()
  const me = useStore((s) => s.user?.name ?? '')
  const threads = useStore((s) => s.threads)
  const mailboxes = useStore((s) => s.mailboxes)
  const [tab, setTab] = useState<'all' | 'waiting' | 'done'>('all')
  const [mb, setMb] = useState('all')
  const [sel, setSel] = useState<string | null>(threads[0]?.id ?? null)
  const [open, setOpen] = useState(false)

  const list = threads.filter((t) => (tab === 'all' || t.status === tab) && (mb === 'all' || t.mailbox === mb))
  const cur = threads.find((t) => t.id === sel) ?? list[0]
  const cnt = (k: string) => threads.filter((t) => (k === 'all' ? true : t.status === k)).length
  const statusEl = (s: string) => s === 'waiting' ? <span className="st-wait">Waiting for you</span> : s === 'done' ? <span className="st-done">Replied</span> : <span className="st-none">No reply needed</span>

  return (
    <div className={'ib' + (open ? ' open' : '')}>
      <div className="ib-list">
        <div className="ib-head">
          <div className="row spread"><h1>Inbox</h1>
            <select className="select" value={mb} onChange={(e) => setMb(e.target.value)} aria-label="Mailbox">
              <option value="all">All mailboxes</option>{mailboxes.filter((m) => m.status === 'ok').map((m) => <option key={m.id}>{m.email}</option>)}
            </select>
          </div>
          <Segmented label="Thread status" value={tab} onChange={setTab}
            options={(['all', 'waiting', 'done'] as const).map((k) => ({ value: k, label: k === 'all' ? 'All' : k === 'waiting' ? 'Waiting' : 'Replied', count: cnt(k) }))} />
        </div>
        {list.length === 0 && <div className="empty">Nothing here.</div>}
        {list.map((t) => {
          const c = contactById(t.contactId)!
          return (
            <button key={t.id} className={'ib-row' + (cur?.id === t.id ? ' on' : '')} onClick={() => { setSel(t.id); setOpen(true) }}>
              <div className="r1"><Avatar name={c.name} tint={c.tint} size="xs" /><b>{c.name}</b><span className="co">{companyName(c.companyId)}</span><span className="t">{t.time}</span></div>
              <div className="subj">{t.subject}</div>
              <p className="prev">{t.preview}</p>
              <div className="r3"><ReplyMark t={t.replyType} />{statusEl(t.status)}</div>
            </button>
          )
        })}
      </div>

      <div className="ib-view">
        {cur ? (() => {
          const c = contactById(cur.contactId)!
          return (
            <>
              <div className="ib-view-head">
                <div>
                  <button className="btn ghost sm only-mobile" onClick={() => setOpen(false)} style={{ marginBottom: 8 }}><Icon n="arrowL" s={15} />Back</button>
                  <h2>{cur.subject}</h2>
                  <div className="meta"><Link className="link" to={'/app/contacts/' + c.id}>{c.name}</Link> · {companyName(c.companyId)} · <span className="mono">{c.email}</span> · via <span className="mono">{cur.mailbox}</span></div>
                </div>
                <button className="btn" onClick={() => setState(() => ({ newEmailOpen: true }))}><Icon n="edit" s={15} />New email</button>
              </div>
              <div className="ib-body">
                <div className="summary">
                  <div className="top"><span>Nudge summary</span>{cur.status === 'waiting' && <span className="st-wait"><i className="dot round" style={{ background: 'var(--needs)' }} />Waiting for you</span>}</div>
                  <div className="big">{cur.preview}</div>
                  <div className="tags"><span className="tag outline"><ReplyMark t={cur.replyType} /></span><span className="tag grey"><Conf v={cur.confidence} /></span>
                    {cur.dealId && <Link to={'/app/pipeline/' + cur.dealId} className="tag outline">Open deal</Link>}</div>
                  {cur.status === 'waiting' && <div className="bot"><span>A draft reply is ready.</span><button className="btn primary sm" onClick={() => nav('/app/review')}>Review draft</button></div>}
                </div>
                {cur.messages.map((m, i) => (
                  <div className="msg" key={i}>
                    <div className="msg-h">{m.from === 'them' ? <Avatar name={m.name} tint={c.tint} size="sm" /> : <Avatar name={me} tint="t-blue" size="sm" />}<b>{m.name}</b><span className="mono">{m.time}</span></div>
                    <div className="msg-t">{m.text.split('\n\n').map((t, j) => <p key={j}>{t}</p>)}</div>
                  </div>
                ))}
              </div>
            </>
          )
        })() : <div className="empty">Select a conversation</div>}
      </div>
    </div>
  )
}
