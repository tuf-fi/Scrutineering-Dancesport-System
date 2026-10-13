import { Link, Navigate, useNavigate } from 'react-router'
import { roleHome } from '../../app/nav.ts'
import { useSignInClub } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { AuthShell } from './AuthShell.tsx'
import { CredentialsForm } from './CredentialsForm.tsx'
import { DevHint } from './DevHint.tsx'

export function ClubSignIn() {
  const user = useAuth((s) => s.user)
  const signIn = useAuth((s) => s.signIn)
  const navigate = useNavigate()
  const club = useSignInClub()

  if (user) return <Navigate to={roleHome[user.role]} replace />

  return (
    <AuthShell
      title="Club sign-in"
      footer={
        <>
          <p className="text-neutral-600">
            New club?{' '}
            <Link to="/club/sign-up" className="font-semibold text-neutral-900 underline underline-offset-4">
              Register your club
            </Link>
          </p>
          <p className="text-neutral-600">
            Competition staff?{' '}
            <Link to="/login" className="font-semibold text-neutral-900 underline underline-offset-4">
              Staff sign-in
            </Link>
          </p>
          <DevHint kind="club" />
        </>
      }
    >
      <CredentialsForm
        idLabel="Email"
        idType="email"
        idAutoComplete="email"
        onSubmit={async (email, password) => {
          const session = await club.mutateAsync({ email, password })
          signIn(session)
          navigate(roleHome[session.role], { replace: true })
        }}
      />
    </AuthShell>
  )
}
