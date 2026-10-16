import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { roleHome } from '../../app/nav.ts'
import { Brand } from '../../components/Brand.tsx'
import { CompetitionPanel } from '../auth/CompetitionPanel.tsx'
import { DevHint } from '../auth/DevHint.tsx'
import { useCompetitions, useSignInAdjudicator } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { PinKeypad } from './PinKeypad.tsx'

const PIN_LENGTH = 4

// One column on phones and tablets; competition panel beside it from laptop width
export function AdjudicatorSignIn() {
  const user = useAuth((s) => s.user)
  const signIn = useAuth((s) => s.signIn)
  const navigate = useNavigate()
  const { data: competitions } = useCompetitions()
  const signInWithPin = useSignInAdjudicator()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (user) return <Navigate to={roleHome[user.role]} replace />

  function handleChange(next: string) {
    setError(null)
    setPin(next)
    if (next.length < PIN_LENGTH) return
    signInWithPin.mutate(next, {
      onSuccess: (session) => {
        signIn(session)
        navigate(roleHome[session.role], { replace: true })
      },
      onError: (e) => {
        setError(e.message)
        setPin('')
      },
    })
  }

  return (
    <div className="grid h-dvh overflow-hidden lg:grid-cols-2">
      <div className="mx-auto flex w-full max-w-md flex-col justify-between gap-[3dvh] px-4 py-[3dvh] sm:max-w-xl sm:px-8 lg:max-w-none lg:px-20">
        <div className="flex items-center gap-4">
          <Brand size="md" />
          <p className="border-l border-neutral-200 pl-4 text-small text-neutral-600">{competitions?.[0]?.name}</p>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col gap-[4dvh]">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Enter your PIN</h1>
            <p className="text-small text-neutral-500">The scrutineer gave you a {PIN_LENGTH}-digit PIN.</p>
          </div>
          <PinKeypad
            value={pin}
            length={PIN_LENGTH}
            onChange={handleChange}
            disabled={signInWithPin.isPending}
            error={error}
          />
        </div>

        <div className="flex flex-col gap-3 text-small">
          <p className="text-neutral-600">
            Staff?{' '}
            <Link to="/login" className="font-semibold text-neutral-900 underline underline-offset-4">
              Staff sign-in
            </Link>
          </p>
          <DevHint kind="pin" />
        </div>
      </div>
      <CompetitionPanel />
    </div>
  )
}
