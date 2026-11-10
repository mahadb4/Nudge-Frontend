import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, setApiHandlers } from '../api'
import { clearWorkspace, hasSession, hydrateWorkspace, useStore } from '../store'
import { Brand } from './Icons'

/** Stops double submits. A ref blocks a second click in the same tick, state disables the button. */
export function useSubmit() {
  const live = useRef(false)
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const run = useCallback(async (fn: () => Promise<void>) => {
    if (live.current) return
    live.current = true; setBusy(true)
    try { await fn() } finally { live.current = false; if (mounted.current) setBusy(false) }
  }, [])
  return { busy, run }
}

/** Private routes. The browser holds no session, so every fresh load asks the API who is signed in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useStore((s) => s.user)
  const loc = useLocation()
  const [checked, setChecked] = useState(user !== null)
  useEffect(() => {
    if (user) { setChecked(true); return }
    let live = true
    api.auth.restore().then((u) => { if (live && u) hydrateWorkspace(u) }).catch(() => { /* treated as signed out */ }).finally(() => { if (live) setChecked(true) })
    return () => { live = false }
  }, [user])
  if (!checked) return <div className="boot" role="status" aria-label="Loading" />
  if (!user) return <Navigate to="/sign-in" replace state={{ from: loc.pathname }} />
  return <>{children}</>
}

/** Wires the API client's 401 handler to the router, and handles the back/forward cache after sign-out. */
export function SessionWatcher() {
  const nav = useNavigate()
  useEffect(() => {
    setApiHandlers({ onUnauthorized: () => { clearWorkspace(); nav('/sign-in', { replace: true, state: { notice: 'expired' } }) } })
    const show = (e: PageTransitionEvent) => { if (e.persisted && !hasSession()) window.location.reload() }
    window.addEventListener('pageshow', show)
    return () => window.removeEventListener('pageshow', show)
  }, [nav])
  return null
}

/** A crash shows this and nothing else. No stack, no message, no data, nothing logged. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  override componentDidCatch(_error: Error, _info: ErrorInfo) { /* intentionally empty: error text can contain personal data */ }
  override render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="notfound" role="alert">
        <Brand />
        <h1>Something went wrong</h1>
        <p>Nothing was sent. Reload the page to carry on. If it keeps happening, tell your admin.</p>
        <button className="btn primary" onClick={() => window.location.assign('/')}>Reload Nudge</button>
      </div>
    )
  }
}

export function NotFound() {
  return (
    <div className="notfound">
      <Brand />
      <h1>Page not found</h1>
      <p>That address does not exist, or you do not have access to it.</p>
      <Link className="btn primary" to="/app/home">Go to Home</Link>
    </div>
  )
}
