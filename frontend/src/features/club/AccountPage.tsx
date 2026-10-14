import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Input, PageHeader, toast } from '../../components/ui/index.ts'
import { useChangeClubPassword } from '../../hooks/index.ts'

export function AccountPage() {
  const change = useChangeClubPassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    change.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          toast.success('Password changed')
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Account" description="Change your password." />
      <form onSubmit={submit} noValidate className="flex max-w-sm flex-col gap-5">
        <Input label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={error ?? undefined}
        />
        <div>
          <Button type="submit" disabled={change.isPending || !current || !next}>
            {change.isPending ? 'Saving…' : 'Change password'}
          </Button>
        </div>
      </form>
      <p className="text-small text-neutral-600">
        To have your account erased, ask the organizer. See the{' '}
        <Link to="/privacy" className="font-semibold text-neutral-900 underline underline-offset-4">
          privacy notice
        </Link>
        .
      </p>
    </div>
  )
}
