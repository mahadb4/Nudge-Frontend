import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icons'
import { Avatar, Field, Modal, ST_VAR, companyName, contactById, downloadCSV, emailOk, useTitle } from '../components/ui'
import { addCompany, addContact, toast, useStore, nid, setState, logAudit } from '../store'
import { money, stageLabel } from '../data/seed'

const statusEl = (s: string) => <span className={s === 'Active' ? 'st-act' : s === 'Opted out' ? 'st-act st-opt' : 'st-act st-sus'}>{s}</span>

export function Contacts() {
  useTitle('Contacts')
  const nav = useNavigate()
  const contacts = useStore((s) => s.contacts)
  const [q, setQ] = useState(''); const [st, setSt] = useState('all'); const [ow, setOw] = useState('all')
  const [adding, setAdding] = useState(false); const [imp, setImp] = useState(false)
  const list = contacts.filter((c) => (st === 'all' || c.status === st) && (ow === 'all' || c.owner === ow) && (c.name + c.email + companyName(c.companyId)).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="h1">Contacts</h1><p className="page-sub">{contacts.length} people. Opted-out contacts are blocked from every send.</p></div>
        <div className="row"><button className="btn" onClick={() => setImp(true)}><Icon n="upload" s={15} />Import CSV</button><button className="btn" onClick={() => downloadCSV('contacts.csv', [['Name', 'Email', 'Company', 'Title', 'Status'], ...list.map((c) => [c.name, c.email, companyName(c.companyId), c.title, c.status])])}><Icon n="download" s={15} />Export</button>
          <button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" s={16} w={2.2} />Add contact</button></div></div>
      <div className="filters">
        <div className="sbox"><Icon n="search" s={16} /><input className="input" placeholder="Search name, email, company" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="select" value={st} onChange={(e) => setSt(e.target.value)} aria-label="Status"><option value="all">All statuses</option><option>Active</option><option>Opted out</option><option>Suspended</option></select>
        <select className="select" value={ow} onChange={(e) => setOw(e.target.value)} aria-label="Owner"><option value="all">All owners</option>{['Mahad Baig', 'Sana Iqbal', 'Zain Ahmed', 'Hira Malik'].map((o) => <option key={o}>{o}</option>)}</select>
        <span className="count">{list.length} shown</span>
      </div>
      <div className="card tbl-scroll"><table className="tbl">
        <thead><tr><th>Name</th><th>Company</th><th>Title</th><th>Owner</th><th>Status</th><th className="r">Last contact</th></tr></thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id} className="click" onClick={() => nav('/app/contacts/' + c.id)}>
              <td><div className="person-cell"><Avatar name={c.name} tint={c.tint} /><div><b>{c.name}</b><span className="mono">{c.email}</span></div></div></td>
              <td>{companyName(c.companyId) || <span className="faint">None</span>}</td><td>{c.title}</td><td>{c.owner}</td><td>{statusEl(c.status)}</td><td className="r mono muted">{c.last}</td>
            </tr>
          ))}
          {list.length === 0 && <tr><td colSpan={6} className="empty">No contacts match.</td></tr>}
        </tbody></table></div>
      {adding && <AddContact onClose={() => setAdding(false)} />}
      {imp && <ImportCSV onClose={() => setImp(false)} />}
    </div>
  )
}

function AddContact({ onClose, companyId = '' }: { onClose: () => void; companyId?: string }) {
  const companies = useStore((s) => s.companies); const contacts = useStore((s) => s.contacts)
  const nav = useNavigate()
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [title, setTitle] = useState(''); const [co, setCo] = useState(companyId); const [phone, setPhone] = useState('')
  const [tried, setTried] = useState(false)
  const e = { name: name.trim().length < 2 ? 'Enter a name' : '', email: !emailOk(email) ? 'Enter a valid email' : contacts.some((c) => c.email.toLowerCase() === email.toLowerCase()) ? 'A contact with this email already exists' : '' }
  const bad = !!(e.name || e.email)
  return (
    <Modal title="Add contact" onClose={onClose} wide foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={() => { setTried(true); if (bad) return; const k = addContact({ name: name.trim(), email, title, companyId: co || null, phone, location: '', owner: 'Mahad Baig' }); toast(k.name + ' added'); onClose(); nav('/app/contacts/' + k.id) }}>Add contact</button></div></>}>
      <div className="grid-2">
        <Field label="Full name" error={tried ? e.name : ''}><input className={'input' + (tried && e.name ? ' invalid' : '')} value={name} onChange={(x) => setName(x.target.value)} autoFocus /></Field>
        <Field label="Email" error={tried ? e.email : ''}><input className={'input' + (tried && e.email ? ' invalid' : '')} value={email} onChange={(x) => setEmail(x.target.value)} /></Field>
      </div>
      <div className="grid-2">
        <Field label="Title" opt><input className="input" value={title} onChange={(x) => setTitle(x.target.value)} /></Field>
        <Field label="Phone" opt><input className="input" value={phone} onChange={(x) => setPhone(x.target.value)} /></Field>
      </div>
      <Field label="Company" opt><select className="select" value={co} onChange={(x) => setCo(x.target.value)}><option value="">None</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
    </Modal>
  )
}

function ImportCSV({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [over, setOver] = useState(false)
  const [err, setErr] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const read = (f: File) => {
    if (!/\.csv$/i.test(f.name)) { setErr('Choose a .csv file'); return }
    f.text().then((t) => {
      const r = t.split(/\r?\n/).filter(Boolean).map((l) => l.split(',').map((x) => x.replace(/^"|"$/g, '').trim()))
      if (r.length < 2) { setErr('The file has no rows'); return }
      setErr(''); setRows(r)
    })
  }
  const body = rows?.slice(1) ?? []
  const good = body.filter((r) => emailOk(r[1] ?? ''))
  return (
    <Modal title="Import contacts" onClose={onClose} wide foot={<><span className="note">{rows ? `${good.length} valid, ${body.length - good.length} skipped` : 'Columns: Name, Email, Title'}</span><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!rows || good.length === 0} onClick={() => { good.forEach((r) => addContact({ name: r[0], email: r[1], title: r[2] ?? '', companyId: null, phone: '', location: '', owner: 'Mahad Baig' })); toast(good.length + ' contacts imported'); onClose() }}>Import {good.length || ''}</button></div></>}>
      {!rows ? <>
        <div className={'drop' + (over ? ' over' : '')} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) read(f) }}>
          <Icon n="upload" s={26} /><p style={{ margin: '10px 0 14px' }}>Drop a CSV here</p><button className="btn" onClick={() => input.current?.click()}>Choose file</button>
          <input ref={input} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />
        </div>
        {err && <span className="err">{err}</span>}
        <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => downloadCSV('contacts-template.csv', [['Name', 'Email', 'Title'], ['Ada Lovelace', 'ada@example.com', 'CTO']])}><Icon n="download" s={14} />Download a template</button>
      </> : (
        <table className="tbl"><thead><tr><th>Name</th><th>Email</th><th>Title</th><th /></tr></thead><tbody>
          {body.slice(0, 8).map((r, i) => <tr key={i}><td>{r[0]}</td><td className="mono">{r[1]}</td><td>{r[2]}</td><td>{emailOk(r[1] ?? '') ? <span className="tag green">OK</span> : <span className="tag red">Bad email</span>}</td></tr>)}
        </tbody></table>
      )}
    </Modal>
  )
}

export function ContactDetail() {
  const { id } = useParams()
  const c = useStore((s) => s.contacts.find((x) => x.id === id))
  const allDeals = useStore((s) => s.deals); const allThreads = useStore((s) => s.threads)
  const deals = allDeals.filter((d) => d.contactId === id)
  const threads = allThreads.filter((t) => t.contactId === id)
  useTitle(c?.name ?? 'Contact')
  if (!c) return <div className="page"><Link className="back-link" to="/app/contacts"><Icon n="arrowL" s={15} />Contacts</Link><div className="empty">Contact not found.</div></div>
  const optOut = () => { setState((s) => ({ contacts: s.contacts.map((x) => (x.id === c.id ? { ...x, status: x.status === 'Opted out' ? 'Active' : 'Opted out' } : x)) })); logAudit('Changed opt-out', c.name); toast(c.status === 'Opted out' ? 'Opt-out removed' : c.name + ' is opted out. Nudge will not send.') }
  return (
    <div className="page narrow">
      <Link className="back-link" to="/app/contacts"><Icon n="arrowL" s={15} />Contacts</Link>
      <div className="detail-head">
        <div className="row" style={{ gap: 16 }}><Avatar name={c.name} tint={c.tint} size="lg" /><div><h1>{c.name}</h1><div className="sub">{c.title}{c.companyId && <> at <Link className="link" to={'/app/companies/' + c.companyId}>{companyName(c.companyId)}</Link></>}</div></div></div>
        <button className={'btn ' + (c.status === 'Opted out' ? '' : 'danger')} onClick={optOut}>{c.status === 'Opted out' ? 'Remove opt-out' : 'Mark opted out'}</button>
      </div>
      {c.status === 'Opted out' && <div className="callout amber" style={{ marginBottom: 20 }}><i className="dot round" /><span>This person opted out. Nudge blocks every send, including approved drafts.</span></div>}
      <div className="grid-2">
        <div className="card pad"><div className="card-title">Profile</div>
          <div style={{ marginTop: 14 }}>
            <div className="kv"><span>Email</span><span className="mono">{c.email}</span></div>
            <div className="kv"><span>Phone</span><span>{c.phone || '–'}</span></div>
            <div className="kv"><span>Location</span><span>{c.location || '–'}</span></div>
            <div className="kv"><span>Owner</span><span>{c.owner}</span></div>
            <div className="kv"><span>Status</span><span>{statusEl(c.status)}</span></div>
            <div className="kv"><span>Last contact</span><span>{c.last}</span></div>
          </div></div>
        <div className="col gap-20">
          <div className="card pad"><div className="card-title">Deals</div>
            {deals.length === 0 && <div className="muted" style={{ marginTop: 10 }}>No deals yet.</div>}
            {deals.map((d) => <Link to={'/app/pipeline/' + d.id} key={d.id} className="row spread" style={{ padding: '12px 0', borderTop: '1px solid var(--hair)', marginTop: 8 }}><div><b>{d.name}</b><div className="muted" style={{ fontSize: 12.5 }}><i className="dot round" style={{ background: ST_VAR[d.stage], marginRight: 6 }} />{stageLabel(d.stage)}</div></div><span className="mono">{money(d.amount, d.currency)}</span></Link>)}
          </div>
          <div className="card pad"><div className="card-title">Conversations</div>
            {threads.length === 0 && <div className="muted" style={{ marginTop: 10 }}>No emails yet.</div>}
            {threads.map((t) => <Link to="/app/inbox" key={t.id} style={{ display: 'block', padding: '12px 0', borderTop: '1px solid var(--hair)', marginTop: 8 }}><b>{t.subject}</b><div className="muted" style={{ fontSize: 12.5 }}>{t.preview}</div></Link>)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Companies() {
  useTitle('Companies')
  const nav = useNavigate()
  const companies = useStore((s) => s.companies); const deals = useStore((s) => s.deals); const contacts = useStore((s) => s.contacts)
  const [q, setQ] = useState(''); const [adding, setAdding] = useState(false)
  const list = companies.filter((c) => (c.name + c.industry + c.location).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="h1">Companies</h1><p className="page-sub">{companies.length} companies. Open deal totals count USD only.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" s={16} w={2.2} />Add company</button></div>
      <div className="filters"><div className="sbox"><Icon n="search" s={16} /><input className="input" placeholder="Search companies" value={q} onChange={(e) => setQ(e.target.value)} /></div><span className="count">{list.length} shown</span></div>
      <div className="card tbl-scroll"><table className="tbl">
        <thead><tr><th>Company</th><th>Industry</th><th>Location</th><th className="r">People</th><th className="r">Open deals</th><th className="r">Open value</th></tr></thead>
        <tbody>{list.map((c) => {
          const od = deals.filter((d) => d.companyId === c.id && d.stage !== 'won' && d.stage !== 'lost' && d.currency === 'USD')
          return <tr key={c.id} className="click" onClick={() => nav('/app/companies/' + c.id)}>
            <td><div className="person-cell"><Avatar name={c.name} tint="t-grey" /><div><b>{c.name}</b><span className="mono">{c.domain}</span></div></div></td>
            <td>{c.industry}</td><td>{c.location}</td><td className="r mono">{contacts.filter((p) => p.companyId === c.id).length}</td><td className="r mono">{od.length}</td><td className="r mono">{money(od.reduce((a, d) => a + d.amount, 0))}</td></tr>
        })}{list.length === 0 && <tr><td colSpan={6} className="empty">No companies match.</td></tr>}</tbody></table></div>
      {adding && <AddCompany onClose={() => setAdding(false)} />}
    </div>
  )
}

function AddCompany({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const [name, setName] = useState(''); const [domain, setDomain] = useState(''); const [industry, setIndustry] = useState(''); const [tried, setTried] = useState(false)
  const e = { name: name.trim().length < 2 ? 'Enter a company name' : '', domain: domain && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(domain) ? 'Use a domain like acme.com' : '' }
  return (
    <Modal title="Add company" onClose={onClose} foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={() => { setTried(true); if (e.name || e.domain) return; const k = addCompany({ name: name.trim(), domain, industry: industry || 'Other', size: '–', location: '–', owner: 'Mahad Baig', website: domain }); toast(k.name + ' added'); onClose(); nav('/app/companies/' + k.id) }}>Add company</button></div></>}>
      <Field label="Company name" error={tried ? e.name : ''}><input className={'input' + (tried && e.name ? ' invalid' : '')} value={name} onChange={(x) => setName(x.target.value)} autoFocus /></Field>
      <Field label="Domain" opt error={tried ? e.domain : ''}><input className="input" value={domain} onChange={(x) => setDomain(x.target.value)} placeholder="acme.com" /></Field>
      <Field label="Industry" opt><input className="input" value={industry} onChange={(x) => setIndustry(x.target.value)} /></Field>
    </Modal>
  )
}

export function CompanyDetail() {
  const { id } = useParams()
  const co = useStore((s) => s.companies.find((x) => x.id === id))
  const allPeople = useStore((s) => s.contacts); const allDeals = useStore((s) => s.deals)
  const people = allPeople.filter((c) => c.companyId === id)
  const deals = allDeals.filter((d) => d.companyId === id)
  const [adding, setAdding] = useState(false)
  useTitle(co?.name ?? 'Company')
  if (!co) return <div className="page"><Link className="back-link" to="/app/companies"><Icon n="arrowL" s={15} />Companies</Link><div className="empty">Company not found.</div></div>
  const suggest = id === 'c3' && !people.some((p) => p.name === 'Omar Siddiqui')
  return (
    <div className="page narrow">
      <Link className="back-link" to="/app/companies"><Icon n="arrowL" s={15} />Companies</Link>
      <div className="detail-head"><div className="row" style={{ gap: 16 }}><Avatar name={co.name} tint="t-grey" size="lg" /><div><h1>{co.name}</h1><div className="sub">{co.industry} · {co.location}</div></div></div>
        <button className="btn" onClick={() => setAdding(true)}><Icon n="plus" s={15} />Add person</button></div>
      <div className="grid-2">
        <div className="card pad"><div className="card-title">About</div><div style={{ marginTop: 14 }}>
          <div className="kv"><span>Website</span><a href="#" onClick={(e) => e.preventDefault()}>{co.website || '–'}</a></div>
          <div className="kv"><span>Industry</span><span>{co.industry}</span></div><div className="kv"><span>Size</span><span>{co.size}</span></div>
          <div className="kv"><span>Location</span><span>{co.location}</span></div><div className="kv"><span>Owner</span><span>{co.owner}</span></div></div></div>
        <div className="col gap-20">
          <div className="card pad"><div className="card-title">People</div>
            {people.map((p) => <Link key={p.id} to={'/app/contacts/' + p.id} className="sugg-row"><Avatar name={p.name} tint={p.tint} /><div className="grow"><b>{p.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{p.title}</div></div>{statusEl(p.status)}</Link>)}
            {people.length === 0 && <div className="muted" style={{ marginTop: 10 }}>No people yet.</div>}
            {suggest && <div className="sugg-row"><Avatar name="Omar Siddiqui" tint="t-teal" /><div className="grow"><b>Omar Siddiqui</b><div className="muted" style={{ fontSize: 12.5 }}>Suggested from Daniel Reed's reply</div></div>
              <button className="btn sm" onClick={() => { addContact({ name: 'Omar Siddiqui', email: 'omar@brightpath.io', title: 'Operations', companyId: 'c3', phone: '', location: '', owner: 'Mahad Baig' }); toast('Omar Siddiqui added') }}>Add</button></div>}
          </div>
          <div className="card pad"><div className="card-title">Deals</div>
            {deals.map((d) => <Link to={'/app/pipeline/' + d.id} key={d.id} className="row spread" style={{ padding: '12px 0', borderTop: '1px solid var(--hair)', marginTop: 8 }}><div><b>{d.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{stageLabel(d.stage)}</div></div><span className="mono">{money(d.amount, d.currency)}</span></Link>)}
            {deals.length === 0 && <div className="muted" style={{ marginTop: 10 }}>No deals yet.</div>}
          </div>
        </div>
      </div>
      {adding && <AddContact onClose={() => setAdding(false)} companyId={co.id} />}
    </div>
  )
}
void contactById; void nid
