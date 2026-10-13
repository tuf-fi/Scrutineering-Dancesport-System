import { RoundStatus } from '@bis/shared'
import { Link, useParams } from 'react-router'
import { ErrorState, PageHeader, Skeleton } from '../../components/ui/index.ts'
import { useCompetition, useEvent, useRecallTable, useRounds } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances, eventGrade, formatDate } from '../../lib/format.ts'
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
    <section aria-label={label} className="flex flex-col gap-2 border-t border-neutral-200 pt-5">
      <h3 className="text-small font-medium text-neutral-900">{label}</h3>
      <p className="font-mono text-small tabular-nums leading-relaxed text-neutral-600">{numbers.join('  ')}</p>
    </section>
  )
}

export function EventResultsPage() {
  const { competitionId = '', eventId = '' } = useParams()
  const event = useEvent(eventId)
  const competition = useCompetition(competitionId)
  const rounds = useRounds(eventId)

  if (event.isError) return <ErrorState onRetry={() => void event.refetch()} />
  if (!event.data || !competition.data) return <Skeleton className="h-24 w-full max-w-xl" />

  const earlier = (rounds.data ?? []).filter((r) => r.recallNumber !== null && r.status === RoundStatus.Published)
  const all = rounds.data ?? []

  return (
    <div className="flex flex-col gap-8">
      <Link to={`/competitions/${competitionId}`} className="w-fit text-small text-neutral-600 hover:text-neutral-900">
        {competition.data.name}
      </Link>
      <PageHeader
        title={`${eventCode(event.data)} ${eventDances(event.data)}`}
        description={`${eventGrade(event.data)} · ${formatDate(competition.data.date)}`}
      />

      <ResultsTable eventId={eventId} />

      {earlier.length > 0 && (
        <div className="flex flex-col gap-5">
          <h2 className="text-title font-semibold text-neutral-900">Earlier rounds</h2>
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
        </div>
      )}
    </div>
  )
}
