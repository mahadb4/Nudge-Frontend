import { useSyncExternalStore } from 'react'
import * as seed from './data/seed'
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
  user: { name: string; email: string; type: 'Individual' | 'Business'; verified: boolean } | null
  deals: Deal[]; contacts: Contact[]; companies: Company[]; reviews: ReviewItem[]; followups: Followup[]
  threads: Thread[]; templates: Template[]; facts: Fact[]; mailboxes: Mailbox[]; members: Member[]; audit: AuditRow[]
  events: typeof seed.events
  settings: Settings; toasts: Toast[]; approvedToday: { name: string; type: ReplyType; at: string }[]
  askOpen: boolean; cmdOpen: boolean; newEmailOpen: boolean; navOpen: boolean
}

const savedTheme = (() => { try { return (localStorage.getItem('nudge.theme') as Theme) || 'light' } catch { return 'light' as Theme } })()

let state: State = {
  user: { name: 'Mahad Baig', email: 'mahad@acme.co', type: 'Business', verified: true },
  deals: seed.deals, contacts: seed.contacts, companies: seed.companies, reviews: seed.reviews, followups: seed.followups,
  threads: seed.threads, templates: seed.templates, facts: seed.facts, mailboxes: seed.mailboxes, members: seed.members, audit: seed.audit,
  events: seed.events,
  settings: {
    theme: savedTheme, mode: 'draft', approvals: 32, threshold: 85, quietOn: true, quietFrom: '8:00 PM', quietTo: '8:00 AM', tz: 'Asia/Karachi',
    notif: { review: true, followup: true, meeting: true, digest: false, mailbox: true }, ints: { google: true, microsoft: true, calendar: true, slack: false, hubspot: false, webhooks: false },
    twoFA: false, dealStages: seed.STAGES.map((s) => s.label),
  },
  toasts: [], approvedToday: [], askOpen: false, cmdOpen: false, newEmailOpen: false, navOpen: false,
}
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
export const setSettings = (p: Partial<Settings>) => setState((s) => ({ settings: { ...s.settings, ...p } }))

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
export function setReviewDraft(id: string, draft: string) { setState((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, draft } : r)) })) }
export function setReviewType(id: string, type: ReplyType) { setState((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, type } : r)) })) }
export function toggleAction(id: string, aid: string) {
  setState((s) => ({ reviews: s.reviews.map((r) => (r.id === id ? { ...r, actions: r.actions.map((a) => (a.id === aid ? { ...a, on: !a.on } : a)) } : r)) }))
}
export function approveReview(id: string) {
  const r = getState().reviews.find((x) => x.id === id)
  if (!r) return
  const c = getState().contacts.find((x) => x.id === r.contactId)!
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
  setState((s) => ({ followups: s.followups.map((f) => (f.id === id ? { ...f, done: true, draft } : f)) }))
  toast('Follow-up approved and queued')
}
export function sendNewEmail(to: string, subject: string) {
  const c = getState().contacts.find((x) => x.email.toLowerCase() === to.toLowerCase())
  toast('Email queued to ' + (c?.name ?? to) + ': ' + subject)
  logAudit('Sent new email', c?.name ?? to)
}

export function patch<K extends 'templates' | 'facts' | 'mailboxes' | 'members'>(key: K, fn: (arr: State[K]) => State[K]) {
  setState((s) => ({ [key]: fn(s[key]) }) as Partial<State>)
}
