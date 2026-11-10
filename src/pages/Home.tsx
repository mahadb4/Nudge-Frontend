import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Avatar, Conf, ReplyMark, ST_VAR, RT_VAR, useTitle, contactById, companyName } from '../components/ui'
import { STAGES, money, rtLabel, typeMix, weekBars } from '../data/seed'

function Spark({ pts, color = 'var(--ink-2)' }: { pts: number[]; color?: string }) {
  const max = Math.max(...pts), min = Math.min(...pts)
  const w = 200, h = 44
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * w},${h - 4 - ((p - min) / (max - min || 1)) * (h - 10)}`).join(' ')
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none"><path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
}

export function Home() {
  const me = useStore((x) => x.user?.name.split(' ')[0] ?? '')
  useTitle('Home')
  const nav = useNavigate()
  const s = useStore((x) => x)
  const pending = s.reviews.filter((r) => r.status === 'pending')
  const open = s.deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost')
  const usd = open.filter((d) => d.currency === 'USD')
  const pkr = open.filter((d) => d.currency === 'PKR')
  const total = usd.reduce((a, d) => a + d.amount, 0)
  const approvedToday = 8 + s.approvedToday.length
  const total7 = weekBars.reduce((a, b) => a + b.a + b.p, 0)
  const totalMix = typeMix.reduce((a, b) => a + b.n, 0)
  const maxBar = Math.max(...weekBars.map((b) => b.a + b.p))
  const hour = new Date().getHours()
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">{greet}{me ? ', ' + me : ''}</h1>
          <p className="page-sub">{pending.length ? <>{pending.length} {pending.length === 1 ? 'reply is' : 'replies are'} waiting for you. The rest of the day is quiet.</> : 'You are all caught up. Nothing is waiting for review.'}</p>
        </div>
        <button className="btn primary lg" onClick={() => nav('/app/review')}>Start review <span className="kbd">{pending.length}</span></button>
      </div>

      <div className="stat-row">
        <div className="stat"><div className="k">Waiting for review</div><div className="v">{pending.length}</div><div className="d">Oldest from yesterday</div><Spark pts={[3, 5, 4, 7, 6, 5, pending.length || 1]} /></div>
        <div className="stat"><div className="k">Approved today</div><div className="v">{approvedToday}</div><div className="d"><span className="delta">+2</span> vs yesterday</div><Spark pts={[4, 6, 5, 9, 7, 8, approvedToday]} color="var(--approve)" /></div>
        <div className="stat"><div className="k">Open pipeline</div><div className="v">{money(total)}</div><div className="d">{usd.length} deals in USD</div><Spark pts={[480, 520, 560, 540, 610, 650, total / 1000]} /></div>
        <div className="stat"><div className="k">Approvals to unlock "Act when sure"</div><div className="v">{s.settings.approvals}<small>/50</small></div><div className="d">{50 - s.settings.approvals} to go</div><Spark pts={[10, 14, 19, 22, 26, 29, s.settings.approvals]} /></div>
      </div>

      <div className="home-grid">
        <div>
          <div className="sect"><h3>Waiting for you <span className="n">{pending.length}</span></h3><Link className="r" to="/app/review">Open Review</Link></div>
          {pending.length === 0 && <div className="empty">All caught up.</div>}
          {pending.map((r) => {
            const c = contactById(r.contactId)!
            return (
              <div key={r.id} className="wait-row" onClick={() => nav('/app/review')}>
                <Avatar name={c.name} tint={c.tint} size="md" />
                <div style={{ minWidth: 0 }}>
                  <div className="nm">{c.name}<span>{companyName(c.companyId)}</span></div>
                  <div className="q">{r.paragraphs[r.evidence]}</div>
                </div>
                <ReplyMark t={r.type} />
                <Conf v={r.confidence} />
                <div className="tm">{r.time}</div>
              </div>
            )
          })}

          <div className="sect" style={{ marginTop: 36 }}><h3>Last 7 days</h3><span className="r">{total7} replies</span></div>
          <div className="bars">
            {weekBars.map((b, i) => (
              <div className="b" key={b.d}>
                <div className="stack" style={{ height: ((b.a + b.p) / maxBar) * 100 + '%' }}>
                  <div className="p" style={{ flex: b.p }} /><div className="a" style={{ flex: b.a }} />
                </div>
                <span className={'lab' + (i === 6 ? ' on' : '')}>{b.d}</span>
              </div>
            ))}
          </div>
          <div className="legend"><span><i className="dot" style={{ background: 'var(--approve)', marginRight: 6 }} />Approved</span><span><i className="dot" style={{ background: '#444', marginRight: 6 }} />Pending</span></div>

          <div className="sect" style={{ marginTop: 36 }}><h3>What people are saying</h3><span className="r">{totalMix} replies</span></div>
          <div className="stackbar">{typeMix.map((t) => <i key={t.t} style={{ flex: t.n, background: RT_VAR[t.t] }} />)}</div>
          {typeMix.map((t) => (
            <div className="type-row" key={t.t}><ReplyMark t={t.t} label={false} />
              <span style={{ marginLeft: -50 }}>{rtLabel(t.t)}</span>
              <span className="p">{Math.round((t.n / totalMix) * 100)}%</span><span className="c">{t.n}</span></div>
          ))}
        </div>

        <div>
          <div className="sect"><h3>Today</h3><Link className="r" to="/app/calendar">Calendar</Link></div>
          {s.events.slice(0, 3).map((e) => (
            <div className="today-item" key={e.id}>
              <div className="tm">{e.time}</div>
              <div><div className="tt"><i className="dot" style={{ background: e.kind === 'hold' ? 'var(--needs)' : 'var(--info)' }} />{e.title}</div><div className="sub">{e.sub}</div></div>
            </div>
          ))}
          <div className="sect" style={{ marginTop: 34 }}><h3>Pipeline</h3><Link className="r" to="/app/pipeline">Open</Link></div>
          <div className="pipe-total">{money(total)}<small>{usd.length} open deals</small></div>
          <div className="stagebar">{STAGES.slice(0, 5).map((st) => {
            const a = usd.filter((d) => d.stage === st.id).reduce((x, d) => x + d.amount, 0)
            return <i key={st.id} style={{ flex: a || 0.01, background: ST_VAR[st.id] }} />
          })}</div>
          {STAGES.slice(0, 5).map((st) => {
            const ds = usd.filter((d) => d.stage === st.id)
            return <div className="stage-row" key={st.id}><i className="dot" style={{ background: ST_VAR[st.id] }} /><span>{st.label}</span><span className="n">{ds.length}</span><span className="a">{money(ds.reduce((a, d) => a + d.amount, 0))}</span></div>
          })}
          {pkr.length > 0 && <div className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>Also {money(pkr.reduce((a, d) => a + d.amount, 0), 'PKR')} across {pkr.length} deals. Currencies are never added together.</div>}
        </div>
      </div>
    </div>
  )
}
