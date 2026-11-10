/* Companies and contacts: GET/POST /companies/, /companies/{id}/, GET/POST /contacts/, /contacts/{id}/ (API_CONTRACT sections 4).
   Every write resolves only after the server has saved it; screens then read the row again from the API.
   Real mode only. Mock mode keeps using the in-memory store through the old screens. */

import { ApiError, MESSAGES, request } from './client'

export type SizeRange = '1-10' | '11-50' | '51-200' | '201-500' | '500+'
export const SIZE_RANGES: ReadonlyArray<SizeRange> = ['1-10', '11-50', '51-200', '201-500', '500+']

export interface Page<T> { count: number; next: string | null; previous: string | null; results: T[] }
export interface Money { currency: string; amount: string }
export interface PersonRef { id: string; name: string }

export interface CompanyDto {
  id: string; name: string; domain: string | null; industry: string | null; size_range: SizeRange | null
  owner: PersonRef; visibility: string; team_id: string | null
  people_count: number; open_deal_count: number; open_value: Money[]
  created_at: string; updated_at: string
}
export interface CompanyInput { name?: string; domain?: string | null; industry?: string | null; size_range?: SizeRange | null }

export interface ContactDto {
  id: string; first_name: string; last_name: string | null; name: string; email: string; phone: string | null; title: string | null
  company: PersonRef | null; owner: PersonRef; visibility: string; team_id: string | null
  status: 'active' | 'opted_out'; opted_out_at: string | null; source: string; last_contact_at: string | null
  created_at: string; updated_at: string
}
export interface ContactInput { first_name?: string; last_name?: string | null; email?: string; phone?: string | null; title?: string | null; company_id?: string | null }

export interface ListQuery { q?: string; page?: number; pageSize?: number; companyId?: string; status?: 'active' | 'opted_out'; signal?: AbortSignal }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Ids come from the URL, so they are checked before they go into a path. A bad id is a plain "not found". */
function idPath(base: string, id: string): string {
  if (!UUID.test(id)) throw new ApiError(404, 'not_found', MESSAGES.not_found)
  return `${base}${id}/`
}

function query(q: ListQuery): string {
  const p: string[] = []
  const term = (q.q ?? '').trim()
  if (term.length >= 2) p.push('q=' + encodeURIComponent(term)) // the API refuses a search shorter than 2 characters
  if (q.page && q.page > 1) p.push('page=' + q.page)
  p.push('page_size=' + (q.pageSize ?? 25))
  if (q.companyId) p.push('company_id=' + encodeURIComponent(q.companyId))
  if (q.status) p.push('status=' + q.status)
  return '?' + p.join('&')
}

export const companies = {
  list: (q: ListQuery = {}) => request<Page<CompanyDto>>('/companies/' + query(q), { signal: q.signal }),
  get: (id: string) => request<CompanyDto>(idPath('/companies/', id)),
  create: (input: CompanyInput) => request<CompanyDto>('/companies/', { method: 'POST', body: input }),
  /** `updatedAt` is the value read with the row; the server answers 409 if it has changed since. */
  update: (id: string, input: CompanyInput, updatedAt: string) => request<CompanyDto>(idPath('/companies/', id), { method: 'PATCH', body: { ...input, updated_at: updatedAt } }),
  remove: (id: string) => request<null>(idPath('/companies/', id), { method: 'DELETE' }),
}

export const contacts = {
  list: (q: ListQuery = {}) => request<Page<ContactDto>>('/contacts/' + query(q), { signal: q.signal }),
  get: (id: string) => request<ContactDto>(idPath('/contacts/', id)),
  create: (input: ContactInput) => request<ContactDto>('/contacts/', { method: 'POST', body: input }),
  update: (id: string, input: ContactInput, updatedAt: string) => request<ContactDto>(idPath('/contacts/', id), { method: 'PATCH', body: { ...input, updated_at: updatedAt } }),
  remove: (id: string) => request<null>(idPath('/contacts/', id), { method: 'DELETE' }),
}

/** "18000.00" + "USD" -> "$18,000.00". An unknown currency code falls back to plain text. */
export function formatMoney(amount: string, currency: string): string {
  const n = Number(amount)
  try { return new Intl.NumberFormat('en', { style: 'currency', currency }).format(n) } catch { return `${currency} ${amount}` }
}
