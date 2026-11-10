import { useSyncExternalStore } from 'react'
import * as seed from './data/seed'
import { LIMITS, cleanMulti, normEmail } from './data/validate'
import type { Deal, Contact, Company, ReviewItem, Followup, Thread, Template, Fact, Mailbox, Member, AuditRow, Stage, ReplyType } from './data/seed'

export type Theme = 'light' | 'dark' | 'system'
export interface Toast { id: number; text: string; undo?: () => void }
export interface Settings {
  theme: Theme; mode: 'draft' | 'auto'; approvals: number; threshold: number
  quietOn: boolean; quietFrom: string; quietTo: string; tz: string
  notif: Record<string, boolean>; ints: Record<string, boolean>; twoFA: boolean
  dealStages: string[]
}
export interface State {
  user: User | null
  deals: Deal[]; contacts: Contact[]; companies: Company[]; reviews: ReviewItem[]; followups: Followup[]
  threads: Thread[]; templates: Template[]; facts: Fact[]; mailboxes: Mailbox[]; members: Member[]; audit: AuditRow[]
  events: typeof seed.events
  settings: Settings; toasts: Toast[]; approvedToday: { name: string; type: ReplyType; at: string }[]
  askOpen: boolean; cmdOpen: boolean; newEmailOpen: boolean; navOpen: boolean
}

const isTheme = (v: unknown): v is Theme => v === 'light' || v === 'dark' || v === 'system'
const savedTheme: Theme = (() => { try { const t = localStorage.getItem('nudge.theme'); return isTheme(t) ? t : 'light' } catch { return 'light' } })()

export type User = { name: string; email: string; type: 'individual' | 'business'; verified: boolean }

const defaultSettings = (theme: Theme): Settings => ({
  theme, mode: 'draft', approvals: 32, threshold: 85, quietOn: true, quietFrom: '8:00 PM', quietTo: '8:00 AM', tz: 'Asia/Karachi',
  notif: { review: true, followup: true, meeting: true, digest: false, mailbox: true }, ints: { google: true, microsoft: true, calendar: true, slack: false, hubspot: false, webhooks: false },
  twoFA: false, dealStages: seed.STAGES.map((s) => s.label),
})

/** Nothing private. The store is this until someone signs in, and again after sign-out. */
const blank = (theme: Theme): State => ({
  user: null, deals: [], contacts: [], companies: [], reviews: [], followups: [], threads: [], templates: [], facts: [], mailboxes: [], members: [], audit: [],
  events: [], settings: defaultSettings(theme), toasts: [], approvedToday: [], askOpen: false, cmdOpen: false, newEmailOpen: false, navOpen: false,
})

let state: State = blank(savedTheme)
const subs = new Set<() => void>()
export const getState = () => state
export function setState(fn: (s: State) => Partial<State>) {
  state = { ...state, ...fn(state) }
  subs.forEach((f) => f())
}
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb) } }, () => sel(state), () => sel(state))
}

export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
}
export function setTheme(t: Theme) {
  try { localStorage.setItem('nudge.theme', t) } catch { /* ignore */ }
  applyTheme(t)
  setSettings({ theme: t })
}
export const setSettings = (p: Partial<Settings>) => setState((s) => {
  const next = { ...s.settings, ...p }
  if (p.threshold !== undefined) next.threshold = Number.isFinite(p.threshold) ? Math.min(99, Math.max(60, Math.round(p.threshold))) : s.settings.threshold
  return { settings: next }
})

let tid = 1
export function toast(text: string, undo?: () => void) {
  const id = tid++
  setState((s) => ({ toasts: [...s.toasts, { id, text, undo }] }))
  setTimeout(() => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), undo ? 7000 : 3500)
}
export const dismissToast = (id: number) => setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))

let uid = 100
export const nid = (p: string) => p + uid++
export const logAudit = (action: string, on: string, who = 'Mahad Baig') =>
  setState((s) => ({ audit: [{ id: nid('au'), time: 'Just now', who, ini: who === 'Nudge' ? 'N' : 'MB', tint: who === 'Nudge' ? 't-grey' : 't-blue', action, on }, ...s.audit] }))

/* ---- deals ---- */
export function moveDeal(id: string, stage: Stage, lostReason?: string) {
  setState((s) => ({ deals: s.deals.map((d) => (d.id === id ? { ...d, stage, waiting: stage === 'won' || stage === 'lost' ? false : d.waiting, lostReason: stage === 'lost' ? lostReason ?? d.lostReason ?? 'Not given' : undefined } : d)) }))
  const d = getState().deals.find((x) => x.id === id)
  if (d) logAudit('Moved deal to ' + seed.stageLabel(stage), d.name)
}
export function addDeal(d: Omit<Deal, 'id' | 'created'>) {
  const deal: Deal = { ...d, id: nid('d'), created: 'Today' }
  setState((s) => ({ deals: [deal, ...s.deals] }))
  logAudit('Created deal', deal.name)
  return deal
}
export function updateDeal(id: string, p: Partial<Deal>) { setState((s) => ({ deals: s.deals.map((d) => (d.id === id ? { ...d, ...p } : d)) })) }

/* ---- contacts / companies ---- */
export function addContact(c: Omit<Contact, 'id' | 'last' | 'tint' | 'status'>) {
  const k: Contact = { ...c, id: nid('p'), last: 'Never', status: 'Active', tint: seed.TINTS[Math.floor(Math.random() * seed.TINTS.length)] }
  setState((s) => ({ contacts: [k, ...s.contacts] }))
  logAudit('Added contact', k.name)
  return k
}
export function addCompany(c: Omit<Company, 'id'>) {
  const k: Company = { ...c, id: nid('c') }
  setState((s) => ({ companies: [k, ...s.companies] }))
  logAudit('Added company', k.name)
  return k
}

/* ---- review ---- */
export function setReviewDraft(id: string, draft: string) { const d = cleanMulti(draft + '.').slice(0, -1).slice(0, LIMITS.body + 1); setState((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, draft: d } : r)) })) }
export function setReviewType(id: string, type: ReplyType) { setState((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, type } : r)) })) }
export function toggleAction(id: string, aid: string) {
  setState((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, actions: r.actions.map((a) => (a.id === aid ? { ...a, on: !a.on } : a)) } : r)) }))
}
export function approveReview(id: string) {
  const r = getState().reviews.find((x) => x.id === id)
  if (!r) return
  if (r.status !== 'pending') return
  const c = getState().contacts.find((x) => x.id === r.contactId)!
  if (c.status !== 'Active') { toast(c.name + ' is ' + c.status.toLowerCase() + '. Nudge will not send to them.'); return }
  if (!r.draft.trim()) { toast('The draft is empty. Write a reply before approving.'); return }
  if (r.draft.length > LIMITS.body) { toast('The draft is over ' + LIMITS.body + ' characters. Shorten it first.'); return }
  const prev = r.status
  const doneActions = r.actions.filter((a) => a.on)
  // effects
  if (doneActions.some((a) => /Move .* to Meeting scheduled/.test(a.label))) moveDeal(r.dealId, 'meeting')
  if (doneActions.some((a) => /Move .* to Contacted/.test(a.label))) moveDeal(r.dealId, 'contacted')
  if (doneActions.some((a) => /Set follow-up/.test(a.label))) toast('Follow-up set for 1 Apr 2027')
  if (doneActions.some((a) => /Add Omar/.test(a.label))) addContact({ name: 'Omar Siddiqui', email: 'omar@brightpath.io', title: 'Operations', companyId: c.companyId, phone: '', location: 'Austin, US', owner: 'Mahad Baig' })
  if (doneActions.some((a) => /Add Lena/.test(a.label))) addContact({ name: 'Lena Fox', email: 'lena@northwind.com', title: 'Ops Lead', companyId: c.companyId, phone: '', location: 'Chicago, US', owner: 'Mahad Baig' })
  setState((s) => ({
    reviews: s.reviews.map((x) => (x.id === id ? { ...x, status: 'approved' } : x)),
    threads: s.threads.map((t) => (t.contactId === r.contactId && t.status === 'waiting' ? { ...t, status: 'done' } : t)),
    settings: { ...s.settings, approvals: s.settings.approvals + 1 },
    approvedToday: [{ name: c.name, type: r.type, at: 'Just now' }, ...s.approvedToday],
    deals: s.deals.map((d) => (d.id === r.dealId ? { ...d, waiting: false } : d)),
  }))
  logAudit('Approved reply', c.name + ', ' + (getState().companies.find((x) => x.id === c.companyId)?.name ?? ''))
  toast('Approved and queued for ' + c.name.split(' ')[0] + '. Undo within 7 days.', () => {
    setState((s) => ({ reviews: s.reviews.map((x) => (x.id === id ? { ...x, status: prev } : x)), settings: { ...s.settings, approvals: s.settings.approvals - 1 }, approvedToday: s.approvedToday.slice(1) }))
    toast('Approval undone')
  })
}
export function rejectReview(id: string, reason: string) {
  const r = getState().reviews.find((x) => x.id === id)!
  const c = getState().contacts.find((x) => x.id === r.contactId)!
  setState((s) => ({ reviews: s.reviews.map((x) => (x.id === id ? { ...x, status: 'rejected' } : x)) }))
  logAudit('Rejected draft (' + reason + ')', c.name)
  toast('Draft rejected. Nudge will learn from "' + reason + '".')
}
export function skipReview(id: string) { setState((s) => ({ reviews: s.reviews.map((x) => (x.id === id ? { ...x, status: 'skipped' } : x)) })) }
export function resetReviews() { setState((s) => ({ reviews: s.reviews.map((r) => ({ ...r, status: 'pending' })) })) }

export function sendFollowup(id: string, draft: string) {
  if (!draft.trim() || draft.length > LIMITS.body) { toast('The draft must be between 1 and ' + LIMITS.body + ' characters.'); return }
  if (getState().followups.find((f) => f.id === id)?.done) return
  setState((s) => ({ followups: s.followups.map((f) => (f.id === id ? { ...f, done: true, draft } : f)) }))
  toast('Follow-up approved and queued')
}
export function sendNewEmail(to: string, subject: string) {
  const c = getState().contacts.find((x) => normEmail(x.email) === normEmail(to))
  if (c && c.status !== 'Active') { toast(c.name + ' is ' + c.status.toLowerCase() + '. Nothing was queued.'); return }
  toast('Email queued to ' + (c?.name ?? to) + ': ' + subject)
  logAudit('Sent new email', c?.name ?? to)
}

export function patch<K extends 'templates' | 'facts' | 'mailboxes' | 'members'>(key: K, fn: (arr: State[K]) => State[K]) {
  setState((s) => ({ [key]: fn(s[key]) }) as Partial<State>)
}

/* ---- session: the in-memory half. The real session is the httpOnly cookie held by the API. ---- */
const copy = <T,>(v: T): T => structuredClone(v)

/** Load the workspace after a successful sign-in. Mock data now; one API call later. */
export function hydrateWorkspace(user: User) {
  setState((s) => ({
    ...blank(s.settings.theme), user,
    deals: copy(seed.deals), contacts: copy(seed.contacts), companies: copy(seed.companies), reviews: copy(seed.reviews), followups: copy(seed.followups),
    threads: copy(seed.threads), templates: copy(seed.templates), facts: copy(seed.facts), mailboxes: copy(seed.mailboxes), members: copy(seed.members), audit: copy(seed.audit),
    events: copy(seed.events),
  }))
}
/** Sign-out and 401: drop every private record from memory. Only the theme survives. */
export function clearWorkspace() { setState((s) => blank(s.settings.theme)) }
export const hasSession = () => getState().user !== null
