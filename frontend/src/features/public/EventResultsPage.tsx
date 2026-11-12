import { RoundStatus } from '@bis/shared'
import { useParams } from 'react-router'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useCompetition, useEvent, useRecallTable, useRounds, useCatalog } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances, formatDate } from '../../lib/format.ts'
import { FinalMarks } from './FinalMarks.tsx'
import { PublicHeader } from './PublicHeader.tsx'
import { ResultsTable } from './ResultsTable.tsx'

// Who went through a published round, by back number
function Qualified({ roundId, label }: { roundId: string; label: string }) {
  const recall = useRecallTable(roundId)
  const numbers = (recall.data?.rows ?? [])
    .filter((r) => r.outcome === 'recalled')
    .map((r) => r.backNumber)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b)

  return (
    <section aria-label={label} className="flex flex-col gap-2 border-t border-neutral-200 py-5 sm:px-3">
      <h3 className="text-small font-medium text-neutral-900">{label}</h3>
      <p className="font-mono text-small tabular-nums leading-relaxed text-neutral-600">{numbers.join('  ')}</p>
    </section>
  )
}

export function EventResultsPage() {
  const { eventGrade } = useCatalog()
  const { competitionId = '', eventId = '' } = useParams()
  const event = useEvent(eventId)
  const competition = useCompetition(competitionId)
  const rounds = useRounds(eventId)

  if (event.isError) return <ErrorState onRetry={() => void event.refetch()} />
  if (!event.data || !competition.data) return <Skeleton className="h-24 w-full max-w-xl" />

  const earlier = (rounds.data ?? []).filter((r) => r.recallNumber !== null && r.status === RoundStatus.Published)
  const all = rounds.data ?? []
  const published = all.find((r) => r.recallNumber === null && r.status === RoundStatus.Published)

  return (
    <div className="flex flex-col gap-8">
      <PublicHeader
        back={{ to: `/competitions/${competitionId}`, label: competition.data.name }}
        eyebrow={formatDate(competition.data.date)}
        title={`${eventCode(event.data)} ${eventDances(event.data)}`}
        description={
          <>
            <span className="block">{eventGrade(event.data)}</span>
            <span className="block">{competition.data.venue}</span>
          </>
        }
      />

      <ResultsTable eventId={eventId} />

      {published && <FinalMarks roundId={published.id} />}

      {earlier.length > 0 && (
        <section aria-labelledby="earlier" className="flex flex-col gap-4">
          <h2 id="earlier" className="text-small font-bold uppercase tracking-wide text-neutral-900">
            Earlier rounds
          </h2>
          {earlier.map((r) => {
            const next = all[all.indexOf(r) + 1]
            return (
              <Qualified
                key={r.id}
                roundId={r.id}
                label={`${ROUND_TYPE_LABEL[r.type]}: back numbers through to ${next ? ROUND_TYPE_LABEL[next.type].toLowerCase() : 'the next round'}`}
              />
            )
          })}
        </section>
      )}
    </div>
  )
}
