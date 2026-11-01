import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Brand, GoogleG, Icon, MsLogo } from '../components/Icons'
import { RightPane, type Pane } from '../components/AuthPane'
import { Field, emailOk, pwScore, useTitle } from '../components/ui'
import { toast } from '../store'

const DEMO_CODE = '246810'

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

function Providers({ verb, onPick }: { verb: string; onPick: () => void }) {
  return (
    <>
      <button className="provider" type="button" onClick={onPick}><GoogleG />{verb} with Google</button>
      <button className="provider" type="button" onClick={onPick}><MsLogo />{verb} with Microsoft 365</button>
      <button className="provider" type="button" onClick={onPick}><Icon n="lock" s={16} />{verb} with SSO</button>
    </>
  )
}

function PwInput({ value, onChange, invalid, placeholder, id }: { value: string; onChange: (v: string) => void; invalid?: boolean; placeholder?: string; id?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw"><input id={id} className={'input' + (invalid ? ' invalid' : '')} type={show ? 'text' : 'password'} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} autoComplete="off" />
      <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}><Icon n={show ? 'eyeOff' : 'eye'} s={18} /></button></div>
  )
}

export function SignIn() {
  useTitle('Sign in')
  const nav = useNavigate()
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [tried, setTried] = useState(false); const [fail, setFail] = useState(false)
  const e = { email: !emailOk(email) ? 'Enter a valid email address, like name@company.com.' : '', pw: !pw ? 'Enter your password' : '' }
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault(); setTried(true); setFail(false)
    if (e.email || e.pw) return
    if (pw.length < 6) { setFail(true); return }
    nav('/app/home')
  }
  return (
    <AuthFrame top={<Link className="btn" to="/sign-up">Create an account</Link>}>
      <h1>Welcome back</h1><p className="lead">Sign in to your Nudge workspace.</p>
      <Providers verb="Continue" onPick={() => nav('/app/home')} />
      <div className="or">OR</div>
      <form onSubmit={submit} noValidate>
        {fail && <div className="callout amber" style={{ marginBottom: 14 }}><i className="dot round" />That email and password do not match. Try again or reset your password.</div>}
        <Field label="Work email" error={tried ? e.email : ''}><input className={'input' + (tried && e.email ? ' invalid' : '')} value={email} onChange={(x) => setEmail(x.target.value)} placeholder="name@company.com" autoFocus /></Field>
        <Field label="Password" error={tried ? e.pw : ''}>
          <Link className="link field-aside" to="/reset">Forgot password?</Link>
          <PwInput value={pw} onChange={setPw} invalid={tried && !!e.pw} />
        </Field>
        <label className="row" style={{ margin: '4px 0 18px', fontSize: 13.5 }}><input type="checkbox" className="check" defaultChecked />Keep me signed in <span className="muted">for 30 days</span></label>
        <button className="btn primary xl" type="submit">Sign in</button>
        <p className="muted demo">Demo workspace <span className="mono">mahad@acme.com · Nudge2026</span></p>
      </form>
    </AuthFrame>
  )
}

export function SignUp() {
  useTitle('Create account')
  const nav = useNavigate()
  const [type, setType] = useState<'Individual' | 'Business'>('Business')
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [co, setCo] = useState(''); const [tried, setTried] = useState(false)
  const sc = pwScore(pw)
  const e = {
    name: name.trim().length < 2 ? 'Enter your full name' : '', email: !emailOk(email) ? 'Enter a valid email address, like name@company.com.' : '',
    pw: pw.length < 8 ? 'Use at least 8 characters' : sc < 3 ? 'Add a number and a capital letter' : '', co: type === 'Business' && co.trim().length < 2 ? 'Enter your company name' : '',
  }
  const bad = Object.values(e).some(Boolean)
  const label = ['Use 8 or more characters', 'Weak', 'Fair', 'Good', 'Strong'][sc]
  const tip = sc === 2 ? 'add a symbol to make it strong' : sc === 1 ? 'add numbers and capitals' : ''
  return (
    <AuthFrame pane="start" done={1} top={<>Have an account? <Link className="link" to="/sign-in">Sign in</Link></>}>
      <h1>Create your workspace</h1><p className="lead">Free for 14 days. No card needed.</p>
      <Providers verb="Sign up" onPick={() => nav('/onboarding/1')} />
      <div className="or">OR</div>
      <div className="type-toggle" role="radiogroup">{(['Individual', 'Business'] as const).map((t) => <button key={t} type="button" role="radio" aria-checked={type === t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t === 'Business' ? 'Business team' : t}</button>)}</div>
      <form noValidate onSubmit={(ev) => { ev.preventDefault(); setTried(true); if (bad) return; nav('/verify?email=' + encodeURIComponent(email)) }}>
        <div className={type === 'Business' ? 'two' : ''}>
          <Field label="Full name" error={tried ? e.name : ''}><input className={'input' + (tried && e.name ? ' invalid' : '')} value={name} onChange={(x) => setName(x.target.value)} autoFocus /></Field>
          {type === 'Business' && <Field label="Company" error={tried ? e.co : ''}><input className={'input' + (tried && e.co ? ' invalid' : '')} value={co} onChange={(x) => setCo(x.target.value)} /></Field>}
        </div>
        <Field label="Work email" error={tried || (email.length > 3 && email.includes('@')) ? e.email : ''}><input className={'input' + ((tried || email.includes('@')) && e.email ? ' invalid' : '')} value={email} onChange={(x) => setEmail(x.target.value)} placeholder="name@company.com" /></Field>
        <Field label="Password" error={tried ? e.pw : ''}>
          <PwInput value={pw} onChange={setPw} invalid={tried && !!e.pw} />
          <div className={'strength s' + sc}><i /><i /><i /><i /></div>
          <span className="hint"><b className={'sc s' + sc}>{pw ? label : ''}</b> {pw ? tip : label}</span>
        </Field>
        <p className="muted tz">Time zone <span className="mono">{Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi'}</span>, from your browser. <span className="link">Change</span></p>
        <button className="btn primary xl" type="submit">Create account</button>
        <p className="muted terms">By continuing you agree to the <a className="link" href="#" onClick={(x) => x.preventDefault()}>Terms</a> and <a className="link" href="#" onClick={(x) => x.preventDefault()}>Privacy Policy</a>.</p>
      </form>
    </AuthFrame>
  )
}

export function Verify() {
  useTitle('Verify email')
  const nav = useNavigate()
  const loc = useLocation()
  const email = new URLSearchParams(loc.search).get('email') ?? 'you@company.com'
  const [d, setD] = useState<string[]>(Array(6).fill('')); const [err, setErr] = useState(''); const [left, setLeft] = useState(42)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t) }, [left])
  const set = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return
    const n = [...d]; n[i] = v; setD(n); setErr('')
    if (v && i < 5) refs.current[i + 1]?.focus()
  }
  const paste = (ev: React.ClipboardEvent) => { const t = ev.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (t) { ev.preventDefault(); setD(t.split('').concat(Array(6).fill('')).slice(0, 6)); refs.current[Math.min(5, t.length)]?.focus() } }
  const submit = () => { const c = d.join(''); if (c.length < 6) { setErr('Enter all 6 digits'); return } if (c !== DEMO_CODE) { setErr('That code is not right. Check the digits and try again.'); return } nav('/onboarding/1') }
  return (
    <AuthFrame pane="start" done={1} top={<>Have an account? <Link className="link" to="/sign-in">Sign in</Link></>}>
      <div className="mail-badge"><Icon n="mail" s={20} /></div>
      <h1>Check your email</h1><p className="lead">We sent a 6-digit code to <b>{email}</b>. It expires in 10 minutes.</p>
      <label className="lbl">Verification code</label>
      <div className="otp" onPaste={paste}>{d.map((x, i) => <input key={i} ref={(el) => { refs.current[i] = el }} className={err ? 'bad' : ''} value={x} inputMode="numeric" maxLength={1} aria-label={'Digit ' + (i + 1)} onChange={(ev) => set(i, ev.target.value)}
        onKeyDown={(ev) => { if (ev.key === 'Backspace' && !x && i > 0) refs.current[i - 1]?.focus(); if (ev.key === 'Enter') submit() }} autoFocus={i === 0} />)}</div>
      {err && <p className="err" style={{ marginBottom: 12 }}>{err}</p>}
      <button className="btn primary xl" onClick={submit}>Verify email</button>
      <p className="muted small" style={{ marginTop: 18 }}>Didn’t get it? Check spam, or {left > 0 ? <>send a new code in <span className="mono">0:{String(left).padStart(2, '0')}</span></> : <button className="link plain" onClick={() => { setLeft(42); toast('A new code was sent') }}>send a new code</button>}</p>
      <p className="muted small">Wrong email? <Link className="link" to="/sign-up">Go back</Link></p>
      <p className="muted small" style={{ marginTop: 14 }}>Demo code <button className="plain mono" onClick={() => setD(DEMO_CODE.split(''))}>{DEMO_CODE}</button></p>
    </AuthFrame>
  )
}

export function Reset() {
  useTitle('Reset password')
  const nav = useNavigate()
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [tried, setTried] = useState(false)
  const err = !emailOk(email) ? 'Enter a valid email address, like name@company.com.' : ''
  return (
    <AuthFrame pane="security" top={<Link className="btn" to="/sign-up">Create an account</Link>}>
      <h1>Reset your password</h1><p className="lead">Enter your work email and we’ll send you a reset link.</p>
      <form noValidate onSubmit={(ev) => { ev.preventDefault(); setTried(true); if (!err) setSent(true) }}>
        <Field label="Work email" error={tried ? err : ''}><input className={'input' + (tried && err ? ' invalid' : '')} value={email} onChange={(x) => { setEmail(x.target.value); setSent(false) }} placeholder="name@company.com" autoFocus /></Field>
        <button className="btn primary xl" type="submit" style={{ marginTop: 6 }}>Send reset link</button>
      </form>
      {sent && <div className="callout green" style={{ marginTop: 16 }}><i className="dot round" style={{ background: 'var(--approve)' }} /><span>If <b>{email}</b> has an account, a link is on its way. It works once and expires in an hour.</span></div>}
      <p style={{ marginTop: 20, fontSize: 13.5 }}><Link className="link" to="/sign-in">Back to sign in</Link>{sent && <> · <button className="link plain" onClick={() => nav('/new-password')}>Open the link (demo)</button></>}</p>
    </AuthFrame>
  )
}

export function NewPassword() {
  useTitle('New password')
  const nav = useNavigate()
  const [pw, setPw] = useState(''); const [pw2, setPw2] = useState(''); const [tried, setTried] = useState(false)
  const sc = pwScore(pw)
  const e = { pw: pw.length < 8 ? 'Use at least 8 characters' : sc < 3 ? 'Add a number and a capital letter' : '', pw2: pw2 !== pw || !pw2 ? 'Passwords do not match.' : '' }
  return (
    <AuthFrame pane="security" top={<Link className="btn" to="/sign-in">Sign in</Link>}>
      <h1>Choose a new password</h1><p className="lead">For <span className="mono">mahad@acme.com</span>. You’ll be signed out on your other devices.</p>
      <form noValidate onSubmit={(ev) => { ev.preventDefault(); setTried(true); if (e.pw || e.pw2) return; toast('Password updated. Sign in with it.'); nav('/sign-in') }}>
        <Field label="New password" error={tried ? e.pw : ''}><PwInput value={pw} onChange={setPw} invalid={tried && !!e.pw} /><div className={'strength s' + sc}><i /><i /><i /><i /></div><span className="hint"><b className={'sc s' + sc}>{pw ? ['', 'Weak', 'Fair', 'Good', 'Strong'][sc] : ''}</b></span></Field>
        <Field label="Confirm new password" error={tried || pw2 ? e.pw2 : ''}><PwInput value={pw2} onChange={setPw2} invalid={(tried || !!pw2) && !!e.pw2} /></Field>
        <button className="btn primary xl" type="submit" style={{ marginTop: 6 }}>Save new password</button>
      </form>
    </AuthFrame>
  )
}
