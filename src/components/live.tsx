/* Small pieces shared by the screens that read from the real API. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, apiMessage } from '../api'
import type { Page } from '../api/crm'

/** A paged, searchable list. Typing waits 300 ms, searches shorter than 2 characters are not sent, and a stale answer is dropped. */
export function usePaged<T>(fetcher: (a: { q: string; page: number; signal: AbortSignal }) => Promise<Page<T>>, extraKey = '') {
  const [input, setInput] = useState(''); const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<Page<T> | null>(null)
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  const fetchRef = useRef(fetcher); fetchRef.current = fetcher

  useEffect(() => {
    const t = setTimeout(() => { const v = input.trim(); setQ(v.length >= 2 ? v : ''); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [input])

  useEffect(() => {
    const ctl = new AbortController(); let live = true
    setLoading(true); setError('')
    fetchRef.current({ q, page, signal: ctl.signal })
      .then((r) => { if (live) { setData(r); setLoading(false) } })
      .catch((e) => {
        if (!live) return
        // A page past the end (rows were deleted) goes back to page 1 instead of showing an error.
        if (e instanceof ApiError && e.fieldCodes.page && page > 1) { setPage(1); return }
        setError(apiMessage(e)); setLoading(false)
      })
    return () => { live = false; ctl.abort() }
  }, [q, page, tick, extraKey])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { input, setInput, q, page, setPage, data, error, loading, reload }
}

export function Pager({ page, count, pageSize = 25, onPage }: { page: number; count: number; pageSize?: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize))
  if (pages <= 1) return null
  return (
    <div className="row spread" style={{ marginTop: 14 }}>
      <span className="muted" style={{ fontSize: 13 }}>Page {page} of {pages}</span>
      <span className="row" style={{ gap: 8 }}>
        <button className="btn sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <button className="btn sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </span>
    </div>
  )
}
