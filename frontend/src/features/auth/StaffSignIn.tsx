import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { roleHome } from '../../app/nav.ts'
import { ApiError } from '../../api/http.ts'
import { Button, Input } from '../../components/ui/index.ts'
import { useSignInStaff } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { AuthShell } from './AuthShell.tsx'
import { CredentialsForm } from './CredentialsForm.tsx'
import { DevHint } from './DevHint.tsx'

// The second step, for an account with two-step sign-in on: a code from the authenticator app, or a recovery code
function CodeForm({ onSubmit, onBack }: { onSubmit: (code: string) => Promise<void>; onBack: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)
    try {
      await onSubmit(code)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in. Try again.')
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Input
        label="Code from your app, or a recovery code"
        autoComplete="one-time-code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={error ?? undefined}
        required
        autoFocus
        className="font-mono"
      />
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? 'Signing in…' : 'Sign in'}
      </Button>
      <Button type="button" variant="ghost" onClick={onBack}>
        Back
      </Button>
    </form>
  )
}

export function StaffSignIn() {
  const user = useAuth((s) => s.user)
  const signIn = useAuth((s) => s.signIn)
  const navigate = useNavigate()
  const staff = useSignInStaff()
  // Set once the password was right and the account wants a code as well
  const [asking, setAsking] = useState<{ username: string; password: string } | null>(null)

  if (user) return <Navigate to={roleHome[user.role]} replace />

  async function finish(username: string, password: string, code?: string) {
    const session = await staff.mutateAsync({ username, password, code })
    signIn(session)
    navigate(roleHome[session.role], { replace: true })
  }

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          <p className="text-neutral-600">
            Adjudicator?{' '}
            <Link to="/adjudicator" className="font-semibold text-neutral-900 underline underline-offset-4">
              Sign in with your PIN
            </Link>
          </p>
          <p className="text-neutral-600">
            Club or coach?{' '}
            <Link to="/club/sign-in" className="font-semibold text-neutral-900 underline underline-offset-4">
              Club sign-in
            </Link>
          </p>
          <DevHint kind="staff" />
        </>
      }
    >
      {asking ? (
        <CodeForm onSubmit={(code) => finish(asking.username, asking.password, code)} onBack={() => setAsking(null)} />
      ) : (
        <CredentialsForm
          idLabel="Username"
          idAutoComplete="username"
          onSubmit={async (username, password) => {
            try {
              await finish(username, password)
            } catch (e) {
              // 428: the password was right and a code is needed next
              if (e instanceof ApiError && e.status === 428) return setAsking({ username, password })
              throw e
            }
          }}
        />
      )}
    </AuthShell>
  )
}
