import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon } from './Icons'
import { dismissToast, useStore, getState } from '../store'
import { rtLabel, type ReplyType, type Stage } from '../data/seed'
import { csvSafe } from '../data/validate'

export const initials = (n: string) => n.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
export const firstName = (n: string) => n.split(' ')[0]

export function Avatar({ name, tint = 't-grey', size = '' }: { name: string; tint?: string; size?: '' | 'lg' | 'md' | 'sm' | 'xs' }) {
  return <span className={`avatar ${size} ${tint}`}>{initials(name)}</span>
}

/** The one segmented control, for toggles and tab groups. Arrow keys move the choice, Tab leaves the group.
    Styles are `.segmented` in app.css: selected is near-black with white text, the rest white with gray text. */
export function Segmented<T extends string | number>({ value, options, onChange, label, block, style }: {
  value: T; options: ReadonlyArray<{ value: T; label: ReactNode; count?: number }>; onChange: (v: T) => void
  label: string; block?: boolean; style?: React.CSSProperties
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const has = options.some((o) => o.value === value)
  const go = (i: number) => { const n = (i + options.length) % options.length; onChange(options[n]!.value); refs.current[n]?.focus() }
  return (
    <div className={'segmented' + (block ? ' block' : '')} role="radiogroup" aria-label={label} style={style}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button key={String(o.value)} ref={(el) => { refs.current[i] = el }} type="button" role="radio" aria-checked={on} tabIndex={on || (!has && i === 0) ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(i + 1) }
              else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(i - 1) }
            }}>
            {o.label}{o.count !== undefined && <span className="n">{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export const RT_VAR: Record<ReplyType, string> = {
  meeting: 'var(--rt-meeting)', pricing: 'var(--rt-pricing)', objection: 'var(--rt-objection)', defer: 'var(--rt-defer)', referral: 'var(--rt-referral)',
  notinterested: 'var(--rt-notinterested)', optout: 'var(--rt-optout)', ooo: 'var(--rt-ooo)', unclear: 'var(--rt-unclear)',
}
export const ST_VAR: Record<Stage, string> = {
  new: 'var(--st-new)', contacted: 'var(--st-contacted)', meeting: 'var(--st-meeting)', proposal: 'var(--st-proposal)',
  negotiation: 'var(--st-negotiation)', won: 'var(--st-won)', lost: 'var(--st-lost)',
}
export function ReplyMark({ t, label = true }: { t: ReplyType; label?: boolean }) {
  return <span className="rt"><i style={{ background: RT_VAR[t] }} />{label && rtLabel(t)}</span>
}

export function Conf({ v, wide = false }: { v: number; wide?: boolean }) {
  const th = useStore((s) => s.settings.threshold)
  const low = v < th
  return (
    <span className={`conf ${low ? 'low' : ''} ${wide ? 'wide' : ''}`} title={`Your bar is ${th}`}>
      <span className="track"><span className="fill" style={{ width: v + '%' }} /><span className="bar" style={{ left: th + '%' }} /></span>
      {v}
    </span>
  )
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className="toggle" onClick={() => onChange(!on)} />
}

export function Kbd({ children }: { children: ReactNode }) { return <span className="kbd">{children}</span> }

export function Modal({ title, onClose, children, foot, wide }: { title: string; onClose: () => void; children: ReactNode; foot?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon n="x" s={17} /></button></div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className="toast" key={t.id}>
          <span>{t.text}</span>
          {t.undo && <button onClick={() => { t.undo!(); dismissToast(t.id) }}>Undo</button>}
        </div>
      ))}
    </div>
  )
}

export function Field({ label, opt, error, hint, children }: { label?: string; opt?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      {label && <label>{label}{opt && <span className="opt">(optional)</span>}</label>}
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

export function Pop({ open, onClose, children, style }: { open: boolean; onClose: () => void; children: ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    return () => document.removeEventListener('mousedown', h)
  }, [open, onClose])
  if (!open) return null
  return <div className="popover" ref={ref} style={style}>{children}</div>
}


export { emailOk, pwScore } from '../data/validate'

export const companyName = (id: string | null) => (id ? getState().companies.find((c) => c.id === id)?.name ?? '' : '')
export const contactById = (id: string | null) => getState().contacts.find((c) => c.id === id)

export function downloadCSV(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => '"' + (typeof v === 'number' && Number.isFinite(v) ? String(v) : csvSafe(String(v))).replace(/"/g, '""') + '"'
  const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function useTitle(t: string) { useEffect(() => { document.title = t + ' · Nudge' }, [t]) }

/** Renders text, wrapping the sentence [index] in an evidence highlight with a [1] footnote. */
export function Evidence({ paragraphs, evidence }: { paragraphs: string[]; evidence: number }) {
  return (
    <div className="mail-text">
      {paragraphs.map((p, i) =>
        i === evidence ? <p key={i}><mark className="ev">{p}</mark><sup className="ref">[1]</sup></p> : <p key={i}>{p}</p>,
      )}
    </div>
  )
}
