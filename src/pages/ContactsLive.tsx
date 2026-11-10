/* Contacts against the real API (GET/POST /contacts/, GET/PATCH/DELETE /contacts/{id}/).
   Same rules as CompaniesLive: a change is shown as done only after the server saved it, and then the row is read again.
   An error shows the mapped message and leaves the data as it was. Used when mock mode is off (see Crm.tsx).
   Not shown in real mode: CSV import, export, the opt-out toggle, location, and the Suspended status (the API has none of them). */

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError, Code, apiMessage, fieldMessages } from '../api'
import { companies as companiesApi, contacts as api, type CompanyDto, type ContactDto, type ContactInput } from '../api/crm'
import { Icon } from '../components/Icons'
import { useSubmit } from '../components/guards'
import { Pager, usePaged } from '../components/live'
import { Avatar, Field, Modal, useTitle } from '../components/ui'
import { COUNTRY_CODES, joinPhone, splitPhone } from '../data/phone'
import { LIMITS, clean, emailErr, nameErr, normEmail, phoneErr } from '../data/validate'
import { toast } from '../store'

type Status = '' | 'active' | 'opted_out'
const STATUS_LABEL: Record<'active' | 'opted_out', string> = { active: 'Active', opted_out: 'Opted out' }
const statusEl = (s: 'active' | 'opted_out') => <span className={s === 'active' ? 'st-act' : 'st-act st-opt'}>{STATUS_LABEL[s]}</span>
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '–')

/** Field errors the server found, keyed by our field names, plus a banner when nothing points at a field. */
function serverErrors(err: unknown): { fields: Record<string, string>; banner: string } {
  const f = fieldMessages(err)
  const fields: Record<string, string> = { first: f.first_name ?? '', last: f.last_name ?? '', email: f.email ?? '', phone: f.phone ?? '', title: f.title ?? '', company: f.company_id ?? '' }
  if (err instanceof ApiError && err.apiCode === Code.CONTACT_EMAIL_TAKEN) fields.email = err.message
  return { fields, banner: Object.values(fields).some(Boolean) ? '' : apiMessage(err) }
}

export function ContactsLive() {
  useTitle('Contacts')
  const nav = useNavigate()
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState<Status>('')
  const list = usePaged<ContactDto>(({ q, page, signal }) => api.list({ q, page, signal, status: status || undefined }), status)
  const rows = list.data?.results ?? []
  const count = list.data?.count ?? 0
  const filtered = list.q !== '' || status !== ''
  return (
    <div className="page">
      <div className="page-head"><div><h1 className="h1">Contacts</h1><p className="page-sub">{list.data ? `${count} ${count === 1 ? 'person' : 'people'}.` : 'Loading…'} Opted-out contacts are blocked from every send.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" s={16} w={2.2} />Add contact</button></div>
      <div className="filters">
        <div className="sbox"><Icon n="search" s={16} /><input className="input" type="search" maxLength={LIMITS.search} autoComplete="off" spellCheck={false} aria-label="Search contacts" placeholder="Search name, email, company" value={list.input} onChange={(e) => list.setInput(e.target.value)} /></div>
        <select className="select" value={status} onChange={(e) => { setStatus(e.target.value as Status); list.setPage(1) }} aria-label="Status"><option value="">All statuses</option><option value="active">Active</option><option value="opted_out">Opted out</option></select>
        {list.data && <span className="count">{rows.length} shown</span>}
      </div>
      {list.error && <div className="callout amber" role="alert" style={{ marginBottom: 14 }}><i className="dot round" /><span>{list.error} <button className="link plain" onClick={list.reload}>Try again</button></span></div>}
      <div className="card tbl-scroll"><table className="tbl">
        <thead><tr><th>Name</th><th>Company</th><th>Title</th><th>Owner</th><th>Status</th><th className="r">Last contact</th></tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="click" onClick={() => nav('/app/contacts/' + c.id)}>
              <td><div className="person-cell"><Avatar name={c.name} tint="t-grey" /><div><b>{c.name}</b><span className="mono">{c.email}</span></div></div></td>
              <td>{c.company?.name ?? <span className="faint">None</span>}</td><td>{c.title ?? ''}</td><td>{c.owner.name}</td><td>{statusEl(c.status)}</td><td className="r mono muted">{when(c.last_contact_at)}</td>
            </tr>))}
          {list.data && rows.length === 0 && (
            <tr><td colSpan={6} className="empty">{filtered ? 'No contacts match.' : <>No contacts yet. Add your first one.<div style={{ marginTop: 12 }}><button className="btn primary" onClick={() => setAdding(true)}><Icon n="plus" s={15} w={2.2} />Add contact</button></div></>}</td></tr>)}
          {!list.data && list.loading && <tr><td colSpan={6} className="empty" role="status">Loading…</td></tr>}
        </tbody></table></div>
      <Pager page={list.page} count={count} onPage={list.setPage} />
      {adding && <AddContactLive onClose={() => setAdding(false)} />}
    </div>
  )
}

/* ---------- the form, shared by Add and Edit ---------- */

function useContactForm(start?: ContactDto, companyId = '') {
  const phone0 = splitPhone(start?.phone)
  const [first, setFirst] = useState(start?.first_name ?? ''); const [last, setLast] = useState(start?.last_name ?? '')
  const [email, setEmail] = useState(start?.email ?? ''); const [title, setTitle] = useState(start?.title ?? '')
  const [code, setCode] = useState(phone0.code); const [phone, setPhone] = useState(phone0.national)
  const [co, setCo] = useState(start?.company?.id ?? companyId)
  const [tried, setTried] = useState(false); const [srv, setSrv] = useState<Record<string, string>>({}); const [msg, setMsg] = useState('')
  const e = {
    first: nameErr(first, 'first name', 1, LIMITS.name) || (!/\p{L}/u.test(clean(first)) ? 'Use letters in the name.' : ''),
    last: !clean(last) ? '' : nameErr(last, 'last name', 1, LIMITS.name) || (!/\p{L}/u.test(clean(last)) ? 'Use letters in the name.' : ''),
    email: emailErr(email),
    title: clean(title).length > LIMITS.title ? `Keep the title under ${LIMITS.title} characters.` : '',
    phone: code === '' && phone.trim() && !phone.trim().startsWith('+') ? 'Start the number with + and the country code.' : phoneErr(phone),
  }
  const bad = Object.values(e).some(Boolean)
  const err = (k: keyof typeof e) => (tried ? e[k] : '') || srv[k] || ''
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setSrv({}); setMsg('') }
  return { first, last, email, title, code, phone, co, setFirst: edit(setFirst), setLast: edit(setLast), setEmail: edit(setEmail), setTitle: edit(setTitle), setCode: edit(setCode), setPhone: edit(setPhone), setCo: edit(setCo), tried, setTried, srv, setSrv, msg, setMsg, e, bad, err }
}

function ContactFields({ f, pick, existing }: { f: ReturnType<typeof useContactForm>; pick: { list: CompanyDto[]; error: string; keep?: { id: string; name: string } | null }; existing?: { id: string; name: string } }) {
  const options = pick.keep && !pick.list.some((c) => c.id === pick.keep!.id) ? [{ id: pick.keep.id, name: pick.keep.name }, ...pick.list] : pick.list
  return (<>
    {f.msg && <div className="callout amber" role="alert"><i className="dot round" />{f.msg}</div>}
    <div className="grid-2">
      <Field label="First name" error={f.err('first')}><input className={'input' + (f.err('first') ? ' invalid' : '')} maxLength={LIMITS.name} autoComplete="given-name" value={f.first} onChange={(x) => f.setFirst(x.target.value)} autoFocus /></Field>
      <Field label="Last name" opt error={f.err('last')}><input className={'input' + (f.err('last') ? ' invalid' : '')} maxLength={LIMITS.name} autoComplete="family-name" value={f.last} onChange={(x) => f.setLast(x.target.value)} /></Field>
    </div>
    <Field label="Email" error={f.err('email')}><input className={'input' + (f.err('email') ? ' invalid' : '')} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={LIMITS.email} value={f.email} onChange={(x) => f.setEmail(x.target.value)} onBlur={() => f.setEmail(normEmail(f.email))} />
      {existing && <Link className="link" to={'/app/contacts/' + existing.id} style={{ fontSize: 13 }}>Open {existing.name}</Link>}</Field>
    <div className="grid-2">
      <Field label="Title" opt error={f.err('title')}><input className={'input' + (f.err('title') ? ' invalid' : '')} maxLength={LIMITS.title + 20} value={f.title} onChange={(x) => f.setTitle(x.target.value)} /></Field>
      <Field label="Phone" opt error={f.err('phone')}><div className="phone-row"><select className="select" aria-label="Country code" value={f.code} onChange={(x) => f.setCode(x.target.value)}>{COUNTRY_CODES.map((c) => <option key={c}>{c}</option>)}<option value="">Other (type +code)</option></select><input className={'input' + (f.err('phone') ? ' invalid' : '')} type="tel" inputMode="tel" autoComplete="tel-national" maxLength={LIMITS.phone} value={f.phone} onChange={(x) => f.setPhone(x.target.value)} /></div></Field>
    </div>
    <Field label="Company" opt error={f.srv.company || pick.error}><select className="select" value={f.co} onChange={(x) => f.setCo(x.target.value)}><option value="">None</option>{options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
  </>)
}

/** The first 100 companies by name, for the picker. */
function useCompanyPicker() {
  const [list, setList] = useState<CompanyDto[]>([]); const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    companiesApi.list({ pageSize: 100 }).then((r) => { if (live) setList(r.results) }).catch((e) => { if (live) setError(apiMessage(e)) })
    return () => { live = false }
  }, [])
  return { list, error }
}

export function AddContactLive({ onClose, companyId = '', onAdded }: { onClose: () => void; companyId?: string; onAdded?: () => void }) {
  const nav = useNavigate()
  const { busy, run } = useSubmit()
  const f = useContactForm(undefined, companyId)
  const pick = useCompanyPicker()
  const [existing, setExisting] = useState<{ id: string; name: string } | undefined>()
  const submit = () => {
    f.setTried(true); f.setSrv({}); f.setMsg(''); setExisting(undefined)
    if (f.bad) return
    const body: ContactInput = { first_name: clean(f.first), email: normEmail(f.email) }
    if (clean(f.last)) body.last_name = clean(f.last)
    if (clean(f.title)) body.title = clean(f.title)
    if (f.phone.trim()) body.phone = joinPhone(f.code, f.phone)
    if (f.co) body.company_id = f.co
    void run(async () => {
      try {
        const c = await api.create(body)
        toast(c.name + ' added'); onClose()
        if (onAdded) onAdded(); else nav('/app/contacts/' + c.id) // the detail page reads the row from the server
      } catch (err) {
        const s = serverErrors(err); f.setSrv(s.fields); f.setMsg(s.banner)
        if (err instanceof ApiError && err.existing) setExisting(err.existing)
      }
    })
  }
  return (
    <Modal title="Add contact" onClose={onClose} wide foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Adding…' : 'Add contact'}</button></div></>}>
      <ContactFields f={f} pick={pick} existing={existing} />
    </Modal>
  )
}

/* ---------- detail ---------- */

export function ContactDetailLive() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [c, setC] = useState<ContactDto | null>(null)
  const [error, setError] = useState(''); const [missing, setMissing] = useState(false); const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false); const [deleting, setDeleting] = useState(false)
  useTitle(c?.name ?? 'Contact')

  /** Reads the contact from the server. Called on open and after every successful write. */
  const load = useCallback(async () => {
    setError('')
    try { setC(await api.get(id)); setMissing(false) }
    catch (e) { if (e instanceof ApiError && e.status === 404) setMissing(true); else setError(apiMessage(e)) }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { setLoading(true); void load() }, [load])

  const back = <Link className="back-link" to="/app/contacts"><Icon n="arrowL" s={15} />Contacts</Link>
  if (loading) return <div className="page">{back}<div className="empty" role="status">Loading…</div></div>
  if (missing) return <div className="page">{back}<div className="empty">Contact not found.</div></div>
  if (!c) return <div className="page">{back}<div className="callout amber" role="alert"><i className="dot round" /><span>{error} <button className="link plain" onClick={() => { setLoading(true); void load() }}>Try again</button></span></div></div>
  return (
    <div className="page narrow">
      {back}
      {error && <div className="callout amber" role="alert" style={{ marginBottom: 14 }}><i className="dot round" />{error}</div>}
      <div className="detail-head">
        <div className="row" style={{ gap: 16 }}><Avatar name={c.name} tint="t-grey" size="lg" /><div><h1>{c.name}</h1><div className="sub">{c.title}{c.title && c.company && ' at '}{c.company && <Link className="link" to={'/app/companies/' + c.company.id}>{c.company.name}</Link>}{!c.title && !c.company && c.email}</div></div></div>
        <div className="row"><button className="btn" onClick={() => setEditing(true)}><Icon n="edit" s={15} />Edit</button><button className="btn danger" onClick={() => setDeleting(true)}>Delete</button></div>
      </div>
      {c.status === 'opted_out' && <div className="callout amber" style={{ marginBottom: 20 }}><i className="dot round" /><span>This person opted out. Nudge blocks every send, including approved drafts.</span></div>}
      <div className="card pad" style={{ maxWidth: 560 }}><div className="card-title">Profile</div>
        <div style={{ marginTop: 14 }}>
          <div className="kv"><span>Email</span><span className="mono">{c.email}</span></div>
          <div className="kv"><span>Phone</span><span>{c.phone ?? '–'}</span></div>
          <div className="kv"><span>Title</span><span>{c.title ?? '–'}</span></div>
          <div className="kv"><span>Company</span><span>{c.company ? <Link className="link" to={'/app/companies/' + c.company.id}>{c.company.name}</Link> : '–'}</span></div>
          <div className="kv"><span>Owner</span><span>{c.owner.name}</span></div>
          <div className="kv"><span>Status</span><span>{statusEl(c.status)}</span></div>
          <div className="kv"><span>Last contact</span><span>{when(c.last_contact_at)}</span></div>
          <div className="kv"><span>Added</span><span>{when(c.created_at)}</span></div>
        </div></div>
      {editing && <EditContact c={c} onClose={() => setEditing(false)} onSaved={async () => { setEditing(false); await load(); toast('Contact saved') }} onReload={async () => { setEditing(false); await load() }} />}
      {deleting && <DeleteContact c={c} onClose={() => setDeleting(false)} onDeleted={() => { toast(c.name + ' deleted'); nav('/app/contacts', { replace: true }) }} />}
    </div>
  )
}

function EditContact({ c, onClose, onSaved, onReload }: { c: ContactDto; onClose: () => void; onSaved: () => Promise<void>; onReload: () => Promise<void> }) {
  const { busy, run } = useSubmit()
  const f = useContactForm(c)
  const pick = useCompanyPicker()
  const [conflict, setConflict] = useState(false); const [existing, setExisting] = useState<{ id: string; name: string } | undefined>()
  const submit = () => {
    f.setTried(true); f.setSrv({}); f.setMsg(''); setConflict(false); setExisting(undefined)
    if (f.bad) return
    // Only what changed, with the updated_at that was read. null clears an optional field.
    const body: ContactInput = {}
    if (clean(f.first) !== c.first_name) body.first_name = clean(f.first)
    const last = clean(f.last) || null; if (last !== (c.last_name || null)) body.last_name = last
    if (normEmail(f.email) !== c.email) body.email = normEmail(f.email)
    const title = clean(f.title) || null; if (title !== (c.title || null)) body.title = title
    const phone = f.phone.trim() ? joinPhone(f.code, f.phone) : null; if (phone !== (c.phone || null)) body.phone = phone
    const co = f.co || null; if (co !== (c.company?.id ?? null)) body.company_id = co
    if (Object.keys(body).length === 0) { toast('No changes to save'); onClose(); return }
    void run(async () => {
      try { await api.update(c.id, body, c.updated_at); await onSaved() }
      catch (err) {
        if (err instanceof ApiError && err.apiCode === Code.VERSION_CONFLICT) { setConflict(true); f.setMsg(err.message); return }
        const s = serverErrors(err); f.setSrv(s.fields); f.setMsg(s.banner)
        if (err instanceof ApiError && err.existing) setExisting(err.existing)
      }
    })
  }
  return (
    <Modal title="Edit contact" onClose={onClose} wide foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      {conflict ? <button className="btn primary" disabled={busy} onClick={() => void onReload()}>Reload latest</button>
        : <button className="btn primary" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Save changes'}</button>}</div></>}>
      <ContactFields f={f} pick={{ ...pick, keep: c.company }} existing={existing} />
    </Modal>
  )
}

function DeleteContact({ c, onClose, onDeleted }: { c: ContactDto; onClose: () => void; onDeleted: () => void }) {
  const { busy, run } = useSubmit()
  const [msg, setMsg] = useState('')
  const go = () => void run(async () => {
    setMsg('')
    try { await api.remove(c.id); onDeleted() } catch (err) { setMsg(apiMessage(err)) }
  })
  return (
    <Modal title="Delete contact" onClose={onClose} foot={<><span /><div className="row"><button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn danger" disabled={busy} onClick={go}>{busy ? 'Deleting…' : 'Delete contact'}</button></div></>}>
      {msg && <div className="callout amber" role="alert"><i className="dot round" />{msg}</div>}
      <p style={{ margin: 0, lineHeight: 1.6 }}>Delete <b>{c.name}</b>? They disappear from your lists.</p>
    </Modal>
  )
}
