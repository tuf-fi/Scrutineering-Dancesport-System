import type { AdjudicatorAssignment } from '@bis/shared'
import { CompetitionCard } from '../../components/CompetitionCard.tsx'
import { EmptyState, Pagination, SkeletonList } from '../../components/ui/index.ts'
import { useAdjudicatorAssignments } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { DANCE_LABEL, eventCode, eventGrade, formatDate } from '../../lib/format.ts'

// The competitions the adjudicator worked, newest first, each with the events on their panel
function groupByCompetition(lines: AdjudicatorAssignment[]) {
  const groups = new Map<string, { id: string; name: string; date: string; lines: AdjudicatorAssignment[] }>()
  for (const l of lines) {
    const group = groups.get(l.competitionId) ?? { id: l.competitionId, name: l.competitionName, date: l.competitionDate, lines: [] }
    group.lines.push(l)
    groups.set(l.competitionId, group)
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export function AdjudicatorAssignments({ adjudicatorId }: { adjudicatorId: string }) {
  const assignments = useAdjudicatorAssignments(adjudicatorId)
  const lines = assignments.data ?? []
  const groups = groupByCompetition(lines)
  const { page, setPage, pageSize, total, pageItems } = usePagination(groups, adjudicatorId)

  if (assignments.isLoading) return <SkeletonList rows={5} />
  if (groups.length === 0) return <EmptyState title="Not on a panel yet" description="The events this adjudicator is assigned to appear here." />

  const rounds = lines.reduce((sum, l) => sum + l.roundsMarked, 0)

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-xs uppercase text-neutral-500">
        {groups.length} {groups.length === 1 ? 'competition' : 'competitions'} <span aria-hidden>/</span> {lines.length} {lines.length === 1 ? 'event' : 'events'}
        {rounds > 0 && (
          <>
            {' '}
            <span aria-hidden>/</span> {rounds} {rounds === 1 ? 'round' : 'rounds'} marked
          </>
        )}
      </p>
      <ol aria-label="Assignments" className="flex flex-col gap-3">
        {pageItems.map((group) => (
          <CompetitionCard
            key={group.id}
            compact
            title={group.name}
            label={`Events at ${group.name}`}
            meta={
              <>
                <span className="text-gold-700">{formatDate(group.date)}</span> <span aria-hidden>/</span> {group.lines.length} {group.lines.length === 1 ? 'event' : 'events'}
              </>
            }
          >
            {group.lines.map((l) => (
              <li key={l.eventId} className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-4 border-t border-neutral-100 px-4 py-2.5 first:border-t-0 sm:grid-cols-[4rem_minmax(0,1fr)_auto]">
                <span className="font-mono text-small font-semibold tabular-nums text-neutral-500">{eventCode({ number: l.eventNumber })}</span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-small font-medium text-neutral-900">{l.dances.map((d) => DANCE_LABEL[d]).join(', ')}</span>
                  <span className="text-xs text-neutral-500">{eventGrade(l)}</span>
                </span>
                <span className="whitespace-nowrap text-xs text-neutral-500">
                  {l.roundsMarked > 0 && (
                    <>
                      <span className="font-semibold tabular-nums text-neutral-900">{l.roundsMarked}</span> {l.roundsMarked === 1 ? 'round' : 'rounds'}
                    </>
                  )}
                </span>
              </li>
            ))}
          </CompetitionCard>
        ))}
      </ol>
      {total > pageSize && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="Assignments pagination" />}
    </div>
  )
}
