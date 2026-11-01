import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { roleHome } from '../../app/nav.ts'
import { Button, Input } from '../../components/ui/index.ts'
import { useSignInAthlete, useSignUpAthlete } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { AuthShell } from '../auth/AuthShell.tsx'

type Mode = 'sign-in' | 'sign-up'

export function AthleteSignIn() {
  const user = useAuth((s) => s.user)
  const signIn = useAuth((s) => s.signIn)
  const navigate = useNavigate()
  const signInMutation = useSignInAthlete()
  const signUpMutation = useSignUpAthlete()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={roleHome[user.role]} replace />

  const creating = mode === 'sign-up'
  const pending = signInMutation.isPending || signUpMutation.isPending

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const session = creating
        ? await signUpMutation.mutateAsync({ name, email, password })
        : await signInMutation.mutateAsync({ email, password })
      signIn(session)
      navigate(roleHome[session.role], { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in. Try again.')
    }
  }

  function switchMode() {
    setError(null)
    setMode(creating ? 'sign-in' : 'sign-up')
  }

  return (
    <AuthShell
      title={creating ? 'Create your account' : 'Athlete sign-in'}
      footer={
        <>
          <p className="text-neutral-600">
            {creating ? 'Already have an account?' : 'New here?'}{' '}
            <button type="button" onClick={switchMode} className="font-semibold text-neutral-900 underline underline-offset-4">
              {creating ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="text-neutral-600">
            Adjudicator?{' '}
            <Link to="/adjudicator" className="font-semibold text-neutral-900 underline underline-offset-4">
              Sign in with your PIN
            </Link>
          </p>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {creating && <Input label="Full name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />}
        <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus={!creating} />
        <Input
          label="Password"
          type="password"
          autoComplete={creating ? 'new-password' : 'current-password'}
          hint={creating ? 'At least 8 characters.' : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
          required
        />
        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? (creating ? 'Creating…' : 'Signing in…') : creating ? 'Create account' : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}
