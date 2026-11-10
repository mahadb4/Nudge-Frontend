import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { Avatar, Field, Modal, ST_VAR, Segmented, companyName, contactById, useTitle } from '../components/ui'
import { LIMITS, idOk, amountErr, clean, cleanMulti, dateErr, nameErr } from '../data/validate'
import { addDeal, getState, moveDeal, toast, updateDeal, useStore, logAudit } from '../store'
import { STAGES, money, stageLabel, type Currency, type Stage } from '../data/seed'

export function Pipeline() {
  useTitle('Pipeline')
  const nav = useNavigate()
  const deals = useStore((s) => s.deals)
  const members = useStore((s) => s.members)
  const [tab, setTab] = useState<'open' | 'won' | 'lost'>('open')
  const [owner, setOwner] = useState('all')
  const [cur, setCur] = useState<'USD' | 'PKR' | 'all'>('all')
  const [adding, setAdding] = useState(false)
  const [drag, setDrag] = useState<string | null>(null)
  const [over, setOver] = useState<Stage | null>(null)
  const [lostFor, setLostFor] = useState<string | null>(null)

  const filt = deals.filter((d) => (owner === 'all' || d.owner === owner) && (cur === 'all' || d.currency === cur))
  const open = filt.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
  const openUsd = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost' && d.currency === 'USD')
  const sum = (a: typeof deals, c: Currency) => a.filter((d) => d.currency === c).reduce((x, d) => x + d.amount, 0)
  const cols = STAGES.slice(0, 5)
  const dropOn = (st: Stage) => {
    if (!drag) return
    if (st === 'lost') setLostFor(drag); else moveDeal(drag, st)
    setDrag(null); setOver(null)
  }

  return (
    <div className="board-wrap">
      <div className="board-top">
        <div>
          <h1 className="h1">Pipeline</h1>
          <p className="page-sub">{openUsd.length} open deals · {money(sum(openUsd, 'USD'))}{sum(deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost'), 'PKR') > 0 && <> · {money(sum(deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost'), 'PKR'), 'PKR')}</>}</p>
        </div>
        <div className="board-ctrl">
          <div className="r">
            <select className="select" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner"><option value="all">All owners</option>{members.map((m) => <option key={m.id}>{m.name}</option>)}</select>
            <select className="select sm" value={cur} onChange={(e) => setCur(e.target.value as 'USD')} aria-label="Currency"><option value="all">All</option><option>USD</option><option>PKR</option></select>
            <button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" s={16} w={2.2} />Add deal</button>
          </div>
        </div>
      </div>
      <Segmented label="Deal status" style={{ marginBottom: 18 }} value={tab} onChange={setTab}
        options={(['open', 'won', 'lost'] as const).map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1), count: k === 'open' ? open.length : filt.filter((d) => d.stage === k).length }))} />

      {tab === 'open' ? (
        <>
          <div className="board">
            {cols.map((st) => {
              const ds = open.filter((d) => d.stage === st.id)
              return (
                <div key={st.id} className={'col-b' + (over === st.id ? ' over' : '')}
                  onDragOver={(e) => { e.preventDefault(); setOver(st.id) }} onDragLeave={() => setOver((o) => (o === st.id ? null : o))} onDrop={() => dropOn(st.id)}>
                  <div className="ch"><span className="ch-l"><i className="dot" style={{ background: ST_VAR[st.id] }} /><span className="nm">{st.label}</span><span className="n">{ds.length}</span></span>
                    <span className="amt">{sum(ds, 'USD') > 0 && <span>{money(sum(ds, 'USD'))}</span>}{sum(ds, 'PKR') > 0 && <span>{money(sum(ds, 'PKR'), 'PKR')}</span>}</span></div>
                  {ds.map((d) => (
                    <div key={d.id} draggable className={'deal-card' + (drag === d.id ? ' drag' : '')} onDragStart={() => setDrag(d.id)} onDragEnd={() => { setDrag(null); setOver(null) }} onClick={() => nav('/app/pipeline/' + d.id)} role="button" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') nav('/app/pipeline/' + d.id) }}>
                      <div className="nm">{d.name}</div>
                      <div className="co">{companyName(d.companyId) || contactById(d.contactId)?.name}</div>
                      <div className="am">{money(d.amount, d.currency)}</div>
                      <div className="ft"><Avatar name={d.owner} tint="t-blue" size="xs" />{d.owner.split(' ')[0]}<span className="grow" /><span className="mono muted" style={{ fontSize: 11.5 }}>{d.close.slice(5)}</span></div>
                      {d.waiting && <div className="wt"><i />Reply waiting for you</div>}
                    </div>
                  ))}
                  {ds.length === 0 && <div className="muted" style={{ fontSize: 12.5, padding: '14px 4px' }}>No deals here</div>}
                </div>
              )
            })}
          </div>
          <div className="board-note">Drag a card to change its stage. Open a card for details. PKR and USD totals are never combined.</div>
        </>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="tbl-scroll"><table className="tbl">
            <thead><tr><th>Deal</th><th>Company</th><th>Owner</th><th className="r">Amount</th><th>{tab === 'won' ? 'Closed' : 'Reason'}</th></tr></thead>
            <tbody>
              {filt.filter((d) => d.stage === tab).map((d) => (
                <tr key={d.id} className="click" onClick={() => nav('/app/pipeline/' + d.id)}>
                  <td><b>{d.name}</b></td><td>{companyName(d.companyId)}</td><td>{d.owner}</td><td className="r mono">{money(d.amount, d.currency)}</td><td>{tab === 'won' ? d.close : d.lostReason}</td>
                </tr>
              ))}
              {filt.filter((d) => d.stage === tab).length === 0 && <tr><td colSpan={5} className="empty">No {tab} deals.</td></tr>}
            </tbody></table></div>
        </div>
      )}

      {adding && <AddDeal onClose={() => setAdding(false)} />}
      {lostFor && <LostModal id={lostFor} onClose={() => setLostFor(null)} />}
    </div>
  )
}

function LostModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [r, setR] = useState('')
  const [err, setErr] = useState(false)
  return (
    <Modal title="Mark as lost" onClose={onClose} foot={<><span className="note">Saved to the activity log.</span><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn danger solid" onClick={() => { if (!r) { setErr(true); return } moveDeal(id, 'lost', r); onClose() }}>Mark lost</button></div></>}>
      <Field label="Why was it lost?" error={err && !r ? 'Choose a reason' : ''}>
        <select className={'select' + (err && !r ? ' invalid' : '')} value={r} onChange={(e) => setR(e.target.value)}><option value="">Choose a reason</option>
          {['Chose another vendor', 'Budget', 'No decision', 'Bad timing', 'Not a fit'].map((x) => <option key={x}>{x}</option>)}</select>
      </Field>
    </Modal>
  )
}

function AddDeal({ onClose }: { onClose: () => void }) {
  const s = useStore((x) => x)
  const nav = useNavigate()
  const [name, setName] = useState(''); const [company, setCompany] = useState(''); const [contact, setContact] = useState('')
  const [amount, setAmount] = useState(''); const [currency, setCurrency] = useState<Currency>('USD'); const [stage, setStage] = useState<Stage>('new')
  const [owner, setOwner] = useState('Mahad Baig'); const [close, setClose] = useState(''); const [tried, setTried] = useState(false)
  const e = { name: nameErr(name, 'deal name', 2, LIMITS.name), amount: amountErr(amount), close: dateErr(close) }
  const bad = Object.values(e).some(Boolean) || !s.members.some((m) => m.name === owner)
  const contactsOfCompany = s.contacts.filter((c) => !company || c.companyId === company)
  return (
    <Modal title="Add deal" onClose={onClose} wide
      foot={<><span className="note">Currencies are kept apart.</span><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={() => {
          setTried(true); if (bad) return
          const d = addDeal({ name: clean(name), companyId: company || null, contactId: contact || null, amount: Number(amount.replace(/,/g, '')), currency, stage, owner, close: close || '2027-03-31' })
          toast('Deal added: ' + d.name); onClose(); nav('/app/pipeline/' + d.id)
        }}>Add deal</button></div></>}>
      <Field label="Deal name" error={tried ? e.name : ''}><input className={'input' + (tried && e.name ? ' invalid' : '')} maxLength={LIMITS.name} value={name} onChange={(x) => setName(x.target.value)} autoFocus /></Field>
      <div className="grid-2">
        <Field label="Company" opt><select className="select" value={company} onChange={(x) => { setCompany(x.target.value); setContact('') }}><option value="">None</option>{s.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Contact" opt><select className="select" value={contact} onChange={(x) => setContact(x.target.value)}><option value="">None</option>{contactsOfCompany.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      </div>
      <div className="grid-2">
        <Field label="Amount" error={tried ? e.amount : ''}><input className={'input' + (tried && e.amount ? ' invalid' : '')} inputMode="decimal" maxLength={16} value={amount} onChange={(x) => setAmount(x.target.value.replace(/,/g, ''))} placeholder="0" /></Field>
        <Field label="Currency"><select className="select" value={currency} onChange={(x) => setCurrency(x.target.value as Currency)}><option>USD</option><option>PKR</option></select></Field>
      </div>
      <div className="grid-2">
        <Field label="Stage"><select className="select" value={stage} onChange={(x) => setStage(x.target.value as Stage)}>{STAGES.slice(0, 5).map((st) => <option key={st.id} value={st.id}>{st.label}</option>)}</select></Field>
        <Field label="Owner"><select className="select" value={owner} onChange={(x) => setOwner(x.target.value)}>{s.members.map((m) => <option key={m.id}>{m.name}</option>)}</select></Field>
      </div>
      <Field label="Expected close" opt error={tried ? e.close : ''}><input className={'input' + (tried && e.close ? ' invalid' : '')} type="date" max="2100-12-31" value={close} onChange={(x) => setClose(x.target.value)} /></Field>
    </Modal>
  )
}

export function DealDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const deal = useStore((s) => (idOk(id) ? s.deals.find((d) => d.id === id) : undefined))
  const allThreads = useStore((s) => s.threads)
  const threads = allThreads.filter((t) => t.dealId === id)
  const [edit, setEdit] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const noteErr = note !== null && cleanMulti(note).length > LIMITS.note ? `Keep the note under ${LIMITS.note} characters.` : ''
  const [lost, setLost] = useState(false)
  useTitle(deal?.name ?? 'Deal')
  if (!deal) return <div className="page"><Link className="back-link" to="/app/pipeline"><Icon n="arrowL" s={15} />Pipeline</Link><div className="empty">Deal not found.</div></div>
  const c = contactById(deal.contactId)
  const idx = STAGES.findIndex((s) => s.id === deal.stage)
  const track = STAGES.slice(0, 5)
  return (
    <div className="page narrow">
      <Link className="back-link" to="/app/pipeline"><Icon n="arrowL" s={15} />Pipeline</Link>
      <div className="detail-head">
        <div><h1>{deal.name}</h1><div className="sub">{companyName(deal.companyId) || 'No company'}{c && <> · <Link className="link" to={'/app/contacts/' + c.id}>{c.name}</Link></>} · Owner {deal.owner}</div></div>
        <div className="col" style={{ alignItems: 'flex-end', gap: 10 }}>
          <div className="big-amt">{money(deal.amount, deal.currency)}</div>
          <div className="row">
            <button className="btn" onClick={() => setEdit(true)}><Icon n="edit" s={15} />Edit</button>
            {deal.stage !== 'won' && deal.stage !== 'lost' && <><button className="btn approve" onClick={() => { moveDeal(deal.id, 'won'); toast(deal.name + ' marked as won') }}>Mark won</button>
              <button className="btn danger" onClick={() => setLost(true)}>Mark lost</button></>}
          </div>
        </div>
      </div>

      <div className="card pad" style={{ marginBottom: 20 }}>
        <div className="stage-track" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {track.map((st, i) => (
            <div key={st.id} className={(i < idx ? 'passed ' : '') + (st.id === deal.stage ? 'cur' : '')} style={{ ['--c' as string]: ST_VAR[st.id] }}>
              <button onClick={() => { if (deal.stage !== st.id) moveDeal(deal.id, st.id) }} aria-label={'Move to ' + st.label}><i />{st.label}</button>
            </div>
          ))}
        </div>
        {(deal.stage === 'won' || deal.stage === 'lost') && <div style={{ marginTop: 14 }}><span className={'tag ' + (deal.stage === 'won' ? 'green' : 'red')}>{stageLabel(deal.stage)}{deal.lostReason ? ': ' + deal.lostReason : ''}</span></div>}
      </div>

      <div className="grid-2">
        <div className="card pad">
          <div className="card-title">Details</div>
          <div style={{ marginTop: 14 }}>
            <div className="kv"><span>Stage</span><span>{stageLabel(deal.stage)}</span></div>
            <div className="kv"><span>Currency</span><span>{deal.currency}</span></div>
            <div className="kv"><span>Expected close</span><span>{deal.close}</span></div>
            <div className="kv"><span>Created</span><span>{deal.created}</span></div>
            <div className="kv"><span>Reply waiting</span><span>{deal.waiting ? <Link className="link" to="/app/review">Yes, in Review</Link> : 'No'}</span></div>
          </div>
          <div className="card-title" style={{ marginTop: 26, marginBottom: 10 }}>Notes</div>
          <textarea className={'textarea' + (noteErr ? ' invalid' : '')} rows={3} maxLength={LIMITS.note + 50} value={note ?? deal.note ?? ''} onChange={(e) => setNote(e.target.value)} placeholder="Add a note for your team" />{noteErr && <span className="err">{noteErr}</span>}
          <div className="actions-end"><button className="btn sm" disabled={note === null || !!noteErr} onClick={() => { updateDeal(deal.id, { note: cleanMulti(note ?? '') }); setNote(null); toast('Note saved') }}>Save note</button></div>
        </div>
        <div className="card pad">
          <div className="card-title">Activity</div>
          <div style={{ marginTop: 10 }}>
            {threads.flatMap((t) => t.messages.map((m, i) => ({ t, m, i }))).reverse().map(({ t, m, i }) => (
              <div className="tl-item" key={t.id + i}><i className="dot round" style={{ background: m.from === 'me' ? 'var(--approve)' : 'var(--info)' }} /><div><div className="tt">{m.from === 'me' ? 'You replied' : m.name + ' wrote'} <span>· {t.subject}</span></div><div className="tm">{m.time}</div></div></div>
            ))}
            <div className="tl-item"><i className="dot round" /><div><div className="tt">Deal created</div><div className="tm">{deal.created}</div></div></div>
          </div>
          {threads.length > 0 && <button className="btn sm" style={{ marginTop: 12 }} onClick={() => nav('/app/inbox')}>Open in Inbox</button>}
        </div>
      </div>
      {edit && <EditDeal id={deal.id} onClose={() => setEdit(false)} />}
      {lost && <LostModal id={deal.id} onClose={() => setLost(false)} />}
    </div>
  )
}

function EditDeal({ id, onClose }: { id: string; onClose: () => void }) {
  const d = getState().deals.find((x) => x.id === id)!
  const [name, setName] = useState(d.name); const [amount, setAmount] = useState(String(d.amount)); const [close, setClose] = useState(d.close)
  const eName = nameErr(name, 'deal name', 2, LIMITS.name); const eAmt = amountErr(amount); const eClose = dateErr(close, { allowPast: true })
  const bad = !!(eName || eAmt || eClose)
  const [tried, setTried] = useState(false)
  return (
    <Modal title="Edit deal" onClose={onClose} foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={() => { setTried(true); if (bad) return; updateDeal(id, { name: clean(name), amount: Number(amount.replace(/,/g, '')), close }); logAudit('Edited deal', clean(name)); toast('Deal updated'); onClose() }}>Save</button></div></>}>
      <Field label="Deal name" error={tried ? eName : ''}><input className={'input' + (tried && eName ? ' invalid' : '')} maxLength={LIMITS.name} value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Field label={'Amount (' + d.currency + ')'} error={tried ? eAmt : ''}><input className={'input' + (tried && eAmt ? ' invalid' : '')} inputMode="decimal" maxLength={16} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      <Field label="Expected close" error={tried ? eClose : ''}><input className={'input' + (tried && eClose ? ' invalid' : '')} type="date" max="2100-12-31" value={close} onChange={(e) => setClose(e.target.value)} /></Field>
    </Modal>
  )
}
