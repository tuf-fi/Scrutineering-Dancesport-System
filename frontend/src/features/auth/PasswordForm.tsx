import { useState, type FormEvent } from 'react'
import { Button, Input, toast } from '../../components/ui/index.ts'
import { passwordMeetsRules } from '../../lib/passwordRules.ts'
import { PasswordRules } from '../athlete/PasswordRules.tsx'

interface PasswordChange {
  mutate: (input: { current: string; next: string }, options: { onSuccess: () => void; onError: (error: Error) => void }) => void
  isPending: boolean
}

// Current password, a new one twice, and the rules ticking as it is typed; the same for athletes and staff
export function PasswordForm({ change }: { change: PasswordChange }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | undefined>()

  const matches = next.length > 0 && next === confirm
  const ready = current.length > 0 && passwordMeetsRules(next) && matches

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!ready) return
    setError(undefined)
    change.mutate(
      { current, next },
      {
        onSuccess: () => {
          toast.success('Password changed')
          setCurrent('')
          setNext('')
          setConfirm('')
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex max-w-md flex-col gap-4">
      <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={error} />
      <Input label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
      <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      <PasswordRules password={next} matches={matches} />
      <div>
        <Button type="submit" disabled={!ready || change.isPending}>
          {change.isPending ? 'Saving…' : 'Change password'}
        </Button>
      </div>
    </form>
  )
}
