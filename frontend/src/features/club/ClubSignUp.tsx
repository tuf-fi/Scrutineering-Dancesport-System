import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { roleHome } from '../../app/nav.ts'
import { Button, Input } from '../../components/ui/index.ts'
import { useSignUpClub } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { AuthShell } from '../auth/AuthShell.tsx'

export function ClubSignUp() {
  const user = useAuth((s) => s.user)
  const signIn = useAuth((s) => s.signIn)
  const navigate = useNavigate()
  const signUp = useSignUpClub()
  const [values, setValues] = useState({ name: '', contactName: '', contactEmail: '', contactPhone: '', password: '' })
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={roleHome[user.role]} replace />

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    signUp.mutate(values, {
      onSuccess: (session) => {
        signIn(session)
        navigate(roleHome[session.role], { replace: true })
      },
      onError: (e) => setError(e.message),
    })
  }

  return (
    <AuthShell
      title="Register your club"
      footer={
        <p className="text-neutral-600">
          Already registered?{' '}
          <Link to="/club/sign-in" className="font-semibold text-neutral-900 underline underline-offset-4">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Input label="Club name" value={values.name} onChange={set('name')} autoFocus />
        <Input label="Contact person" value={values.contactName} onChange={set('contactName')} />
        <Input label="Email" type="email" autoComplete="email" value={values.contactEmail} onChange={set('contactEmail')} />
        <Input label="Mobile number" type="tel" autoComplete="tel" value={values.contactPhone} onChange={set('contactPhone')} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={values.password}
          onChange={set('password')}
          error={error ?? undefined}
        />
        <Button type="submit" size="lg" disabled={signUp.isPending} className="mt-1 w-full">
          {signUp.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}
