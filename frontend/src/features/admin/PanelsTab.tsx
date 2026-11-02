import type { Event } from '@bis/shared'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { EmptyState, ErrorState, SearchField, Table, Toolbar, toast } from '../../components/ui/index.ts'
import { cn } from '../../lib/cn.ts'
import { useAdjudicators, useEvents, usePanels, useSetPanel } from '../../hooks/index.ts'
import { eventCode, eventDances, eventGrade, letterRanges } from '../../lib/format.ts'
import { CompetitionSelect } from '../../components/CompetitionSelect.tsx'

interface PanelsTabProps {
  competitionId: string
  competitions: Array<{ id: string; name: string }>
  onCompetitionChange: (id: string) => void
}

// Who marks each event, as one grid: an event on every row, an adjudicator on every column. A tap on a cell puts that
// adjudicator on, or takes them off, that event's panel; it is saved at once.
export function PanelsTab({ competitionId, competitions, onCompetitionChange }: PanelsTabProps) {
  const events = useEvents(competitionId)
  const panels = usePanels(competitionId)
  const adjudicators = useAdjudicators()
  const save = useSetPanel()
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()

  const everyone = adjudicators.data ?? []
  const panelOf = (eventId: string) => panels.data?.find((p) => p.eventId === eventId)?.adjudicatorIds ?? []
  const rows = (events.data ?? []).filter((e) => !needle || `${eventCode(e)} ${eventDances(e)} ${eventGrade(e)}`.toLowerCase().includes(needle))

  function toggle(event: Event, adjudicatorId: string) {
    const current = panelOf(event.id)
    const next = current.includes(adjudicatorId) ? current.filter((id) => id !== adjudicatorId) : [...current, adjudicatorId]
    if (next.length === 0) return
    save.mutate({ eventId: event.id, adjudicatorIds: next }, { onError: (e) => toast.error(e.message) })
  }

  // The toolbar stays in every state, so the competition can always be switched
  const toolbar = (
    <Toolbar>
      <SearchField className="w-full sm:w-72" label="Search events" value={query} onChange={setQuery} />
      <CompetitionSelect list={competitions} value={competitionId} onChange={onCompetitionChange} />
    </Toolbar>
  )

  if (events.isError || panels.isError) {
    return (
      <div className="flex flex-col gap-6">
        {toolbar}
        <ErrorState onRetry={() => void Promise.all([events.refetch(), panels.refetch()])} />
      </div>
    )
  }
  if (!events.isLoading && !events.data?.length) {
    return (
      <div className="flex flex-col gap-6">
        {toolbar}
        <EmptyState title="No events in this competition" description="Events are set up by the secretariat. Panels are assigned once they exist." />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {toolbar}

      <ul aria-label="Adjudicators" className="flex flex-wrap gap-x-6 gap-y-1.5 text-small text-neutral-600">
        {everyone.map((a) => (
          <li key={a.id} className="flex items-baseline gap-1.5">
            <span className="font-mono font-semibold text-gold-700">{a.letter}</span>
            {a.name}
          </li>
        ))}
      </ul>

      <Table<Event>
        loading={events.isLoading || panels.isLoading}
        rows={rows}
        rowKey={(e) => e.id}
        minWidthClass="min-w-[44rem]"
        paginationLabel="Events pagination"
        empty={{ title: 'No events match', description: `Nothing matches "${query.trim()}".` }}
        columns={[
          {
            key: 'event',
            header: 'Event',
            cell: (e) => (
              <span className="flex min-w-0 flex-col gap-0.5">
                <span>
                  <span className="font-mono tabular-nums">{eventCode(e)}</span> <span className="font-semibold">{eventDances(e)}</span>
                </span>
                <span className="text-xs text-neutral-500">{eventGrade(e)}</span>
              </span>
            ),
          },
          ...everyone.map((a) => ({
            key: a.id,
            header: a.letter,
            mono: true,
            align: 'center' as const,
            widthClass: 'w-14',
            detail: false as const,
            cell: (e: Event) => {
              const on = panelOf(e.id).includes(a.id)
              const only = on && panelOf(e.id).length === 1
              return (
                <button
                  type="button"
                  aria-pressed={on}
                  aria-label={`${eventCode(e)} ${a.name}`}
                  title={only ? 'An event needs at least one adjudicator' : a.name}
                  disabled={only || save.isPending}
                  onClick={() => toggle(e, a.id)}
                  className={cn(
                    'group mx-auto grid size-7 place-items-center rounded-md transition-colors disabled:cursor-not-allowed',
                    on ? 'bg-gold-400 text-black' : 'hover:bg-gold-50',
                  )}
                >
                  {on ? (
                    <Check aria-hidden className="size-3.5" strokeWidth={2.25} />
                  ) : (
                    <span aria-hidden className="size-1.5 rounded-full bg-neutral-200 transition-colors group-hover:bg-gold-400" />
                  )}
                </button>
              )
            },
          })),
          {
            key: 'panel',
            header: 'Panel',
            align: 'right' as const,
            mono: true,
            muted: true,
            widthClass: 'w-24',
            cell: (e) => {
              const ids = panelOf(e.id)
              return ids.length ? letterRanges(ids.map((id) => everyone.find((a) => a.id === id)?.letter ?? '')) : 'None'
            },
          },
        ]}
      />
    </div>
  )
}
