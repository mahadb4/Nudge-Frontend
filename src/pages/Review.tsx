import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { Avatar, Conf, Evidence, Kbd, ReplyMark, companyName, contactById, useTitle } from '../components/ui'
import { approveReview, rejectReview, resetReviews, setReviewDraft, setReviewType, skipReview, toggleAction, useStore } from '../store'
import { REPLY_TYPES, rtLabel } from '../data/seed'

const REASONS = ['Wrong tone', 'Wrong facts', 'Wrong reply type', 'Too long', 'Should not reply', 'Other']

export function Review() {
  useTitle('Review')
  const reviews = useStore((s) => s.reviews)
  const threshold = useStore((s) => s.settings.threshold)
  const deals = useStore((s) => s.deals)
  const approvedToday = useStore((s) => s.approvedToday)
  const [sel, setSel] = useState<string>(reviews.find((r) => r.status === 'pending')?.id ?? reviews[0].id)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState(false)

  const pending = reviews.filter((r) => r.status === 'pending')
  const cur = reviews.find((r) => r.id === sel)
  const idx = pending.findIndex((r) => r.id === sel)

  const advance = (fromId: string) => {
    const list = reviews.filter((r) => r.status === 'pending' && r.id !== fromId)
    const after = list.find((r) => reviews.indexOf(r) > reviews.findIndex((x) => x.id === fromId)) ?? list[0]
    if (after) setSel(after.id)
    setRejecting(false); setReason(''); setNote(''); setErr(false)
  }
  const approve = () => { if (!cur || cur.status !== 'pending') return; approveReview(cur.id); advance(cur.id) }
  const skip = () => { if (!cur || cur.status !== 'pending') return; skipReview(cur.id); advance(cur.id) }
  const confirmReject = () => {
    if (!cur) return
    if (!reason) { setErr(true); return }
    rejectReview(cur.id, reason + (note ? ': ' + note : '')); advance(cur.id)
  }
  const move = (d: number) => {
    if (!pending.length) return
    const i = Math.max(0, Math.min(pending.length - 1, (idx < 0 ? 0 : idx) + d))
    setSel(pending[i].id); setRejecting(false)
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.matches('input, textarea, select') || e.ctrlKey || e.metaKey) return
      const k = e.key.toLowerCase()
      if (k === 'j') move(1)
      else if (k === 'k') move(-1)
      else if (k === 'a') approve()
      else if (k === 'r') { if (cur?.status === 'pending') setRejecting(true) }
      else if (k === 's') skip()
      else if (k === 'escape') setRejecting(false)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const deal = useMemo(() => deals.find((d) => d.id === cur?.dealId), [deals, cur])

  if (pending.length === 0) {
    return (
      <div className="page narrow">
        <div className="caught">
          <div className="ok"><Icon n="check" s={24} w={2.4} /></div>
          <h2>All caught up</h2>
          <p>Nothing is waiting for you. Nudge will tell you when the next reply comes in. Quiet hours run 8 PM to 8 AM, Asia/Karachi.</p>
          <div className="row" style={{ marginTop: 26 }}>
            <Link className="btn primary" to="/app/home">Back to Home</Link>
            <button className="btn" onClick={resetReviews}>Reset demo data</button>
          </div>
          {approvedToday.length > 0 && (
            <div style={{ marginTop: 40 }}>
              <div className="sect"><h3>Approved this session</h3></div>
              {approvedToday.map((a, i) => <div className="log-row" key={i}><Icon n="check" s={16} style={{ color: 'var(--approve)' }} />{a.name}<ReplyMark t={a.type} /><span className="mono">{a.at}</span></div>)}
            </div>
          )}
        </div>
      </div>
    )
  }
  if (!cur) return null
  const c = contactById(cur.contactId)!
  const isPending = cur.status === 'pending'
  const low = cur.confidence < threshold
  const words = cur.draft.trim().split(/\s+/).filter(Boolean).length

  return (
    <>
      <div className="rv-head">
        <div className="grow">
          <div className="row"><h1>Review</h1><span className="pos">{idx >= 0 ? idx + 1 : '–'} of {pending.length}</span></div>
          <div className="desc">Nothing sends until you approve it.</div>
        </div>
        <div className="row"><Kbd>J</Kbd><Kbd>K</Kbd><span className="muted" style={{ fontSize: 12.5 }}>to move</span></div>
      </div>

      <div className="rv-body">
        <div className="rv-list">
          {reviews.map((r) => {
            const k = contactById(r.contactId)!
            return (
              <button key={r.id} className={'rv-item' + (r.id === sel ? ' on' : '') + (r.status !== 'pending' ? ' done' : '')} onClick={() => { setSel(r.id); setRejecting(false) }}>
                <div className="r1"><Avatar name={k.name} tint={k.tint} size="sm" /><b>{k.name}</b><span className="t">{r.time}</span></div>
                <div className="r2">{r.paragraphs[r.evidence]}</div>
                <div className="r3"><ReplyMark t={r.type} /><span className={'s' + (r.confidence < threshold ? ' low' : '')}>{r.status === 'pending' ? r.confidence : r.status}</span></div>
              </button>
            )
          })}
        </div>

        <div className="rv-mail">
          <div className="mail-head">
            <Avatar name={c.name} tint={c.tint} size="lg" />
            <div className="grow">
              <div className="who">{c.name} <span>{companyName(c.companyId)}</span></div>
              <div className="addr">{c.email}</div>
            </div>
            <div className="when">{cur.received}</div>
          </div>
          {deal && <Link to={'/app/pipeline/' + deal.id} className="deal-chip"><Icon n="pipeline" s={15} />{deal.name}<span className="mono">{deal.currency === 'USD' ? '$' + deal.amount.toLocaleString() : 'PKR ' + deal.amount.toLocaleString()}</span></Link>}
          <div className="mail-subject">{cur.subject}</div>
          <Evidence paragraphs={cur.paragraphs} evidence={cur.evidence} />
          <div className="mail-foot">[1] The sentence Nudge used to choose “{rtLabel(cur.type)}”.</div>
        </div>

        <div className="rv-side">
          <div className="sug-h"><Icon n="sparkle" s={15} />Nudge suggests</div>
          <div className="sug-type">
            <select className="select" value={cur.type} disabled={!isPending} onChange={(e) => setReviewType(cur.id, e.target.value as typeof cur.type)} aria-label="Reply type">
              {REPLY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <Conf v={cur.confidence} wide />
          </div>
          <div className={'sug-cap' + (low ? ' low' : ' muted')}>{low ? `Below your bar of ${threshold}. This one needs you.` : `Above your bar of ${threshold}.`}</div>
          <p className="sug-why">{cur.why} <span className="mono">[1]</span></p>

          <div className="facts">{cur.facts.map(([k, v]) => <div className="f" key={k}><span>{k}</span><span>{v}</span></div>)}</div>

          <div className="act-h">When you approve, Nudge also will</div>
          {cur.actions.map((a) => (
            <label className={'act' + (a.on ? '' : ' off')} key={a.id}>
              <input type="checkbox" className="check" checked={a.on} disabled={!isPending} onChange={() => toggleAction(cur.id, a.id)} />
              <span>{a.label}</span>
            </label>
          ))}

          <div className="reply-h"><span>Draft reply</span>{cur.usedFacts.length > 0 && <span className="facts-tag"><Icon n="check" s={13} w={2.4} />Used {cur.usedFacts.join(', ')}</span>}</div>
          <textarea className="textarea" rows={9} value={cur.draft} disabled={!isPending} onChange={(e) => setReviewDraft(cur.id, e.target.value)} aria-label="Draft reply" />
          <div className="count-hint">{words} words · From mahad@acme.co</div>
        </div>
      </div>

      {rejecting && (
        <div className="reject-band">
          <div><h4>Reject this draft</h4><p>Nothing is sent. Tell Nudge what was wrong so the next draft is better. You can approve a different draft from Inbox later.</p></div>
          <div className="col gap-12">
            <div className="field">
              <select className={'select' + (err && !reason ? ' invalid' : '')} value={reason} onChange={(e) => { setReason(e.target.value); setErr(false) }} aria-label="Reason">
                <option value="">Choose a reason</option>{REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              {err && !reason && <span className="err">Pick a reason first</span>}
            </div>
            <input className="input" placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setRejecting(false)}>Cancel</button>
              <button className="btn danger solid" onClick={confirmReject}>Reject draft</button>
            </div>
          </div>
        </div>
      )}

      <div className="rv-foot">
        <button className="btn approve lg" disabled={!isPending} onClick={approve}><Icon n="check" s={17} w={2.4} />Approve &amp; queue <Kbd>A</Kbd></button>
        <button className="btn lg danger" disabled={!isPending} onClick={() => setRejecting(true)}>Reject <Kbd>R</Kbd></button>
        <button className="btn lg" disabled={!isPending} onClick={skip}>Skip <Kbd>S</Kbd></button>
        <span className="muted grow" style={{ textAlign: 'right', fontSize: 12.5 }}>Draft-only mode. You can undo an approval for 7 days.</span>
      </div>
    </>
  )
}
