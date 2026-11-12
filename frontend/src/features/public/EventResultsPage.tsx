import { RoundStatus } from '@bis/shared'
import { useParams } from 'react-router'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useCompetition, useEvent, useRounds, useCatalog } from '../../hooks/index.ts'
import { eventCode, eventDances, formatDate } from '../../lib/format.ts'
import { EventReportView } from './EventReport.tsx'
import { PublicHeader } from './PublicHeader.tsx'

export function EventResultsPage() {
  const { eventGrade } = useCatalog()
  const { competitionId = '', eventId = '' } = useParams()
  const event = useEvent(eventId)
  const competition = useCompetition(competitionId)
  const rounds = useRounds(eventId)

  if (event.isError) return <ErrorState onRetry={() => void event.refetch()} />
  if (!event.data || !competition.data) return <Skeleton className="h-24 w-full max-w-xl" />

  const published = (rounds.data ?? []).find((r) => r.recallNumber === null && r.status === RoundStatus.Published)

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

      {published ? (
        <EventReportView eventId={eventId} finalRoundId={published.id} />
      ) : rounds.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <EmptyState title="No results yet" description="The results appear here once the scrutineer publishes the final." />
      )}
    </div>
  )
}
