export type ReplyType = 'meeting' | 'pricing' | 'objection' | 'defer' | 'referral' | 'notinterested' | 'optout' | 'ooo' | 'unclear'
export const REPLY_TYPES: { id: ReplyType; label: string }[] = [
  { id: 'meeting', label: 'Meeting request' },
  { id: 'pricing', label: 'Pricing question' },
  { id: 'objection', label: 'Objection' },
  { id: 'defer', label: 'Defer' },
  { id: 'referral', label: 'Referral' },
  { id: 'notinterested', label: 'Not interested' },
  { id: 'optout', label: 'Opt-out' },
  { id: 'ooo', label: 'Out of office' },
  { id: 'unclear', label: 'Unclear' },
]
export const rtLabel = (t: ReplyType) => REPLY_TYPES.find((r) => r.id === t)!.label

export type Stage = 'new' | 'contacted' | 'meeting' | 'proposal' | 'negotiation' | 'won' | 'lost'
export const STAGES: { id: Stage; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'meeting', label: 'Meeting scheduled' },
  { id: 'proposal', label: 'Proposal' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won' },
  { id: 'lost', label: 'Lost' },
]
export const stageLabel = (s: Stage) => STAGES.find((x) => x.id === s)!.label

export type Currency = 'USD' | 'PKR'
export const money = (n: number, c: Currency = 'USD') =>
  c === 'USD' ? '$' + n.toLocaleString('en-US') : 'PKR ' + n.toLocaleString('en-US')

export interface Person { id: string; name: string; initials: string; tint: string; email: string; role: string }
export const TINTS = ['t-pink', 't-lav', 't-mint', 't-blue', 't-peach', 't-teal']

export interface Company { id: string; name: string; domain: string; industry: string; size: string; location: string; owner: string; website: string }
export interface Contact {
  id: string; name: string; email: string; title: string; companyId: string | null; phone: string
  status: 'Active' | 'Opted out' | 'Suspended'; tint: string; last: string; location: string; owner: string
}
export interface Deal {
  id: string; name: string; companyId: string | null; contactId: string | null; amount: number; currency: Currency
  stage: Stage; owner: string; close: string; waiting?: boolean; lostReason?: string; note?: string; created: string
}
export interface Thread {
  id: string; contactId: string; subject: string; preview: string; time: string; status: 'waiting' | 'done' | 'none'
  replyType: ReplyType; confidence: number; dealId: string | null; mailbox: string; messages: { from: 'them' | 'me'; name: string; time: string; text: string }[]
}
export interface ReviewItem {
  id: string; contactId: string; dealId: string; subject: string; time: string; received: string; type: ReplyType; confidence: number
  paragraphs: string[]; evidence: number; why: string; facts: [string, string][]; actions: { id: string; label: string; on: boolean }[]
  draft: string; usedFacts: string[]; status: 'pending' | 'approved' | 'rejected' | 'skipped'
}
export interface Followup { id: string; contactId: string; title: string; sub: string; due: string; draft: string; done: boolean }
export interface CalEvent { id: string; day: string; date: string; time: string; dur: string; title: string; sub: string; contactId: string; kind: 'meeting' | 'hold' }
export interface Template { id: string; name: string; type: ReplyType; uses: number; body: string; updated: string }
export interface Fact { id: string; key: string; value: string; on: boolean; by: string; when: string }
export interface Mailbox { id: string; email: string; provider: 'Google' | 'Microsoft'; status: 'ok' | 'expired'; sync: string; owner: string }
export interface Member { id: string; name: string; initials: string; tint: string; email: string; role: 'Owner' | 'Admin' | 'Member'; team: string; last: string; status: 'Active' | 'Invited' }
export interface AuditRow { id: string; time: string; who: string; action: string; on: string; tint: string; ini: string }

export const ME: Person = { id: 'me', name: 'Mahad Baig', initials: 'MB', tint: 't-blue', email: 'mahad@acme.co', role: 'Owner' }

export const companies: Company[] = [
  { id: 'c1', name: 'Northwind Traders', domain: 'northwind.com', industry: 'Wholesale', size: '201–500', location: 'Chicago, US', owner: 'Mahad Baig', website: 'northwind.com' },
  { id: 'c2', name: 'Orbit Logistics', domain: 'orbitlogistics.com', industry: 'Logistics', size: '51–200', location: 'Rotterdam, NL', owner: 'Sana Iqbal', website: 'orbitlogistics.com' },
  { id: 'c3', name: 'Brightpath', domain: 'brightpath.io', industry: 'Education', size: '11–50', location: 'Austin, US', owner: 'Mahad Baig', website: 'brightpath.io' },
  { id: 'c4', name: 'Halden Group', domain: 'halden.com', industry: 'Manufacturing', size: '501–1000', location: 'Oslo, NO', owner: 'Mahad Baig', website: 'halden.com' },
  { id: 'c5', name: 'Vertex Labs', domain: 'vertexlabs.co', industry: 'Software', size: '51–200', location: 'Toronto, CA', owner: 'Zain Ahmed', website: 'vertexlabs.co' },
  { id: 'c6', name: 'Kestrel Aerospace', domain: 'kestrel.aero', industry: 'Aerospace', size: '501–1000', location: 'Seattle, US', owner: 'Sana Iqbal', website: 'kestrel.aero' },
  { id: 'c7', name: 'Meridian Retail', domain: 'meridianretail.com', industry: 'Retail', size: '1001+', location: 'London, UK', owner: 'Hira Malik', website: 'meridianretail.com' },
  { id: 'c8', name: 'Lumen Health', domain: 'lumenhealth.org', industry: 'Healthcare', size: '51–200', location: 'Boston, US', owner: 'Zain Ahmed', website: 'lumenhealth.org' },
  { id: 'c9', name: 'Atlas Freight', domain: 'atlasfreight.com', industry: 'Logistics', size: '201–500', location: 'Dubai, AE', owner: 'Mahad Baig', website: 'atlasfreight.com' },
  { id: 'c10', name: 'Pioneer Foods', domain: 'pioneerfoods.com', industry: 'Food & beverage', size: '201–500', location: 'Karachi, PK', owner: 'Hira Malik', website: 'pioneerfoods.com' },
]

export const contacts: Contact[] = [
  { id: 'p1', name: 'Sara Ali', email: 'sara@northwind.com', title: 'Head of Operations', companyId: 'c1', phone: '+1 312 555 0142', status: 'Active', tint: 't-pink', last: '2 min ago', location: 'Chicago, US', owner: 'Mahad Baig' },
  { id: 'p2', name: 'Nina Williams', email: 'nina@orbitlogistics.com', title: 'COO', companyId: 'c2', phone: '+31 10 555 0188', status: 'Active', tint: 't-lav', last: '1 hr ago', location: 'Rotterdam, NL', owner: 'Sana Iqbal' },
  { id: 'p3', name: 'Jonathan Lee', email: 'jonathan@halden.com', title: 'Procurement Lead', companyId: 'c4', phone: '+47 22 555 0120', status: 'Active', tint: 't-mint', last: '3 hr ago', location: 'Oslo, NO', owner: 'Mahad Baig' },
  { id: 'p4', name: 'Maya Patel', email: 'maya@vertexlabs.co', title: 'VP Engineering', companyId: 'c5', phone: '+1 416 555 0177', status: 'Active', tint: 't-peach', last: 'Yesterday', location: 'Toronto, CA', owner: 'Zain Ahmed' },
  { id: 'p5', name: 'Daniel Reed', email: 'daniel@brightpath.io', title: 'Founder', companyId: 'c3', phone: '+1 512 555 0109', status: 'Active', tint: 't-blue', last: 'Yesterday', location: 'Austin, US', owner: 'Mahad Baig' },
  { id: 'p6', name: 'Priya Nair', email: 'priya@kestrel.aero', title: 'Director of Fleet IT', companyId: 'c6', phone: '+1 206 555 0163', status: 'Active', tint: 't-teal', last: '2 days ago', location: 'Seattle, US', owner: 'Sana Iqbal' },
  { id: 'p7', name: 'Tom Becker', email: 'tom@meridianretail.com', title: 'Head of CX', companyId: 'c7', phone: '+44 20 555 0131', status: 'Active', tint: 't-grey', last: '3 weeks ago', location: 'London, UK', owner: 'Hira Malik' },
  { id: 'p8', name: 'Elena Rossi', email: 'elena@lumenhealth.org', title: 'Practice Manager', companyId: 'c8', phone: '+1 617 555 0150', status: 'Active', tint: 't-pink', last: '4 days ago', location: 'Boston, US', owner: 'Zain Ahmed' },
  { id: 'p9', name: 'Chris Doyle', email: 'chris@atlasfreight.com', title: 'Fleet Manager', companyId: 'c9', phone: '+971 4 555 0102', status: 'Active', tint: 't-lav', last: '5 days ago', location: 'Dubai, AE', owner: 'Mahad Baig' },
  { id: 'p10', name: 'Mei Tan', email: 'mei@pioneerfoods.com', title: 'Supply Chain Lead', companyId: 'c10', phone: '+92 21 555 0144', status: 'Active', tint: 't-mint', last: '1 week ago', location: 'Karachi, PK', owner: 'Hira Malik' },
  { id: 'p11', name: 'Hassan Raza', email: 'hassan@karachidealers.pk', title: 'Owner', companyId: null, phone: '+92 300 555 0188', status: 'Opted out', tint: 't-peach', last: '2 weeks ago', location: 'Karachi, PK', owner: 'Hira Malik' },
  { id: 'p12', name: 'Ayesha Khan', email: 'ayesha@lahoredealers.pk', title: 'Director', companyId: null, phone: '+92 301 555 0199', status: 'Active', tint: 't-blue', last: '1 week ago', location: 'Lahore, PK', owner: 'Hira Malik' },
]

export const deals: Deal[] = [
  { id: 'd1', name: 'Brightpath Pilot', companyId: 'c3', contactId: 'p5', amount: 18000, currency: 'USD', stage: 'new', owner: 'Mahad Baig', close: '2027-03-20', created: '12 Oct 2026' },
  { id: 'd2', name: 'Lumen Intro', companyId: 'c8', contactId: 'p8', amount: 24000, currency: 'USD', stage: 'new', owner: 'Zain Ahmed', close: '2027-04-02', created: '19 Oct 2026' },
  { id: 'd3', name: 'Northwind Rollout', companyId: 'c1', contactId: 'p1', amount: 58000, currency: 'USD', stage: 'contacted', owner: 'Mahad Baig', close: '2027-02-28', waiting: true, created: '2 Oct 2026' },
  { id: 'd4', name: 'Atlas Freight Trial', companyId: 'c9', contactId: 'p9', amount: 36000, currency: 'USD', stage: 'meeting', owner: 'Mahad Baig', close: '2027-03-10', created: '28 Sep 2026' },
  { id: 'd5', name: 'Halden Platform', companyId: 'c4', contactId: 'p3', amount: 120000, currency: 'USD', stage: 'proposal', owner: 'Mahad Baig', close: '2027-02-15', waiting: true, created: '14 Sep 2026' },
  { id: 'd6', name: 'Vertex Platform', companyId: 'c5', contactId: 'p4', amount: 96000, currency: 'USD', stage: 'proposal', owner: 'Zain Ahmed', close: '2027-02-22', waiting: true, created: '8 Sep 2026' },
  { id: 'd7', name: 'Orbit Fleet', companyId: 'c2', contactId: 'p2', amount: 90000, currency: 'USD', stage: 'proposal', owner: 'Sana Iqbal', close: '2027-04-15', waiting: true, created: '1 Sep 2026' },
  { id: 'd8', name: 'Pioneer Rollout', companyId: 'c10', contactId: 'p10', amount: 80000, currency: 'USD', stage: 'proposal', owner: 'Hira Malik', close: '2027-03-31', created: '22 Aug 2026' },
  { id: 'd9', name: 'Kestrel Enterprise', companyId: 'c6', contactId: 'p6', amount: 164000, currency: 'USD', stage: 'negotiation', owner: 'Sana Iqbal', close: '2027-01-30', created: '3 Aug 2026' },
  { id: 'd10', name: 'Karachi Dealer Pilot', companyId: null, contactId: 'p11', amount: 2400000, currency: 'PKR', stage: 'contacted', owner: 'Hira Malik', close: '2027-03-05', created: '6 Oct 2026' },
  { id: 'd11', name: 'Lahore Dealer Pilot', companyId: null, contactId: 'p12', amount: 1800000, currency: 'PKR', stage: 'new', owner: 'Hira Malik', close: '2027-03-18', created: '10 Oct 2026' },
  { id: 'd12', name: 'Kestrel Starter', companyId: 'c6', contactId: 'p6', amount: 12000, currency: 'USD', stage: 'won', owner: 'Sana Iqbal', close: '2026-09-12', created: '4 Jun 2026' },
  { id: 'd13', name: 'Meridian Retail', companyId: 'c7', contactId: 'p7', amount: 52000, currency: 'USD', stage: 'lost', owner: 'Hira Malik', close: '2026-10-02', lostReason: 'Chose another vendor', created: '9 Jun 2026' },
]

export const reviews: ReviewItem[] = [
  {
    id: 'r1', contactId: 'p1', dealId: 'd3', subject: 'Re: Rollout plan for the Chicago depots', time: '2 min', received: 'Today, 10:42 AM', type: 'meeting', confidence: 94,
    paragraphs: ['Hi Mahad,', 'Thanks for the walkthrough last week. The team liked what they saw.', 'Could we do Thursday at 3pm to go through rollout? I would like to bring our ops lead, Lena Fox, along.', 'Best, Sara'],
    evidence: 2, why: 'Sara proposes a specific time and says who will join. This is a clear meeting request.',
    facts: [['Asked for', 'Thursday 3:00 PM'], ['Attendees', 'Sara, Lena Fox'], ['Where', 'Not stated'], ['Deal', 'Northwind Rollout']],
    actions: [{ id: 'a1', label: 'Create meeting Thu 3:00 PM (Asia/Karachi 8:00 PM)', on: true }, { id: 'a2', label: 'Move Northwind Rollout to Meeting scheduled', on: true }, { id: 'a3', label: 'Add Lena Fox as a contact', on: false }],
    draft: 'Hi Sara,\n\nThursday at 3:00 PM works well. I will send an invite now. Please bring Lena, it will help to have your ops lead on the call.\n\nBest,\nMahad',
    usedFacts: [], status: 'pending',
  },
  {
    id: 'r2', contactId: 'p2', dealId: 'd7', subject: 'Re: Fleet visibility proposal', time: '1 hr', received: 'Today, 9:15 AM', type: 'defer', confidence: 71,
    paragraphs: ['Hi Mahad,', 'Thanks for sending this over. This is not a priority until Q2 for us, so please ping me again in April.', 'Regards, Nina'],
    evidence: 1, why: 'Nina says it is not a priority until Q2 and asks you to come back in April. Confidence is below your bar of 85, so this needs you.',
    facts: [['Asked for', 'Follow up in April'], ['Timing', 'Q2 2027'], ['Deal', 'Orbit Fleet']],
    actions: [{ id: 'a1', label: 'Set follow-up for 1 Apr 2027', on: true }, { id: 'a2', label: 'Pause reminders on Orbit Fleet until then', on: true }],
    draft: 'Hi Nina,\n\nUnderstood, thanks for the clear timing. I will check back with you on 1 April.\n\nBest,\nMahad',
    usedFacts: [], status: 'pending',
  },
  {
    id: 'r3', contactId: 'p3', dealId: 'd5', subject: 'Re: Pricing for Halden', time: '3 hr', received: 'Today, 7:50 AM', type: 'pricing', confidence: 91,
    paragraphs: ['Hello Mahad,', 'Before we go further, what would it cost for 25 seats? We would also like to know if there is a discount for paying annually.', 'Jonathan'],
    evidence: 1, why: 'Jonathan asks for the cost of 25 seats and an annual discount. Both answers are in your approved facts.',
    facts: [['Seats', '25'], ['Billing', 'Monthly or annual'], ['Deal', 'Halden Platform']],
    actions: [{ id: 'a1', label: 'Attach a quote to Halden Platform', on: true }, { id: 'a2', label: 'Keep Halden Platform in Proposal', on: true }],
    draft: 'Hi Jonathan,\n\nFor 25 seats the price is $49 per seat per month, so $1,225 a month. With annual billing there is a 20% discount, which brings it to $11,760 a year.\n\nI am happy to send a formal quote today.\n\nBest,\nMahad',
    usedFacts: ['Price per seat', 'Annual discount'], status: 'pending',
  },
  {
    id: 'r4', contactId: 'p4', dealId: 'd6', subject: 'Re: Vertex rollout timeline', time: 'Yesterday', received: 'Yesterday, 4:20 PM', type: 'objection', confidence: 82,
    paragraphs: ['Hi Mahad,', 'We are worried about how long setup would take, and whether we could try it before committing.', 'Maya'],
    evidence: 1, why: 'Maya names two concerns: setup time and trying first. Confidence is just below your bar of 85.',
    facts: [['Concern 1', 'Setup time'], ['Concern 2', 'Try before buying'], ['Deal', 'Vertex Platform']],
    actions: [{ id: 'a1', label: 'Offer a 14-day free trial', on: true }, { id: 'a2', label: 'Keep Vertex Platform in Proposal', on: true }],
    draft: 'Hi Maya,\n\nThat is fair. Most teams are live in under a day and there is no setup fee. You can also try it first with a 14-day free trial, no card needed.\n\nShall I set one up for your team?\n\nBest,\nMahad',
    usedFacts: ['Setup', 'Free trial'], status: 'pending',
  },
  {
    id: 'r5', contactId: 'p5', dealId: 'd1', subject: 'Re: Quick intro from Mahad', time: 'Yesterday', received: 'Yesterday, 11:05 AM', type: 'referral', confidence: 88,
    paragraphs: ['Hi Mahad,', 'I am not the right person for this. Omar Siddiqui handles it on our side, so I have copied him here.', 'Daniel'],
    evidence: 1, why: 'Daniel hands the thread to Omar Siddiqui and has copied him in. This is a referral.',
    facts: [['Referred to', 'Omar Siddiqui'], ['Role', 'Not stated'], ['Deal', 'Brightpath Pilot']],
    actions: [{ id: 'a1', label: 'Add Omar Siddiqui as a contact at Brightpath', on: true }, { id: 'a2', label: 'Move Brightpath Pilot to Contacted', on: true }],
    draft: 'Hi Daniel,\n\nThank you for the quick pointer. Hi Omar, nice to meet you. I would love to share a short overview of what we do. Would 20 minutes next week suit you?\n\nBest,\nMahad',
    usedFacts: [], status: 'pending',
  },
]

export const threads: Thread[] = [
  { id: 't1', contactId: 'p1', subject: 'Re: Rollout plan for the Chicago depots', preview: 'Could we do Thursday at 3pm to go through rollout?', time: '2 min', status: 'waiting', replyType: 'meeting', confidence: 94, dealId: 'd3', mailbox: 'mahad@acme.co', messages: [
    { from: 'me', name: 'You', time: '28 Oct, 3:10 PM', text: 'Hi Sara,\n\nThanks for the time last week. I have attached the rollout plan for the Chicago depots. Let me know what you think.\n\nBest,\nMahad' },
    { from: 'them', name: 'Sara Ali', time: 'Today, 10:42 AM', text: 'Hi Mahad,\n\nThanks for the walkthrough last week. The team liked what they saw.\n\nCould we do Thursday at 3pm to go through rollout? I would like to bring our ops lead, Lena Fox, along.\n\nBest, Sara' }] },
  { id: 't2', contactId: 'p2', subject: 'Re: Fleet visibility proposal', preview: 'This is not a priority until Q2 for us, so please ping me again in April.', time: '1 hr', status: 'waiting', replyType: 'defer', confidence: 71, dealId: 'd7', mailbox: 'mahad@acme.co', messages: [
    { from: 'me', name: 'You', time: '27 Oct, 11:00 AM', text: 'Hi Nina,\n\nAttached is the fleet visibility proposal we discussed. Happy to walk through it.\n\nBest,\nMahad' },
    { from: 'them', name: 'Nina Williams', time: 'Today, 9:15 AM', text: 'Hi Mahad,\n\nThanks for sending this over. This is not a priority until Q2 for us, so please ping me again in April.\n\nRegards, Nina' }] },
  { id: 't3', contactId: 'p3', subject: 'Re: Pricing for Halden', preview: 'What would it cost for 25 seats?', time: '3 hr', status: 'waiting', replyType: 'pricing', confidence: 91, dealId: 'd5', mailbox: 'sales@acme.co', messages: [
    { from: 'them', name: 'Jonathan Lee', time: 'Today, 7:50 AM', text: 'Hello Mahad,\n\nBefore we go further, what would it cost for 25 seats? We would also like to know if there is a discount for paying annually.\n\nJonathan' }] },
  { id: 't4', contactId: 'p4', subject: 'Re: Vertex rollout timeline', preview: 'We are worried about how long setup would take.', time: 'Yesterday', status: 'waiting', replyType: 'objection', confidence: 82, dealId: 'd6', mailbox: 'mahad@acme.co', messages: [
    { from: 'them', name: 'Maya Patel', time: 'Yesterday, 4:20 PM', text: 'Hi Mahad,\n\nWe are worried about how long setup would take, and whether we could try it before committing.\n\nMaya' }] },
  { id: 't5', contactId: 'p5', subject: 'Re: Quick intro from Mahad', preview: 'Omar Siddiqui handles it on our side, I have copied him.', time: 'Yesterday', status: 'waiting', replyType: 'referral', confidence: 88, dealId: 'd1', mailbox: 'sales@acme.co', messages: [
    { from: 'them', name: 'Daniel Reed', time: 'Yesterday, 11:05 AM', text: 'Hi Mahad,\n\nI am not the right person for this. Omar Siddiqui handles it on our side, so I have copied him here.\n\nDaniel' }] },
  { id: 't6', contactId: 'p6', subject: 'Re: Enterprise terms', preview: 'Legal is reviewing the redlines, expect a reply Friday.', time: '2 days', status: 'done', replyType: 'defer', confidence: 93, dealId: 'd9', mailbox: 'mahad@acme.co', messages: [
    { from: 'them', name: 'Priya Nair', time: '30 Oct, 2:40 PM', text: 'Hi Mahad,\n\nLegal is reviewing the redlines, expect a reply Friday.\n\nPriya' },
    { from: 'me', name: 'You', time: '30 Oct, 3:05 PM', text: 'Thanks Priya, that works. Talk Friday.\n\nMahad' }] },
  { id: 't7', contactId: 'p8', subject: 'Out of office: Quick question', preview: 'I am away until 9 November with limited access to email.', time: '4 days', status: 'none', replyType: 'ooo', confidence: 99, dealId: 'd2', mailbox: 'mahad@acme.co', messages: [
    { from: 'them', name: 'Elena Rossi', time: '28 Oct, 8:00 AM', text: 'I am away until 9 November with limited access to email. For urgent matters please contact the front desk.' }] },
  { id: 't8', contactId: 'p11', subject: 'Re: Dealer pilot', preview: 'Please remove me from this list.', time: '2 weeks', status: 'done', replyType: 'optout', confidence: 98, dealId: 'd10', mailbox: 'sales@acme.co', messages: [
    { from: 'them', name: 'Hassan Raza', time: '17 Oct, 5:30 PM', text: 'Please remove me from this list.' }] },
]

export const followups: Followup[] = [
  { id: 'f1', contactId: 'p6', title: 'Priya Nair at Kestrel', sub: 'No reply to the redline reminder for 3 days', due: 'Due today', draft: 'Hi Priya,\n\nJust checking in on the redlines. If legal needs anything from our side to close this out, tell me and I will turn it around today.\n\nBest,\nMahad', done: false },
  { id: 'f2', contactId: 'p10', title: 'Mei Tan at Pioneer Foods', sub: 'Proposal sent 6 days ago, no reply', due: 'Tomorrow', draft: 'Hi Mei,\n\nI wanted to make sure the proposal reached you. Happy to go through any part of it in 15 minutes.\n\nBest,\nMahad', done: false },
  { id: 'f3', contactId: 'p9', title: 'Chris Doyle at Atlas Freight', sub: 'Trial starts Monday, send the setup checklist', due: 'In 3 days', draft: 'Hi Chris,\n\nYour trial starts Monday. Attached is the short setup checklist so your fleet team is ready on day one.\n\nBest,\nMahad', done: false },
]

export const events: CalEvent[] = [
  { id: 'e1', day: 'Today', date: 'Sun 1 Nov', time: '2:00 PM', dur: '30 min', title: 'Atlas Freight trial kickoff', sub: 'Chris Doyle, Atlas Freight', contactId: 'p9', kind: 'meeting' },
  { id: 'e2', day: 'Tomorrow', date: 'Mon 2 Nov', time: '11:00 AM', dur: '45 min', title: 'Kestrel contract review', sub: 'Priya Nair, Kestrel Aerospace', contactId: 'p6', kind: 'meeting' },
  { id: 'e3', day: 'Tomorrow', date: 'Mon 2 Nov', time: '4:00 PM', dur: '30 min', title: 'Pioneer Foods demo', sub: 'Mei Tan, Pioneer Foods', contactId: 'p10', kind: 'meeting' },
  { id: 'e4', day: 'Thursday', date: 'Thu 5 Nov', time: '3:00 PM', dur: '45 min', title: 'Northwind rollout walkthrough', sub: 'Sara Ali, Lena Fox. Hold until you approve', contactId: 'p1', kind: 'hold' },
]

export const templates: Template[] = [
  { id: 'tp1', name: 'Confirm a meeting', type: 'meeting', uses: 41, updated: '2 days ago', body: 'Hi {first_name},\n\n{day} at {time} works well. I will send an invite now.\n\nBest,\n{sender_first_name}' },
  { id: 'tp2', name: 'Share pricing', type: 'pricing', uses: 28, updated: '1 week ago', body: 'Hi {first_name},\n\nThe price is {price_per_seat} per seat per month. With annual billing there is a {annual_discount} discount.\n\nBest,\n{sender_first_name}' },
  { id: 'tp3', name: 'Handle setup worry', type: 'objection', uses: 17, updated: '3 weeks ago', body: 'Hi {first_name},\n\nThat is fair. {setup} You can also try it first: {free_trial}.\n\nBest,\n{sender_first_name}' },
  { id: 'tp4', name: 'Come back later', type: 'defer', uses: 22, updated: '2 weeks ago', body: 'Hi {first_name},\n\nUnderstood, thanks for the timing. I will check back with you on {date}.\n\nBest,\n{sender_first_name}' },
  { id: 'tp5', name: 'Thank for referral', type: 'referral', uses: 9, updated: '1 month ago', body: 'Hi {first_name},\n\nThank you for the pointer. Hi {referred_name}, I would love to share a short overview. Would 20 minutes next week suit you?\n\nBest,\n{sender_first_name}' },
]

export const facts: Fact[] = [
  { id: 'fa1', key: 'Price per seat', value: '$49 per seat per month', on: true, by: 'Mahad Baig', when: 'Updated 12 Oct 2026' },
  { id: 'fa2', key: 'Annual discount', value: '20% off when billed annually', on: true, by: 'Mahad Baig', when: 'Updated 12 Oct 2026' },
  { id: 'fa3', key: 'Setup', value: 'Live in under a day, no setup fee', on: true, by: 'Sana Iqbal', when: 'Updated 3 Oct 2026' },
  { id: 'fa4', key: 'Free trial', value: '14 days, no card needed', on: true, by: 'Sana Iqbal', when: 'Updated 3 Oct 2026' },
  { id: 'fa5', key: 'SOC 2', value: 'Report available on request', on: false, by: 'Mahad Baig', when: 'Off. Not yet verified' },
]

export const mailboxes: Mailbox[] = [
  { id: 'm1', email: 'mahad@acme.co', provider: 'Google', status: 'ok', sync: 'Synced 2 min ago', owner: 'Mahad Baig' },
  { id: 'm2', email: 'sales@acme.co', provider: 'Google', status: 'ok', sync: 'Synced 5 min ago', owner: 'Shared' },
  { id: 'm3', email: 'hello@acme.com', provider: 'Microsoft', status: 'expired', sync: 'Sign-in expired 3 days ago', owner: 'Sana Iqbal' },
]

export const members: Member[] = [
  { id: 'u1', name: 'Mahad Baig', initials: 'MB', tint: 't-blue', email: 'mahad@acme.co', role: 'Owner', team: 'Sales', last: 'Now', status: 'Active' },
  { id: 'u2', name: 'Sana Iqbal', initials: 'SI', tint: 't-pink', email: 'sana@acme.co', role: 'Admin', team: 'Sales', last: '1 hr ago', status: 'Active' },
  { id: 'u3', name: 'Zain Ahmed', initials: 'ZA', tint: 't-mint', email: 'zain@acme.co', role: 'Member', team: 'Sales', last: 'Yesterday', status: 'Active' },
  { id: 'u4', name: 'Hira Malik', initials: 'HM', tint: 't-peach', email: 'hira@acme.co', role: 'Member', team: 'Support', last: 'Invited 2 days ago', status: 'Invited' },
]

export const audit: AuditRow[] = [
  { id: 'au1', time: '10:44', who: 'Mahad Baig', ini: 'MB', tint: 't-blue', action: 'Approved reply', on: 'Sara Ali, Northwind' },
  { id: 'au2', time: '10:31', who: 'Nudge', ini: 'N', tint: 't-grey', action: 'Drafted reply', on: 'Nina Williams, Orbit' },
  { id: 'au3', time: '09:58', who: 'Sana Iqbal', ini: 'SI', tint: 't-pink', action: 'Changed approved fact', on: 'Setup' },
  { id: 'au4', time: '09:12', who: 'Mahad Baig', ini: 'MB', tint: 't-blue', action: 'Moved deal to Proposal', on: 'Halden Platform' },
  { id: 'au5', time: 'Yesterday', who: 'Nudge', ini: 'N', tint: 't-grey', action: 'Blocked sending (opt-out)', on: 'Hassan Raza' },
  { id: 'au6', time: 'Yesterday', who: 'Zain Ahmed', ini: 'ZA', tint: 't-mint', action: 'Rejected draft', on: 'Maya Patel, Vertex' },
  { id: 'au7', time: '30 Oct', who: 'Mahad Baig', ini: 'MB', tint: 't-blue', action: 'Switched to Draft-only', on: 'Workspace' },
]

export const weekBars = [
  { d: 'Mon', a: 9, p: 3 }, { d: 'Tue', a: 12, p: 2 }, { d: 'Wed', a: 8, p: 4 }, { d: 'Thu', a: 14, p: 2 },
  { d: 'Fri', a: 11, p: 3 }, { d: 'Sat', a: 4, p: 1 }, { d: 'Sun', a: 6, p: 5 },
]
export const typeMix: { t: ReplyType; n: number }[] = [
  { t: 'meeting', n: 21 }, { t: 'pricing', n: 15 }, { t: 'objection', n: 11 }, { t: 'defer', n: 9 },
  { t: 'referral', n: 6 }, { t: 'notinterested', n: 5 }, { t: 'optout', n: 2 }, { t: 'ooo', n: 4 }, { t: 'unclear', n: 3 },
]
