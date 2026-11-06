import type { BarkerEvent } from '@bis/shared'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui/index.ts'
import { useBarkerBoard, useCatalog } from '../../hooks/index.ts'
import { DANCE_LABEL, ROUND_TYPE_LABEL, competitorName, eventCode } from '../../lib/format.ts'

// One round: its event, then each heat with the back numbers and names to line up
function EventBlock({ event }: { event: BarkerEvent }) {
  const { eventGrade } = useCatalog()
  const total = event.heats.reduce((n, h) => n + h.competitors.length, 0)
  return (
    <article className="flex flex-col gap-4 border-t border-neutral-900 pt-4">
      <header className="flex flex-col gap-1">
        <h3 className="flex flex-wrap items-baseline gap-x-3 text-title font-semibold text-neutral-900">
          <span className="font-mono tabular-nums">{eventCode({ number: event.eventNumber })}</span>
          {event.dances.map((d) => DANCE_LABEL[d]).join(', ')}
        </h3>
        <p className="text-small text-neutral-600">
          {ROUND_TYPE_LABEL[event.roundType]} <span aria-hidden>/</span> {eventGrade(event)} <span aria-hidden>/</span> {total} {event.isSolo ? 'solos' : 'couples'}
        </p>
      </header>

      {total === 0 ? (
        <p className="text-small text-neutral-600">Nobody is listed for this round yet.</p>
      ) : (
        event.heats.map((heat, i) => (
          <section key={heat.heat ?? i} aria-label={heat.heat === null ? 'Competitors' : `Heat ${heat.heat}`} className="flex flex-col gap-1">
            {event.heats.length > 1 && heat.heat !== null && <h4 className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">Heat {heat.heat}</h4>}
            <ul className="border-b border-neutral-200">
              {heat.competitors.map((c, j) => (
                <li key={`${c.backNumber}-${j}`} className="grid min-h-14 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4 border-t border-neutral-200 py-2">
                  <span className="font-mono text-[1.75rem] font-semibold leading-none tabular-nums text-neutral-900">{c.backNumber ?? '–'}</span>
                  <span className="min-w-0 text-body text-neutral-800">{competitorName(c.names)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </article>
  )
}

function Section({ title, events, empty }: { title: string; events: BarkerEvent[]; empty: string }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <h2 className="text-small font-bold uppercase tracking-wide text-neutral-900">{title}</h2>
      {events.length === 0 ? <p className="text-small text-neutral-600">{empty}</p> : events.map((e) => <EventBlock key={`${e.eventId}:${e.roundType}`} event={e} />)}
    </section>
  )
}

// The barker's screen: who is on the floor, and who to call next
export function BarkerPage() {
  const board = useBarkerBoard()

  if (board.isError) return <ErrorState onRetry={() => void board.refetch()} />

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Barker" description={board.data?.competitionName ?? 'Line the competitors up and call them to be ready.'} />

      {board.isLoading ? (
        <div aria-hidden className="flex flex-col gap-4">
          <Skeleton className="h-6 w-64" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : board.data && board.data.ongoing.length === 0 && board.data.next === null ? (
        <EmptyState title="Nothing to call" description="There is no round on the floor and none waiting in the running order." />
      ) : (
        <>
          <Section title="On the floor now" events={board.data?.ongoing ?? []} empty="Nothing is on the floor yet." />
          <Section title="Next event" events={board.data?.next ? [board.data.next] : []} empty="No event is waiting after this one." />
        </>
      )}
    </div>
  )
}
