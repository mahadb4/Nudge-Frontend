/* Companies against the real API (GET/POST /companies/, GET/PATCH/DELETE /companies/{id}/).
   Rules: a change is shown as done only after the server has saved it, and then the row is read again from the server.
   An error shows the mapped message and leaves the data as it was. Used when mock mode is off (see Crm.tsx). */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, Code, apiMessage, fieldMessages } from '../api'
import { companies as api, contacts as contactsApi, formatMoney, SIZE_RANGES, type CompanyDto, type CompanyInput, type ContactDto, type SizeRange } from '../api/crm'
import { Icon } from '../components/Icons'
import { useSubmit } from '../components/guards'
import { Pager, usePaged } from '../components/live'
import { AddContactLive } from './ContactsLive'
import { Avatar, Field, Modal, useTitle } from '../components/ui'
import { LIMITS, clean, domainErr, nameErr } from '../data/validate'
import { toast } from '../store'

const INDUSTRY_MAX = 80

/** Field errors the server found, keyed by our field names, plus a banner when nothing points at a field. */
function serverErrors(err: unknown): { fields: Record<string, string>; banner: string } {
  const f = fieldMessages(err)
  const fields: Record<string, string> = { name: f.name ?? '', domain: f.domain ?? '', industry: f.industry ?? '', size_range: f.size_range ?? '' }
  if (err instanceof ApiError && err.apiCode === Code.COMPANY_NAME_TAKEN) fields.name = err.message
  if (err instanceof ApiError && err.apiCode === Code.COMPANY_DOMAIN_TAKEN) fields.domain = err.message
  return { fields, banner: Object.values(fields).some(Boolean) ? '' : apiMessage(err) }
}

const sizeLabel = (s: SizeRange | null) => s ?? '–'
const openValue = (c: CompanyDto) => (c.open_value.length ? c.open_value.map((m) => formatMoney(m.amount, m.currency)).join(' + ') : '–')

export function CompaniesLive() {
  useTitle('Companies')
  const nav = useNavigate()
  const [adding, setAdding] = useState(false)
  const list = usePaged<CompanyDto>(({ q, page, signal }) => api.list({ q, page, signal }))
  const rows = list.data?.results ?? []
  const count = list.data?.count ?? 0
  const searching = list.q !== ''
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="h1">Companies</h1><p className="page-sub">{list.data ? `${count} ${count === 1 ? 'company' : 'companies'}.` : 'Loading…'} Open deal totals are shown per currency.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" s={16} w={2.2} />Add company</button></div>
      <div className="filters"><div className="sbox"><Icon n="search" s={16} /><input className="input" type="search" maxLength={LIMITS.search} autoComplete="off" spellCheck={false} aria-label="Search companies" placeholder="Search name, domain, industry" value={list.input} onChange={(e) => list.setInput(e.target.value)} /></div>
        {list.data && <span className="count">{rows.length} shown</span>}</div>
      {list.error && <div className="callout amber" role="alert" style={{ marginBottom: 14 }}><i className="dot round" /><span>{list.error} <button className="link plain" onClick={list.reload}>Try again</button></span></div>}
      <div className="card tbl-scroll"><table className="tbl">
        <thead><tr><th>Company</th><th>Industry</th><th>Size</th><th>Owner</th><th className="r">People</th><th className="r">Open deals</th><th className="r">Open value</th></tr></thead>
        <tbody>{rows.map((c) => (
          <tr key={c.id} className="click" onClick={() => nav('/app/companies/' + c.id)}>
            <td><div className="person-cell"><Avatar name={c.name} tint="t-grey" /><div><b>{c.name}</b><span className="mono">{c.domain ?? ''}</span></div></div></td>
            <td>{c.industry ?? '–'}</td><td>{sizeLabel(c.size_range)}</td><td>{c.owner.name}</td>
            <td className="r mono">{c.people_count}</td><td className="r mono">{c.open_deal_count}</td><td className="r mono">{openValue(c)}</td>
          </tr>))}
          {list.data && rows.length === 0 && (
            <tr><td colSpan={7} className="empty">{searching ? 'No companies match your search.' : <>No companies yet. Add your first one.<div style={{ marginTop: 12 }}><button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" s={15} w={2.2} />Add company</button></div></>}</td></tr>)}
          {!list.data && list.loading && <tr><td colSpan={7} className="empty" role="status">Loading…</td></tr>}
        </tbody></table></div>
      <Pager page={list.page} count={count} onPage={list.setPage} />
      {adding && <AddCompany onClose={() => setAdding(false)} />}
    </div>
  )
}

function useCompanyForm(start?: CompanyDto) {
  const [name, setName] = useState(start?.name ?? ''); const [domain, setDomain] = useState(start?.domain ?? '')
  const [industry, setIndustry] = useState(start?.industry ?? ''); const [size, setSize] = useState<SizeRange | ''>(start?.size_range ?? '')
  const [tried, setTried] = useState(false); const [srv, setSrv] = useState<Record<string, string>>({}); const [msg, setMsg] = useState('')
  const e = {
    name: nameErr(name, 'company name', 2, LIMITS.company),
    domain: domainErr(domain),
    industry: clean(industry).length > INDUSTRY_MAX ? `Keep the industry under ${INDUSTRY_MAX} characters.` : '',
  }
  const bad = !!(e.name || e.domain || e.industry)
  const err = (k: keyof typeof e) => (tried ? e[k] : '') || srv[k] || ''
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setSrv({}); setMsg('') }
  return { name, domain, industry, size, setName: edit(setName), setDomain: edit(setDomain), setIndustry: edit(setIndustry), setSize: edit(setSize), tried, setTried, srv, setSrv, msg, setMsg, e, bad, err }
}

function CompanyFields({ f }: { f: ReturnType<typeof useCompanyForm> }) {
  return (<>
    {f.msg && <div className="callout amber" role="alert"><i className="dot round" />{f.msg}</div>}
    <Field label="Company name" error={f.err('name')}><input className={'input' + (f.err('name') ? ' invalid' : '')} maxLength={LIMITS.company} value={f.name} onChange={(x) => f.setName(x.target.value)} autoFocus /></Field>
    <Field label="Domain" opt error={f.err('domain')}><input className={'input' + (f.err('domain') ? ' invalid' : '')} maxLength={LIMITS.domain} value={f.domain} onChange={(x) => f.setDomain(x.target.value)} placeholder="acme.com" autoCapitalize="none" spellCheck={false} /></Field>
    <Field label="Industry" opt error={f.err('industry')}><input className={'input' + (f.err('industry') ? ' invalid' : '')} maxLength={INDUSTRY_MAX + 20} value={f.industry} onChange={(x) => f.setIndustry(x.target.value)} /></Field>
    <Field label="Size" opt error={f.srv.size_range}><select className="select" value={f.size} onChange={(x) => f.setSize(x.target.value as SizeRange | '')}><option value="">Not set</option>{SIZE_RANGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
  </>)
}

function AddCompany({ onClose }: { onClose: () => void }) {
  const nav = useNavigate()
  const { busy, run } = useSubmit()
  const f = useCompanyForm()
  const submit = () => {
    f.setTried(true); f.setSrv({}); f.setMsg('')
    if (f.bad) return
    const body: CompanyInput = { name: clean(f.name) }
    if (f.domain.trim()) body.domain = f.domain.trim().toLowerCase()
    if (clean(f.industry)) body.industry = clean(f.industry)
    if (f.size) body.size_range = f.size
    void run(async () => {
      try {
        const c = await api.create(body)
        toast(c.name + ' added'); onClose(); nav('/app/companies/' + c.id) // the detail page reads the row from the server
      } catch (err) { const s = serverErrors(err); f.setSrv(s.fields); f.setMsg(s.banner) }
    })
  }
  return (
    <Modal title="Add company" onClose={onClose} foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Adding…' : 'Add company'}</button></div></>}>
      <CompanyFields f={f} />
    </Modal>
  )
}

export function CompanyDetailLive() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [co, setCo] = useState<CompanyDto | null>(null); const [people, setPeople] = useState<ContactDto[]>([])
  const [error, setError] = useState(''); const [missing, setMissing] = useState(false); const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false); const [deleting, setDeleting] = useState(false); const [addingPerson, setAddingPerson] = useState(false)
  useTitle(co?.name ?? 'Company')

  /** Reads the company and its people from the server. Called on open and after every successful write. */
  const load = useCallback(async () => {
    setError('')
    try {
      const [c, p] = await Promise.all([api.get(id), contactsApi.list({ companyId: id, pageSize: 100 })])
      setCo(c); setPeople(p.results); setMissing(false)
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setMissing(true); else setError(apiMessage(e))
    } finally { setLoading(false) }
  }, [id])
  useEffect(() => { setLoading(true); void load() }, [load])

  const back = <Link className="back-link" to="/app/companies"><Icon n="arrowL" s={15} />Companies</Link>
  if (loading) return <div className="page">{back}<div className="empty" role="status">Loading…</div></div>
  if (missing) return <div className="page">{back}<div className="empty">Company not found.</div></div>
  if (!co) return <div className="page">{back}<div className="callout amber" role="alert"><i className="dot round" /><span>{error} <button className="link plain" onClick={() => { setLoading(true); void load() }}>Try again</button></span></div></div>
  return (
    <div className="page narrow">
      {back}
      {error && <div className="callout amber" role="alert" style={{ marginBottom: 14 }}><i className="dot round" />{error}</div>}
      <div className="detail-head"><div className="row" style={{ gap: 16 }}><Avatar name={co.name} tint="t-grey" size="lg" /><div><h1>{co.name}</h1><div className="sub">{[co.industry, co.domain].filter(Boolean).join(' · ') || 'No details yet'}</div></div></div>
        <div className="row"><button className="btn" onClick={() => setAddingPerson(true)}><Icon n="plus" s={15} />Add person</button><button className="btn" onClick={() => setEditing(true)}><Icon n="edit" s={15} />Edit</button><button className="btn danger" onClick={() => setDeleting(true)}>Delete</button></div></div>
      <div className="grid-2">
        <div className="card pad"><div className="card-title">About</div><div style={{ marginTop: 14 }}>
          <div className="kv"><span>Domain</span><span className="mono">{co.domain ?? '–'}</span></div>
          <div className="kv"><span>Industry</span><span>{co.industry ?? '–'}</span></div>
          <div className="kv"><span>Size</span><span>{sizeLabel(co.size_range)}</span></div>
          <div className="kv"><span>Owner</span><span>{co.owner.name}</span></div>
          <div className="kv"><span>Open deals</span><span>{co.open_deal_count}</span></div>
          <div className="kv"><span>Open value</span><span className="mono">{openValue(co)}</span></div></div></div>
        <div className="col gap-20">
          <div className="card pad"><div className="card-title">People</div>
            {people.map((p) => <Link key={p.id} to={'/app/contacts/' + p.id} className="sugg-row"><Avatar name={p.name} tint="t-grey" /><div className="grow"><b>{p.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{p.title ?? p.email}</div></div></Link>)}
            {people.length === 0 && <div className="muted" style={{ marginTop: 10 }}>No people yet.</div>}
          </div>
        </div>
      </div>
      {addingPerson && <AddContactLive companyId={co.id} onClose={() => setAddingPerson(false)} onAdded={() => void load()} />}
      {editing && <EditCompany co={co} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await load(); toast('Company saved') }} onReload={async () => { setEditing(false); await load() }} />}
      {deleting && <DeleteCompany co={co} onClose={() => setDeleting(false)} onDeleted={() => { toast(co.name + ' deleted'); nav('/app/companies', { replace: true }) }} />}
    </div>
  )
}

function EditCompany({ co, onClose, onSaved, onReload }: { co: CompanyDto; onClose: () => void; onSaved: () => Promise<void>; onReload: () => Promise<void> }) {
  const { busy, run } = useSubmit()
  const f = useCompanyForm(co)
  const [conflict, setConflict] = useState(false)
  const submit = () => {
    f.setTried(true); f.setSrv({}); f.setMsg(''); setConflict(false)
    if (f.bad) return
    // Send only what changed, with the updated_at that was read. null clears an optional field.
    const body: CompanyInput = {}
    if (clean(f.name) !== co.name) body.name = clean(f.name)
    const dom = f.domain.trim().toLowerCase() || null; if (dom !== co.domain) body.domain = dom
    const ind = clean(f.industry) || null; if (ind !== co.industry) body.industry = ind
    const sz = f.size || null; if (sz !== co.size_range) body.size_range = sz
    if (Object.keys(body).length === 0) { toast('No changes to save'); onClose(); return }
    void run(async () => {
      try { await api.update(co.id, body, co.updated_at); await onSaved() }
      catch (err) {
        if (err instanceof ApiError && err.apiCode === Code.VERSION_CONFLICT) { setConflict(true); f.setMsg(err.message); return }
        const s = serverErrors(err); f.setSrv(s.fields); f.setMsg(s.banner)
      }
    })
  }
  return (
    <Modal title="Edit company" onClose={onClose} foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      {conflict ? <button className="btn primary" disabled={busy} onClick={() => void onReload()}>Reload latest</button>
        : <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save changes'}</button>}</div></>}>
      <CompanyFields f={f} />
    </Modal>
  )
}

function DeleteCompany({ co, onClose, onDeleted }: { co: CompanyDto; onClose: () => void; onDeleted: () => void }) {
  const { busy, run } = useSubmit()
  const [msg, setMsg] = useState('')
  const go = () => void run(async () => {
    setMsg('')
    try { await api.remove(co.id); onDeleted() } catch (err) { setMsg(apiMessage(err)) }
  })
  return (
    <Modal title="Delete company" onClose={onClose} foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn danger" disabled={busy} onClick={go}>{busy ? 'Deleting…' : 'Delete company'}</button></div></>}>
      {msg && <div className="callout amber" role="alert"><i className="dot round" />{msg}</div>}
      <p style={{ margin: 0, lineHeight: 1.6 }}>Delete <b>{co.name}</b>? It disappears from your lists. {co.people_count > 0 ? `The ${co.people_count} ${co.people_count === 1 ? 'person' : 'people'} at this company stay in Contacts.` : ''}</p>
    </Modal>
  )
}
