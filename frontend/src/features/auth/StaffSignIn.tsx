import { Link, Navigate, useNavigate } from 'react-router'
import { roleHome } from '../../app/nav.ts'
import { useSignInStaff } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { AuthShell } from './AuthShell.tsx'
import { CredentialsForm } from './CredentialsForm.tsx'
import { DevHint } from './DevHint.tsx'

export function StaffSignIn() {
  const user = useAuth((s) => s.user)
  const signIn = useAuth((s) => s.signIn)
  const navigate = useNavigate()
  const staff = useSignInStaff()

  if (user) return <Navigate to={roleHome[user.role]} replace />

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
      <CredentialsForm
        idLabel="Username"
        idAutoComplete="username"
        onSubmit={async (username, password) => {
          const session = await staff.mutateAsync({ username, password })
          signIn(session)
          navigate(roleHome[session.role], { replace: true })
        }}
      />
    </AuthShell>
  )
}
