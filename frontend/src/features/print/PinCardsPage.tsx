import { useParams } from 'react-router'
import { QrCode } from '../../components/QrCode.tsx'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useAdjudicatorPins, useAdjudicators, useCompetition } from '../../hooks/index.ts'

// The address a phone opens: the PIN follows a #, which the browser never sends to the server
const signInAddress = (pin: string) => `${window.location.origin}/adjudicator#pin=${pin}`

// One card per adjudicator to hand out: the PIN to type, and a QR code that signs the phone in. Cut along the lines.
export function PinCardsPage() {
  const { competitionId = '' } = useParams()
  const competition = useCompetition(competitionId)
  const adjudicators = useAdjudicators()
  const pins = useAdjudicatorPins(competitionId)

  if (competition.isError || adjudicators.isError || pins.isError) {
    return <ErrorState onRetry={() => void Promise.all([competition.refetch(), adjudicators.refetch(), pins.refetch()])} />
  }
  if (!competition.data || !adjudicators.data || !pins.data) return <Skeleton className="h-96 w-full" />

  const cards = [...adjudicators.data]
    .sort((a, b) => a.letter.localeCompare(b.letter))
    .flatMap((a) => {
      const pin = pins.data.find((p) => p.adjudicatorId === a.id)?.pin
      return pin ? [{ adjudicator: a, pin }] : []
    })

  if (cards.length === 0) {
    return <EmptyState title="No PINs yet" description="Generate the PINs on the Adjudicators screen first." />
  }

  return (
    <div className="flex flex-col gap-4 text-neutral-900">
      <header className="flex flex-col gap-1 print:hidden">
        <h1 className="text-title font-semibold">PIN cards: {competition.data.name}</h1>
        <p className="text-small text-neutral-600">
          Keep these private. Each card works on one phone at a time, and only around the competition date.
        </p>
      </header>

      <ul aria-label="PIN cards" className="grid grid-cols-2 border-l border-t border-dashed border-neutral-400">
        {cards.map(({ adjudicator, pin }) => (
          <li key={adjudicator.id} className="break-inside-avoid border-b border-r border-dashed border-neutral-400 p-5">
            <article className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="text-small text-neutral-600">{competition.data.name}</p>
                <h2 className="text-title font-semibold">
                  <span className="mr-2 font-mono">{adjudicator.letter}</span>
                  {adjudicator.name}
                </h2>
                <p className="mt-2 text-small text-neutral-600">PIN</p>
                <p className="font-mono text-[22pt] font-semibold tracking-[0.2em] tabular-nums">{pin}</p>
                <p className="text-[8pt] text-neutral-600">Open {window.location.host}/adjudicator and enter the PIN, or scan the code.</p>
              </div>
              <QrCode value={signInAddress(pin)} label={`Sign-in code for ${adjudicator.name}`} size={120} />
            </article>
          </li>
        ))}
      </ul>
    </div>
  )
}
