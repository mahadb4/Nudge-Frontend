import { useEffect, useRef, useState } from 'react'
import { Icon } from '../components/Icons'
import { ST_VAR, Segmented, downloadCSV, useTitle, ReplyMark } from '../components/ui'
import { toast, useStore } from '../store'
import { STAGES, money, typeMix, rtLabel, type ReplyType } from '../data/seed'

const ACC: Record<number, number[]> = {
  7: [88, 90, 89, 92, 91, 93, 94],
  30: [82, 84, 83, 86, 85, 88, 87, 89, 90, 88, 91, 92, 90, 93, 94],
  90: [74, 77, 80, 79, 83, 85, 84, 88, 90, 92, 94],
}
const BY_TYPE: Record<ReplyType, number> = { meeting: 96, pricing: 93, objection: 84, defer: 79, referral: 90, notinterested: 95, optout: 99, ooo: 99, unclear: 61 }

export function Reports() {
  useTitle('Reports')
  const deals = useStore((s) => s.deals)
  const approvals = useStore((s) => s.settings.approvals)
  const th = useStore((s) => s.settings.threshold)
  const [range, setRange] = useState<7 | 30 | 90>(30)
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(900)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(320, Math.round(el.clientWidth))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const pts = ACC[range]
  const H = 190, pad = 8
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - pad * 2)
  const y = (v: number) => H - 14 - ((v - 60) / 40) * (H - 28)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p)}`).join(' ')
  const mult = range === 7 ? 1 : range === 30 ? 4.2 : 12
  const open = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost' && d.currency === 'USD')
  const total = open.reduce((a, d) => a + d.amount, 0)

  return (
    <div className="page">
      <div className="page-head"><div><h1 className="h1">Reports</h1><p className="page-sub">How well Nudge understands your customers, and where your deals stand.</p></div>
        <div className="row"><Segmented label="Date range" value={range} onChange={setRange} options={([7, 30, 90] as const).map((r) => ({ value: r, label: r + ' days' }))} />
          <button className="btn" onClick={() => { downloadCSV('nudge-report-' + range + 'd.csv', [['Reply type', 'Replies', 'Accuracy %'], ...typeMix.map((t) => [rtLabel(t.t), Math.round(t.n * mult), BY_TYPE[t.t]])]); toast('Report exported') }}><Icon n="download" s={15} />Export CSV</button></div></div>

      <div className="stat-row plain">
        <div className="stat"><div className="k">Replies handled</div><div className="big-num">{Math.round(76 * mult)}</div><div className="d"><span className="delta">+12%</span> vs previous</div></div>
        <div className="stat"><div className="k">Approved without edits</div><div className="big-num">81%</div><div className="d"><span className="delta">+3 pts</span></div></div>
        <div className="stat"><div className="k">Type accuracy</div><div className="big-num">{pts[pts.length - 1]}%</div><div className="d">Your bar is {th}</div></div>
        <div className="stat"><div className="k">Total approvals</div><div className="big-num">{approvals}</div><div className="d">{Math.max(0, 50 - approvals)} until "Act when sure"</div></div>
      </div>

      <div className="card chart-card">
        <div className="sect"><h3>Reply type accuracy</h3><span className="r">Share of types you kept as suggested</span></div>
        <div ref={box}><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Accuracy over time" style={{ display: 'block' }}>
          {[60, 70, 80, 90, 100].map((g) => <g key={g}><line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="var(--hair)" /><text x={W - pad} y={y(g) - 4} textAnchor="end" fontSize="10" fill="var(--ink-3)" fontFamily="var(--font-mono)">{g}</text></g>)}
          <line x1={pad} x2={W - pad} y1={y(th)} y2={y(th)} stroke="var(--needs)" strokeDasharray="4 4" />
          <text x={pad} y={y(th) - 5} fontSize="10.5" fill="var(--needs)">Your bar {th}</text>
          <path d={path} fill="none" stroke="var(--approve)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => <circle key={i} cx={x(i)} cy={y(p)} r={i === pts.length - 1 ? 4 : 2.2} fill="var(--surface)" stroke="var(--approve)" strokeWidth="1.8"><title>{`${p}%`}</title></circle>)}
        </svg></div>
      </div>

      <div className="grid-2" style={{ marginTop: 22 }}>
        <div className="card pad"><div className="card-title" style={{ marginBottom: 12 }}>Accuracy by reply type</div>
          {typeMix.map((t) => <div className="hbar" key={t.t}><ReplyMark t={t.t} /><div className="tr"><i style={{ width: BY_TYPE[t.t] + '%' }} /></div><span className="c">{BY_TYPE[t.t]}</span></div>)}</div>
        <div className="card pad"><div className="card-title" style={{ marginBottom: 14 }}>Pipeline by stage</div>
          {STAGES.slice(0, 5).map((st) => { const a = open.filter((d) => d.stage === st.id).reduce((s, d) => s + d.amount, 0); return (
            <div className="pbar" key={st.id}><div className="t"><span>{st.label}<span className="mono">{open.filter((d) => d.stage === st.id).length} deals</span></span><span className="mono">{money(a)}</span></div>
              <div className="tr"><i style={{ width: (a / total) * 100 + '%', background: ST_VAR[st.id] }} /></div></div>) })}
          <p className="hint">USD only. PKR deals are reported separately on the Pipeline page.</p></div>
      </div>
    </div>
  )
}
