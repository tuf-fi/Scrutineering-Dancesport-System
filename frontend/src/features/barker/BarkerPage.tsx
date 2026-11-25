import { useState } from 'react'
import { ProgramStatus, type BarkerCompetitor, type BarkerEvent } from '@bis/shared'
import { cn } from '../../lib/cn.ts'
import { StatusDot } from '../../components/StatusDot.tsx'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui/index.ts'
import { useBarkerBoard, useCatalog } from '../../hooks/index.ts'
import { DANCE_LABEL, ROUND_TYPE_LABEL, competitorName, eventCode } from '../../lib/format.ts'

const READY_KEY = 'bis.barker.ready'

function readReady(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(READY_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

// Good to go marks stay on this device
function useReadySet(): [Set<string>, (id: string) => void] {
  const [ready, setReady] = useState(readReady)
  const toggle = (id: string) =>
    setReady((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      try {
        localStorage.setItem(READY_KEY, JSON.stringify([...next]))
      } catch {
        /* storage blocked: the mark lasts until the page reloads */
      }
      return next
    })
  return [ready, toggle]
}

interface ReadyProps {
  ready: Set<string>
  onToggle: (id: string) => void
}

function CompetitorTile({ competitor, on, onToggle }: { competitor: BarkerCompetitor; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={cn(
        'grid min-h-14 w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg border px-4 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400',
        on ? 'border-success bg-success-soft' : 'border-neutral-200 bg-white hover:border-gold-400',
      )}
    >
      <span className="font-mono text-xl font-semibold leading-none tabular-nums text-neutral-900">{competitor.backNumber ?? '–'}</span>
      <span className="min-w-0 text-small text-neutral-800">{competitorName(competitor.names)}</span>
      <span aria-hidden className={cn('size-3 rounded-full border-[1.5px] transition-colors', on ? 'border-success bg-success' : 'border-neutral-300')} />
    </button>
  )
}

// One round: its event, then each heat with the back numbers and names to line up
function EventBlock({ event, status, ready, onToggle }: { event: BarkerEvent; status: ProgramStatus } & ReadyProps) {
  const { eventGrade } = useCatalog()
  const total = event.heats.reduce((n, h) => n + h.competitors.length, 0)
  const idOf = (heat: number | null, c: BarkerCompetitor, j: number) => `${event.eventId}:${event.roundType}:${heat ?? 0}:${c.backNumber ?? j}`
  return (
    <article className="flex flex-col gap-8 border-t border-neutral-900 pt-6">
      <header className="flex items-start gap-4">
        <span className="font-mono text-display font-semibold tabular-nums text-gold-600">{eventCode({ number: event.eventNumber })}</span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-display font-semibold leading-tight text-neutral-900">{eventGrade(event)}</h3>
          <p className="flex flex-wrap items-center gap-x-2 text-body text-neutral-600">
            <StatusDot status={status} className="size-2.5" />
            {ROUND_TYPE_LABEL[event.roundType]} <span aria-hidden>/</span> {event.dances.map((d) => DANCE_LABEL[d]).join(', ')} <span aria-hidden>/</span> {total} {event.isSolo ? 'solos' : 'couples'}
          </p>
        </div>
      </header>

      {total === 0 ? (
        <p className="text-small text-neutral-600">Nobody is listed for this round yet.</p>
      ) : (
        event.heats.map((heat, i) => {
          const goodToGo = heat.competitors.filter((c, j) => ready.has(idOf(heat.heat, c, j))).length
          return (
            <section key={heat.heat ?? i} aria-label={heat.heat === null ? 'Competitors' : `Heat ${heat.heat}`} className="flex flex-col gap-5 border-t border-neutral-200 pt-6">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-body font-semibold text-neutral-900">{event.heats.length > 1 && heat.heat !== null ? `Heat ${heat.heat}` : 'Competitors'}</h4>
                <span className="font-mono text-xs tabular-nums text-neutral-500">{goodToGo} of {heat.competitors.length} good to go</span>
              </div>
              <ul className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
                {heat.competitors.map((c, j) => {
                  const id = idOf(heat.heat, c, j)
                  return (
                    <li key={`${c.backNumber}-${j}`}>
                      <CompetitorTile competitor={c} on={ready.has(id)} onToggle={() => onToggle(id)} />
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })
      )}
    </article>
  )
}

const VIEWS = {
  floor: { title: 'On the floor', status: ProgramStatus.Current, empty: { title: 'Nothing on the floor', description: 'No round is being danced right now.' } },
  next: { title: 'Up next', status: ProgramStatus.Next, empty: { title: 'Nothing waiting', description: 'No event is waiting after this one in the running order.' } },
} as const

// The barker's screens: who is on the floor now, and who to call next
export function BarkerPage({ view }: { view: keyof typeof VIEWS }) {
  const board = useBarkerBoard()
  const [ready, onToggle] = useReadySet()
  const look = VIEWS[view]

  if (board.isError) return <ErrorState onRetry={() => void board.refetch()} />

  const events = view === 'floor' ? (board.data?.ongoing ?? []) : board.data?.next ? [board.data.next] : []

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={look.title} description={board.data?.competitionName ?? 'Line the competitors up and call them to be ready.'} />

      {board.isLoading ? (
        <div aria-hidden className="flex flex-col gap-4">
          <Skeleton className="h-6 w-64" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState title={look.empty.title} description={look.empty.description} />
      ) : (
        <section aria-label={look.title} className="flex flex-col gap-16">
          {events.map((e) => (
            <EventBlock key={`${e.eventId}:${e.roundType}`} event={e} status={look.status} ready={ready} onToggle={onToggle} />
          ))}
        </section>
      )}
    </div>
  )
}
