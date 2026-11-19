import { Role } from '@bis/shared'
import { useState } from 'react'
import { Button, Dialog, toast } from '../../components/ui/index.ts'
import { useResultsRelease, useRevealResults } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'

export function ResultsRelease({ competitionId }: { competitionId: string }) {
  const role = useAuth((s) => s.user?.role)
  const release = useResultsRelease(competitionId)
  const reveal = useRevealResults()
  const [confirming, setConfirming] = useState(false)
  const data = release.data
  if (!data?.hold) return null
  const canReveal = role === Role.Scrutineer || role === Role.Chairperson

  if (data.revealedAt) {
    return (
      <p className="rounded-lg border border-neutral-200 px-4 py-3 text-small text-neutral-600">
        The results were revealed at {new Date(data.revealedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Anything published now is public at once.
      </p>
    )
  }

  function run() {
    reveal.mutate(competitionId, {
      onSuccess: () => {
        toast.success('Results revealed')
        setConfirming(false)
      },
      onError: (e) => {
        setConfirming(false)
        toast.error(e.message)
      },
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-300 px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-small font-semibold text-neutral-900">Results are held until the awarding</p>
        <p className="text-small text-neutral-600">
          {data.waiting} of {data.total} {data.total === 1 ? 'final is' : 'finals are'} published and waiting. Guests and the compere cannot see them yet.
        </p>
      </div>
      {canReveal && (
        <Button disabled={data.waiting === 0} onClick={() => setConfirming(true)}>
          Reveal results
        </Button>
      )}
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Reveal the results?"
        description={`The results of ${data.waiting} ${data.waiting === 1 ? 'event' : 'events'} become public on the website and the compere screen at once. This cannot be undone.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button disabled={reveal.isPending} onClick={run}>
              {reveal.isPending ? 'Revealing…' : 'Reveal results'}
            </Button>
          </>
        }
      />
    </div>
  )
}
