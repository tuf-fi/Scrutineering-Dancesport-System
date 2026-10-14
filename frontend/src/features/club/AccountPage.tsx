import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Input, PageHeader, toast } from '../../components/ui/index.ts'
import { useChangeClubPassword, useMessengerLink, useUnlinkMessenger } from '../../hooks/index.ts'

export function AccountPage() {
  const change = useChangeClubPassword()
  const messenger = useMessengerLink()
  const unlink = useUnlinkMessenger()
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
      <PageHeader title="Account" description="Payment news and your password." />

      {messenger.data?.available && (
        <section aria-label="Messenger" className="flex max-w-sm flex-col gap-3">
          <h2 className="text-title font-semibold">Messenger</h2>
          {messenger.data.linked ? (
            <>
              <p className="text-small text-neutral-700">You get a message when a payment is approved or rejected.</p>
              <div>
                <Button variant="secondary" disabled={unlink.isPending} onClick={() => unlink.mutate(undefined, { onSuccess: () => toast.success('Messenger disconnected') })}>
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-small text-neutral-700">Get a message when a payment is approved or rejected. Open the link, then press Get Started.</p>
              <div>
                <a href={messenger.data.url ?? undefined} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-md bg-neutral-900 px-5 text-body font-semibold text-white">
                  Connect Messenger
                </a>
              </div>
            </>
          )}
        </section>
      )}

      <h2 className="text-title font-semibold">Password</h2>
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
