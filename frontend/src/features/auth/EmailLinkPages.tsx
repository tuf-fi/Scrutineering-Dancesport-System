import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, Input } from '../../components/ui/index.ts'
import { useForgotPassword, useResetPassword, useVerifyEmail } from '../../hooks/index.ts'
import { passwordMeetsRules } from '../../lib/passwordRules.ts'
import { PasswordRules } from '../athlete/PasswordRules.tsx'
import { AuthShell } from './AuthShell.tsx'

type Kind = 'athlete' | 'coach' | 'team'
const kindOf = (value: string | null): Kind => (value === 'coach' || value === 'team' ? value : 'athlete')

const SIGN_IN_LINK = 'font-semibold text-neutral-900 underline underline-offset-4'

// Asks for the email of an athlete, coach or team account and sends a link to choose a new password. The answer never says
// whether the email has an account.
export function ForgotPasswordPage() {
  const [params] = useSearchParams()
  const kind = kindOf(params.get('as'))
  const ask = useForgotPassword()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!email.trim()) return setError('Enter your email address.')
    try {
      await ask.mutateAsync({ role: kind, email })
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the email. Try again.')
    }
  }

  return (
    <AuthShell title="Forgot your password?" description="Enter the email of your account and we send you a link to choose a new one.">
      {sent ? (
        <div className="flex flex-col gap-6">
          <p role="status" className="text-body text-neutral-800">
            If that email has an account, we sent a link to it. It works once, for an hour. Check your spam folder too.
          </p>
          <Link to={`/login?as=${kind}`} className={`${SIGN_IN_LINK} text-small`}>
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} required autoFocus />
          <Button type="submit" size="lg" disabled={ask.isPending} className="w-full">
            {ask.isPending ? 'Sending…' : 'Send the link'}
          </Button>
          <Link to={`/login?as=${kind}`} className={`${SIGN_IN_LINK} text-small`}>
            Back to sign in
          </Link>
        </form>
      )}
    </AuthShell>
  )
}

// The page the emailed link opens: choose a new password, once
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const reset = useResetPassword()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const matches = password.length > 0 && password === confirm
  const ready = passwordMeetsRules(password) && matches

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!ready) return
    try {
      const { role } = await reset.mutateAsync({ token, password })
      navigate(`/login?as=${role}&reset=1`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the password. Try again.')
    }
  }

  return (
    <AuthShell title="Choose a new password" description="You are signed out everywhere once it is changed.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
        <Input label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        <PasswordRules password={password} matches={matches} />
        {error && (
          <p role="alert" className="text-small text-danger">
            {error} <Link to="/forgot-password" className={SIGN_IN_LINK}>Ask for a new link</Link>
          </p>
        )}
        <Button type="submit" size="lg" disabled={reset.isPending || !ready} className="w-full">
          {reset.isPending ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </AuthShell>
  )
}

// The page the confirmation link opens: it confirms the address as soon as it loads
export function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const verify = useVerifyEmail()
  const [state, setState] = useState<'working' | 'done' | string>('working')
  const started = useRef(false)

  useEffect(() => {
    // Once only: the link works once, and a second call would report it as used
    if (started.current) return
    started.current = true
    verify.mutateAsync(token).then(
      () => setState('done'),
      (e: unknown) => setState(e instanceof Error ? e.message : 'Could not confirm your email. Try again.'),
    )
  }, [token, verify])

  return (
    <AuthShell title={state === 'done' ? 'Email confirmed' : 'Confirm your email'} description={state === 'working' ? 'One moment.' : undefined}>
      {state === 'done' ? (
        <div className="flex flex-col gap-6">
          <p role="status" className="text-body text-neutral-800">Your email address is confirmed. You can use your whole account now.</p>
          <Link to="/login" className={`${SIGN_IN_LINK} text-small`}>
            Go to your account
          </Link>
        </div>
      ) : state !== 'working' ? (
        <div className="flex flex-col gap-6">
          <p role="alert" className="text-body text-danger">{state}</p>
          <Link to="/login" className={`${SIGN_IN_LINK} text-small`}>
            Sign in to ask for a new link
          </Link>
        </div>
      ) : null}
    </AuthShell>
  )
}
