import { EmptyState, SkeletonList } from '../../components/ui/index.ts'
import { useEvents, useCatalog } from '../../hooks/index.ts'
import { DANCE_LABEL, eventCode } from '../../lib/format.ts'

// The events of one competition, in running order
export function CompetitionEvents({ competitionId }: { competitionId: string }) {
  const { eventGrade } = useCatalog()
  const events = useEvents(competitionId)
  const list = [...(events.data ?? [])].sort((a, b) => a.number - b.number)

  if (events.isLoading) return <SkeletonList rows={5} />
  if (list.length === 0) return <EmptyState title="No events yet" description="The secretariat sets up the events of a competition." />

  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-xs uppercase text-neutral-500">
        {list.length} {list.length === 1 ? 'event' : 'events'}
      </p>
      <ol aria-label="Events" className="border-y border-neutral-200">
        {list.map((e) => (
          <li key={e.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-4 border-t border-neutral-100 py-3 first:border-t-0">
            <span className="font-mono text-small font-semibold tabular-nums text-neutral-500">{eventCode(e)}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-small font-medium text-neutral-900">{e.dances.map((d) => DANCE_LABEL[d]).join(', ')}</span>
              <span className="text-xs text-neutral-500">{eventGrade(e)}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
