import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError, apiMessage, browserTimeZone, Code, fieldMessages, isMock } from '../api'
import { messageFor } from '../api/errors'
import { Brand, GoogleG, Icon, MsLogo } from '../components/Icons'
import { RightPane, type Pane } from '../components/AuthPane'
import { useSubmit } from '../components/guards'
import { Field, Segmented, useTitle } from '../components/ui'
import { LIMITS, emailErr, emailOk, nameErr, normEmail, passwordErr, personErr, pwScore, safeInternalPath } from '../data/validate'
import { hydrateWorkspace, toast, type User } from '../store'

/* Lockouts in these forms are a hint for the person typing. They can be bypassed, so the API
   rate-limits login, verify and reset on its own and answers 429. */
const UI_MAX_TRIES = 5
const UI_LOCK_MS = 30_000
const RESEND_SECONDS = 30

type RouterState = { from?: string; notice?: string; email?: string; token?: string } | null
const useRouterState = () => (useLocation().state as RouterState) ?? {}

function AuthFrame({ top, children, pane = 'reply', done }: { top?: ReactNode; children: ReactNode; pane?: Pane; done?: number }) {
  return (
    <div className="auth">
      <div className="auth-left">
        <div className="auth-top"><Link to="/"><Brand /></Link><div className="muted" style={{ fontSize: 14 }}>{top}</div></div>
        <div className="auth-mid">{children}</div>
        <div className="auth-foot"><span>© 2026 Nudge</span><span className="links"><a href="#" onClick={(e) => e.preventDefault()}>Terms</a><a href="#" onClick={(e) => e.preventDefault()}>Privacy</a><a href="#" onClick={(e) => e.preventDefault()}>Status</a></span></div>
      </div>
      <RightPane pane={pane} done={done} />
    </div>
  )
}

function Providers({ verb, onUser, onError, busy, run }: { verb: string; onUser: (u: User) => void; onError: (m: string) => void; busy: boolean; run: (fn: () => Promise<void>) => Promise<void> }) {
  const pick = (p: 'google' | 'microsoft' | 'sso') => run(async () => {
    try { onUser(await api.auth.oauth(p)) } catch (e) { onError(apiMessage(e)) }
  })
  return (
    <>
      <button className="provider" type="button" disabled={busy} onClick={() => pick('google')}><GoogleG />{verb} with Google</button>
      <button className="provider" type="button" disabled={busy} onClick={() => pick('microsoft')}><MsLogo />{verb} with Microsoft 365</button>
      <button className="provider" type="button" disabled={busy} onClick={() => pick('sso')}><Icon n="lock" s={16} />{verb} with SSO</button>
    </>
  )
}

/** A field is "left" only when the person used it (a key, a click or a paste) and then moved away.
    Autofill, and an autofocus that loses focus on its own, never count, so no error shows on first load. */
function useTouched() {
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const used = useRef<Record<string, boolean>>({})
  const field = (k: string, after?: () => void) => {
    const mark = () => { used.current[k] = true }
    return {
      onKeyDown: mark, onPointerDown: mark, onPaste: mark,
      onBlur: () => { if (used.current[k]) setTouched((t) => (t[k] ? t : { ...t, [k]: true })); after?.() },
    }
  }
  return { touched, field }
}
type Bind = ReturnType<ReturnType<typeof useTouched>['field']>

/** The password is sent exactly as typed. It is never trimmed, lowercased, logged or kept. */
function PwInput({ value, onChange, bind, invalid, placeholder, id, mode }: { value: string; onChange: (v: string) => void; bind?: Bind; invalid?: boolean; placeholder?: string; id?: string; mode: 'current-password' | 'new-password' }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw"><input id={id} className={'input' + (invalid ? ' invalid' : '')} type={show ? 'text' : 'password'} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} {...bind}
      autoComplete={mode} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={LIMITS.password} />
      <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}><Icon n={show ? 'eyeOff' : 'eye'} s={18} /></button></div>
  )
}

const emailAttrs = { type: 'email', inputMode: 'email', autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false, maxLength: LIMITS.email } as const

export function SignIn() {
  useTitle('Sign in')
  const nav = useNavigate()
  const rs = useRouterState()
  const dest = safeInternalPath(rs.from, '/app/home')
  const { busy, run } = useSubmit()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [keep, setKeep] = useState(true)
  const [tried, setTried] = useState(false); const { touched, field } = useTouched()
  const [fails, setFails] = useState(0); const [lockedUntil, setLockedUntil] = useState(0); const [now, setNow] = useState(Date.now())
  const [msg, setMsg] = useState('')
  useEffect(() => { if (lockedUntil <= Date.now()) return; const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t) }, [lockedUntil])
  const wait = Math.max(0, Math.ceil((lockedUntil - now) / 1000))
  const e = { email: emailErr(email), pw: !pw ? 'Enter your password.' : pw.length > LIMITS.password ? 'That password is too long.' : '' }
  const show = (k: 'email' | 'pw') => (tried || touched[k] ? e[k] : '')
  const enter = (u: User) => { hydrateWorkspace(u); nav(dest, { replace: true }) }
  const lock = (ms = UI_LOCK_MS) => { setLockedUntil(Date.now() + ms); setNow(Date.now()); setFails(0) }
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault(); setTried(true); setMsg('')
    if (wait > 0 || e.email || e.pw) return
    void run(async () => {
      try { enter(await api.auth.login({ email, password: pw, remember: keep })) }
      catch (err) {
        if (err instanceof ApiError && err.apiCode === Code.EMAIL_UNVERIFIED) {
          // The password was right but the email is not verified: send a fresh code and go to the code screen.
          try { await api.auth.resendCode(email) } catch { /* the code screen has its own resend */ }
          nav('/verify', { state: { email: normEmail(email) } }); return
        }
        if (err instanceof ApiError && err.code === 'rate_limited') { lock(err.retryAfter ? err.retryAfter * 1000 : UI_LOCK_MS); setMsg(err.message); return }
        const n = fails + 1; setFails(n); if (n >= UI_MAX_TRIES) lock()
        setMsg(apiMessage(err))
      }
    })
  }
  return (
    <AuthFrame top={<Link className="btn" to="/sign-up">Create an account</Link>}>
      <h1>Welcome back</h1><p className="lead">Sign in to your Nudge workspace.</p>
      {rs.notice === 'expired' && <div className="callout amber" role="status" style={{ marginBottom: 14 }}><i className="dot round" />Your session ended. Sign in again.</div>}
      {isMock && <><Providers verb="Continue" onUser={enter} onError={setMsg} busy={busy} run={run} /><div className="or">OR</div></>}
      <form onSubmit={submit} noValidate>
        {wait > 0 ? <div className="callout amber" role="alert" style={{ marginBottom: 14 }}><i className="dot round" />Too many attempts. Try again in {wait} seconds.</div>
          : msg && <div className="callout amber" role="alert" style={{ marginBottom: 14 }}><i className="dot round" />{msg}</div>}
        <Field label="Work email" error={show('email')}><input className={'input' + (show('email') ? ' invalid' : '')} {...emailAttrs} autoComplete="username" value={email} onChange={(x) => setEmail(x.target.value)} {...field('email', () => setEmail((v) => normEmail(v)))} placeholder="name@company.com" autoFocus /></Field>
        <Field label="Password" error={show('pw')}>
          <Link className="link field-aside" to="/reset">Forgot password?</Link>
          <PwInput mode="current-password" value={pw} onChange={setPw} bind={field('pw')} invalid={!!show('pw')} />
        </Field>
        <label className="row" style={{ margin: '4px 0 18px', fontSize: 13.5 }}><input type="checkbox" className="check" checked={keep} onChange={(x) => setKeep(x.target.checked)} />Keep me signed in <span className="muted">for 30 days</span></label>
        <button className="btn primary xl" type="submit" disabled={wait > 0 || busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthFrame>
  )
}

export function SignUp() {
  useTitle('Create account')
  const nav = useNavigate()
  const { busy, run } = useSubmit()
  const [type, setType] = useState<'individual' | 'business'>('business')
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [co, setCo] = useState('')
  const [tried, setTried] = useState(false); const { touched, field } = useTouched(); const [msg, setMsg] = useState('')
  /* Field errors the server found, keyed by our field names. Cleared as soon as the person edits the form. */
  const [srv, setSrv] = useState<Record<string, string>>({})
  const sc = pwScore(pw)
  const e = {
    name: personErr(name), email: emailErr(email),
    pw: passwordErr(pw, { email, name }), co: type === 'business' ? nameErr(co, 'company name', 2, LIMITS.company) : '',
  }
  const show = (k: keyof typeof e) => (tried || touched[k] ? e[k] : '') || srv[k] || ''
  const bad = Object.values(e).some(Boolean)
  const label = ['Use 8 or more characters', 'Weak', 'Fair', 'Good', 'Strong'][sc]
  const tip = sc === 2 ? 'add a symbol to make it strong' : sc === 1 ? 'add numbers and capitals' : ''
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault(); setTried(true); setMsg(''); setSrv({})
    if (bad) return
    void run(async () => {
      try {
        await api.auth.register({ name: name.trim(), company: type === 'business' ? co.trim() : undefined, email: normEmail(email), password: pw, type })
        nav('/verify', { state: { email: normEmail(email) } })
      } catch (err) {
        const f = fieldMessages(err)
        setSrv({ name: f.name ?? '', co: f.company ?? '', email: f.email ?? '', pw: f.password ?? '' })
        setMsg(apiMessage(err))
      }
    })
  }
  return (
    <AuthFrame pane="start" done={1} top={<>Have an account? <Link className="link" to="/sign-in">Sign in</Link></>}>
      <h1>Create your workspace</h1><p className="lead">Free for 14 days. No card needed.</p>
      {isMock && <><Providers verb="Sign up" onUser={(u) => { hydrateWorkspace(u); nav('/onboarding/1') }} onError={setMsg} busy={busy} run={run} /><div className="or">OR</div></>}
      <Segmented block label="Account type" style={{ marginBottom: 18 }} value={type} onChange={setType} options={[{ value: 'individual', label: 'Individual' }, { value: 'business', label: 'Business team' }]} />
      <form noValidate onSubmit={submit} onChange={() => setSrv((s) => (Object.keys(s).length ? {} : s))}>
        {msg && <div className="callout amber" role="alert" style={{ marginBottom: 14 }}><i className="dot round" />{msg}</div>}
        <div className={type === 'business' ? 'two' : ''}>
          <Field label="Full name" error={show('name')}><input className={'input' + (show('name') ? ' invalid' : '')} maxLength={LIMITS.name} autoComplete="name" autoCapitalize="words" spellCheck={false} value={name} onChange={(x) => setName(x.target.value)} {...field('name', () => setName((v) => v.replace(/\s+/g, ' ').trim()))} autoFocus /></Field>
          {type === 'business' && <Field label="Company" error={show('co')}><input className={'input' + (show('co') ? ' invalid' : '')} maxLength={LIMITS.company} autoComplete="organization" autoCapitalize="words" spellCheck={false} value={co} onChange={(x) => setCo(x.target.value)} {...field('co', () => setCo((v) => v.replace(/\s+/g, ' ').trim()))} /></Field>}
        </div>
        <Field label="Work email" error={show('email')}><input className={'input' + (show('email') ? ' invalid' : '')} {...emailAttrs} autoComplete="email" value={email} onChange={(x) => setEmail(x.target.value)} {...field('email', () => setEmail((v) => normEmail(v)))} placeholder="name@company.com" /></Field>
        <Field label="Password" error={show('pw')}>
          <PwInput mode="new-password" value={pw} onChange={setPw} bind={field('pw')} invalid={!!show('pw')} />
          <div className={'strength s' + sc}><i /><i /><i /><i /></div>
          <span className="hint"><b className={'sc s' + sc}>{pw ? label : ''}</b> {pw ? (e.pw && !tried ? e.pw : tip) : label}</span>
        </Field>
        <p className="muted tz">Time zone <span className="mono">{browserTimeZone()}</span>, from your browser. <span className="link">Change</span></p>
        <button className="btn primary xl" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="muted terms">By continuing you agree to the <a className="link" href="#" onClick={(x) => x.preventDefault()}>Terms</a> and <a className="link" href="#" onClick={(x) => x.preventDefault()}>Privacy Policy</a>.</p>
      </form>
    </AuthFrame>
  )
}

export function Verify() {
  useTitle('Verify email')
  const nav = useNavigate()
  const rs = useRouterState()
  const { busy, run } = useSubmit()
  /* The address comes from router state, not the URL, so it is not in history, logs or Referer headers.
     It is checked before it is shown, and it is never rendered as anything but text. */
  const email = typeof rs.email === 'string' && emailOk(rs.email) ? normEmail(rs.email) : ''
  const [d, setD] = useState<string[]>(Array(6).fill('')); const [err, setErr] = useState(''); const [left, setLeft] = useState(RESEND_SECONDS)
  const [tries, setTries] = useState(0); const [serverLocked, setServerLocked] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t) }, [left])
  if (!email) return <Navigate to="/sign-up" replace />
  const set = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return
    const n = [...d]; n[i] = v; setD(n); setErr('')
    if (v && i < 5) refs.current[i + 1]?.focus()
  }
  /* Pasted text is untrusted: keep digits only, at most six. */
  const paste = (ev: React.ClipboardEvent) => { const t = ev.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (t) { ev.preventDefault(); setD(t.split('').concat(Array(6).fill('')).slice(0, 6)); refs.current[Math.min(5, t.length)]?.focus() } }
  const locked = serverLocked || tries >= UI_MAX_TRIES
  const submit = () => {
    if (locked) return
    const c = d.join('')
    if (!/^\d{6}$/.test(c)) { setErr('Enter all 6 digits.'); return }
    void run(async () => {
      try { hydrateWorkspace(await api.auth.verifyEmail({ email, code: c })); nav('/onboarding/1', { replace: true }) }
      catch (e) {
        setD(Array(6).fill('')); refs.current[0]?.focus()
        if (e instanceof ApiError && e.apiCode === Code.CODE_ATTEMPTS_EXCEEDED) { setServerLocked(true); setErr(e.message); return }
        if (e instanceof ApiError && e.code === 'rate_limited') { setErr(e.message); return }
        const n = tries + 1; setTries(n)
        setErr(n >= UI_MAX_TRIES ? messageFor(Code.CODE_ATTEMPTS_EXCEEDED, 429) : apiMessage(e))
      }
    })
  }
  const resend = () => void run(async () => {
    try { await api.auth.resendCode(email); setLeft(RESEND_SECONDS); setTries(0); setServerLocked(false); setD(Array(6).fill('')); setErr(''); toast('A new code was sent') }
    catch (e) { setErr(apiMessage(e)); if (e instanceof ApiError && e.retryAfter) setLeft(e.retryAfter) }
  })
  return (
    <AuthFrame pane="start" done={1} top={<>Have an account? <Link className="link" to="/sign-in">Sign in</Link></>}>
      <div className="mail-badge"><Icon n="mail" s={20} /></div>
      <h1>Check your email</h1><p className="lead">We sent a 6-digit code to <b>{email}</b>. It expires in 10 minutes.</p>
      <label className="lbl">Verification code</label>
      <div className="otp" onPaste={paste}>{d.map((x, i) => <input key={i} ref={(el) => { refs.current[i] = el }} className={err ? 'bad' : ''} value={x} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={1} aria-label={'Digit ' + (i + 1)} onChange={(ev) => set(i, ev.target.value)}
        onKeyDown={(ev) => { if (ev.key === 'Backspace' && !x && i > 0) refs.current[i - 1]?.focus(); if (ev.key === 'Enter') submit() }} autoFocus={i === 0} />)}</div>
      {err && <p className="err" role="alert" style={{ marginBottom: 12 }}>{err}</p>}
      <button className="btn primary xl" onClick={submit} disabled={locked || busy}>{busy ? 'Checking…' : 'Verify email'}</button>
      <p className="muted small" style={{ marginTop: 18 }}>Didn’t get it? Check spam, or {left > 0 && !locked ? <>send a new code in <span className="mono">0:{String(left).padStart(2, '0')}</span></> : <button className="link plain" onClick={resend} disabled={busy}>send a new code</button>}</p>
      <p className="muted small">Wrong email? <Link className="link" to="/sign-up">Go back</Link></p>
      {isMock && <p className="muted small" style={{ marginTop: 14 }}>Demo code <button className="plain mono" onClick={() => setD('246810'.split(''))}>246810</button></p>}
    </AuthFrame>
  )
}

export function Reset() {
  useTitle('Reset password')
  const nav = useNavigate()
  const { busy, run } = useSubmit()
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [tried, setTried] = useState(false); const { touched, field } = useTouched()
  const [demoToken, setDemoToken] = useState(''); const [msg, setMsg] = useState('')
  const err = emailErr(email)
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault(); setTried(true); setMsg('')
    if (err) return
    void run(async () => {
      try { const r = await api.auth.requestReset(email); setDemoToken(r.demoToken ?? ''); setSent(true) }
      catch (e) { setSent(false); setMsg(apiMessage(e)) }
    })
  }
  return (
    <AuthFrame pane="security" top={<Link className="btn" to="/sign-up">Create an account</Link>}>
      <h1>Reset your password</h1><p className="lead">Enter your work email and we’ll send you a reset link.</p>
      <form noValidate onSubmit={submit}>
        {msg && <div className="callout amber" role="alert" style={{ marginBottom: 14 }}><i className="dot round" />{msg}</div>}
        <Field label="Work email" error={tried || touched.email ? err : ''}><input className={'input' + ((tried || touched.email) && err ? ' invalid' : '')} {...emailAttrs} autoComplete="email" value={email} onChange={(x) => { setEmail(x.target.value); setSent(false) }} {...field('email', () => setEmail((v) => normEmail(v)))} placeholder="name@company.com" autoFocus /></Field>
        <button className="btn primary xl" type="submit" style={{ marginTop: 6 }} disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>
      {/* The same words for every address, so this page cannot be used to find out who has an account. */}
      {sent && <div className="callout green" role="status" style={{ marginTop: 16 }}><i className="dot round" style={{ background: 'var(--approve)' }} /><span>If an account exists for <b>{email}</b>, a link is on its way. It works once and expires in an hour.</span></div>}
      <p style={{ marginTop: 20, fontSize: 13.5 }}><Link className="link" to="/sign-in">Back to sign in</Link>{sent && demoToken && <> · <button className="link plain" onClick={() => nav('/new-password', { state: { token: demoToken, email: normEmail(email) } })}>Open the link (demo)</button></>}</p>
    </AuthFrame>
  )
}

const TOKEN_OK = /^[\w-]{4,200}$/

export function NewPassword() {
  useTitle('New password')
  const nav = useNavigate()
  const loc = useLocation()
  const rs = useRouterState()
  const { busy, run } = useSubmit()
  /* A real reset link is /new-password?token=…. The token is read once and then removed from the address bar. */
  const urlToken = new URLSearchParams(loc.search).get('token') ?? ''
  const token = typeof rs.token === 'string' && TOKEN_OK.test(rs.token) ? rs.token : TOKEN_OK.test(urlToken) ? urlToken : ''
  const who = typeof rs.email === 'string' && emailOk(rs.email) ? normEmail(rs.email) : ''
  useEffect(() => { if (urlToken) nav('/new-password', { replace: true, state: { token: TOKEN_OK.test(urlToken) ? urlToken : '' } }) }, [urlToken, nav])
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [tried, setTried] = useState(false); const { touched, field } = useTouched(); const [msg, setMsg] = useState('')
  const [dead, setDead] = useState(false); const [srvPw, setSrvPw] = useState('')
  const sc = pwScore(pw)
  const e = { pw: passwordErr(pw, { email: who }), pw2: !pw2 ? 'Confirm your new password.' : pw2 !== pw ? 'Passwords do not match.' : '' }
  const show = (k: 'pw' | 'pw2') => (tried || touched[k] ? e[k] : '') || (k === 'pw' ? srvPw : '')
  if (!token || dead) return (
    <AuthFrame pane="security" top={<Link className="btn" to="/sign-in">Sign in</Link>}>
      <h1>This link is not valid</h1><p className="lead">Reset links work once and expire in an hour. Ask for a new one.</p>
      <Link className="btn primary xl" to="/reset">Send a new link</Link>
    </AuthFrame>
  )
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault(); setTried(true); setMsg(''); setSrvPw('')
    if (e.pw || e.pw2) return
    void run(async () => {
      try { await api.auth.resetPassword({ token, password: pw }); toast('Password updated. Sign in with it.'); nav('/sign-in', { replace: true }) }
      catch (err) {
        if (err instanceof ApiError && err.apiCode === Code.INVALID_TOKEN) { setDead(true); return }
        setSrvPw(fieldMessages(err).password ?? ''); setMsg(apiMessage(err))
      }
    })
  }
  return (
    <AuthFrame pane="security" top={<Link className="btn" to="/sign-in">Sign in</Link>}>
      <h1>Choose a new password</h1><p className="lead">For <span className="mono">{who || 'your account'}</span>. You’ll be signed out on your other devices.</p>
      <form noValidate onSubmit={submit}>
        {msg && <div className="callout amber" role="alert" style={{ marginBottom: 14 }}><i className="dot round" />{msg} <Link className="link" to="/reset">Send a new link</Link></div>}
        <Field label="New password" error={show('pw')}><PwInput mode="new-password" value={pw} onChange={setPw} bind={field('pw')} invalid={!!show('pw')} /><div className={'strength s' + sc}><i /><i /><i /><i /></div><span className="hint"><b className={'sc s' + sc}>{pw ? ['', 'Weak', 'Fair', 'Good', 'Strong'][sc] : ''}</b></span></Field>
        <Field label="Confirm new password" error={show('pw2')}><PwInput mode="new-password" value={pw2} onChange={setPw2} bind={field('pw2')} invalid={!!show('pw2')} /></Field>
        <button className="btn primary xl" type="submit" style={{ marginTop: 6 }} disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </AuthFrame>
  )
}
