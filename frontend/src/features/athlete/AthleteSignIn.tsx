import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { roleHome } from '../../app/nav.ts'
import { useAuth } from '../../stores/auth.ts'
import { AuthShell } from '../auth/AuthShell.tsx'
import { ACCOUNT_COPY, AccountForm, type AccountKind, type AccountMode } from './AccountForm.tsx'

export function AthleteSignIn() {
  return <AccountSignIn kind="athlete" />
}

export function MemberSignIn({ kind }: { kind: 'coach' | 'team' }) {
  return <AccountSignIn kind={kind} />
}

// The sign-in page for athletes, coaches and teams. Who is signing in comes from the navbar's dialog (?as=coach), athlete by default.
export function SignInPage() {
  const user = useAuth((s) => s.user)
  const [params] = useSearchParams()
  const asked = params.get('as')
  const kind: AccountKind = asked === 'coach' || asked === 'team' ? asked : 'athlete'
  const [mode, setMode] = useState<AccountMode>('sign-in')
  if (user) return <Navigate to={roleHome[user.role]} replace />

  const copy = ACCOUNT_COPY[kind]
  const creating = mode === 'sign-up'
  return (
    <AuthShell title={creating ? copy.create : copy.title} description={creating ? copy.createNote : copy.signInNote}>
      {params.get('reset') && <p role="status" className="mb-6 text-small font-medium text-success">Your password is changed. Sign in with the new one.</p>}
      <AccountForm key={kind} kind={kind} mode={mode} onMode={setMode} />
    </AuthShell>
  )
}

function AccountSignIn({ kind }: { kind: AccountKind }) {
  const user = useAuth((s) => s.user)
  const [mode, setMode] = useState<AccountMode>('sign-in')
  const copy = ACCOUNT_COPY[kind]
  if (user) return <Navigate to={roleHome[user.role]} replace />

  const creating = mode === 'sign-up'
  return (
    <AuthShell title={creating ? copy.create : copy.title} description={creating ? copy.createNote : copy.signInNote}>
      <AccountForm kind={kind} mode={mode} onMode={setMode} />
    </AuthShell>
  )
}
