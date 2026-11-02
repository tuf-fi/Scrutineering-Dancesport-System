import { PIN_LENGTH } from '@bis/shared'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { roleHome } from '../../app/nav.ts'
import { useSignInAdjudicator } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { PinKeypad } from '../adjudicator/PinKeypad.tsx'

// The adjudicator's PIN pad; signs in as soon as the last digit is typed
export function PinSignIn() {
  const signIn = useAuth((s) => s.signIn)
  const navigate = useNavigate()
  const signInWithPin = useSignInAdjudicator()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { mutate } = signInWithPin
  const submit = useCallback(
    (value: string) =>
      mutate(value, {
        onSuccess: (session) => {
          signIn(session)
          navigate(roleHome[session.role], { replace: true })
        },
        onError: (e) => {
          setError(e.message)
          setPin('')
        },
      }),
    [mutate, signIn, navigate],
  )

  // A QR code on the PIN card opens /adjudicator#pin=123456. The PIN is after the #, which the browser never sends to
  // the server, and it is taken off the address at once so it is not left in the history.
  useEffect(() => {
    const match = /^#pin=(\d+)$/.exec(window.location.hash)
    if (!match) return
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    if (match[1]!.length === PIN_LENGTH) submit(match[1]!)
  }, [submit])

  function handleChange(next: string) {
    setError(null)
    setPin(next)
    if (next.length >= PIN_LENGTH) submit(next)
  }

  return <PinKeypad value={pin} length={PIN_LENGTH} onChange={handleChange} disabled={signInWithPin.isPending} error={error} />
}
