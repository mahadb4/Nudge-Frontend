import { useRef, useState } from 'react'
import { Icon } from '../components/Icons'
import { Field, Modal, ReplyMark, useTitle } from '../components/ui'
import { LIMITS, clean, nameErr, textErr } from '../data/validate'
import { nid, patch, toast, useStore } from '../store'
import { REPLY_TYPES, type ReplyType } from '../data/seed'

const VARS = ['{first_name}', '{company}', '{day}', '{time}', '{date}', '{sender_first_name}']

export function Templates() {
  useTitle('Templates')
  const templates = useStore((s) => s.templates)
  const facts = useStore((s) => s.facts)
  const [sel, setSel] = useState<string | undefined>(templates[0]?.id)
  const [adding, setAdding] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const cur = templates.find((t) => t.id === sel) ?? templates[0]
  const upd = (p: Partial<typeof templates[number]>) => patch('templates', (a) => a.map((t) => (t.id === cur.id ? { ...t, ...p } : t)))
  const nameE = cur ? nameErr(cur.name, 'template name', 2, LIMITS.name) || (templates.some((t) => t.id !== cur.id && clean(t.name).toLowerCase() === clean(cur.name).toLowerCase()) ? 'A template with this name already exists.' : '') : ''
  const bodyE = cur ? textErr(cur.body, 'template body', 5, LIMITS.body) : ''
  const insert = (v: string) => {
    const el = ta.current; if (!el || !cur) return
    const a = el.selectionStart, b = el.selectionEnd
    upd({ body: cur.body.slice(0, a) + v + cur.body.slice(b) })
    setTimeout(() => { el.focus(); el.setSelectionRange(a + v.length, a + v.length) }, 0)
  }
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="h1">Templates</h1><p className="page-sub">Starting points Nudge adapts to each reply. Facts come only from your approved list.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" s={16} w={2.2} />New template</button></div>
      <div className="tpl-grid">
        <div>{templates.map((t) => (
          <button key={t.id} className={'tpl-item' + (t.id === cur?.id ? ' on' : '')} onClick={() => setSel(t.id)}>
            <b>{t.name}</b><div className="m"><ReplyMark t={t.type} /><span>{t.uses} uses</span></div></button>))}</div>
        {cur ? (
          <div className="card pad">
            <div className="grid-2"><Field label="Name" error={nameE}><input className={'input' + (nameE ? ' invalid' : '')} maxLength={LIMITS.name + 10} value={cur.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
              <Field label="Reply type"><select className="select" value={cur.type} onChange={(e) => upd({ type: e.target.value as ReplyType })}>{REPLY_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field></div>
            <div className="label" style={{ margin: '18px 0 8px' }}>Body</div>
            <textarea ref={ta} className={'textarea' + (bodyE ? ' invalid' : '')} rows={11} maxLength={LIMITS.body + 50} value={cur.body} onChange={(e) => upd({ body: e.target.value })} />{bodyE && <span className="err">{bodyE}</span>}
            <div className="row wrap" style={{ marginTop: 12 }}><span className="muted" style={{ fontSize: 12.5 }}>Insert</span>{VARS.map((v) => <button key={v} className="var-chip mono" onClick={() => insert(v)}>{v}</button>)}</div>
            <div className="actions-end"><button className="btn" onClick={() => { patch('templates', (a) => a.filter((t) => t.id !== cur.id)); setSel(undefined); toast('Template deleted') }}>Delete</button><button className="btn primary" disabled={!!(nameE || bodyE)} onClick={() => toast('Template saved')}>Save</button></div>
          </div>
        ) : <div className="empty">Pick a template.</div>}
        <div><div className="sect"><h3>Approved facts</h3></div>
          {facts.filter((f) => f.on).map((f) => <button key={f.id} className="fact-card" onClick={() => insert('{' + f.key.toLowerCase().replace(/\s+/g, '_') + '}')}><b>{f.key}</b><span>{f.value}</span></button>)}
          <p className="hint">Click a fact to insert it. Facts that are off never reach a draft.</p></div>
      </div>
      {adding && <NewTemplate onClose={() => setAdding(false)} onMade={(id) => setSel(id)} />}
    </div>
  )
}

function NewTemplate({ onClose, onMade }: { onClose: () => void; onMade: (id: string) => void }) {
  const [name, setName] = useState(''); const [type, setType] = useState<ReplyType>('meeting'); const [tried, setTried] = useState(false)
  const all = useStore((x) => x.templates)
  const err = nameErr(name, 'template name', 2, LIMITS.name) || (all.some((t) => clean(t.name).toLowerCase() === clean(name).toLowerCase()) ? 'A template with this name already exists.' : '')
  return (
    <Modal title="New template" onClose={onClose} foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={() => { setTried(true); if (err) return; const id = nid('tp'); patch('templates', (a) => [...a, { id, name: clean(name), type, uses: 0, updated: 'Just now', body: 'Hi {first_name},\n\n\n\nBest,\n{sender_first_name}' }]); onMade(id); onClose() }}>Create</button></div></>}>
      <Field label="Name" error={tried ? err : ''}><input className={'input' + (tried && err ? ' invalid' : '')} maxLength={LIMITS.name + 10} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
      <Field label="Reply type"><select className="select" value={type} onChange={(e) => setType(e.target.value as ReplyType)}>{REPLY_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select></Field>
    </Modal>
  )
}
