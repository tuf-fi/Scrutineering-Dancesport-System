import type { Event } from '@bis/shared'
import { Check } from 'lucide-react'
import { useState } from 'react'
import {
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Showing,
  SearchField,
  Skeleton,
  Toolbar,
  toast,
} from '../../components/ui/index.ts'
import { cn } from '../../lib/cn.ts'
import { useAdjudicators, useEvents, usePanels, useSetPanel } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { eventCode, eventDances, eventGrade, letterRanges } from '../../lib/format.ts'
import { CompetitionSelect } from './CompetitionSelect.tsx'

// Who marks one event: pick the adjudicators and save
function PanelEditor({ event, initial }: { event: Event; initial: string[] }) {
  const adjudicators = useAdjudicators()
  const [selected, setSelected] = useState(initial)
  const save = useSetPanel()
  const all = adjudicators.data ?? []
  const dirty = selected.length !== initial.length || selected.some((id) => !initial.includes(id))

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <section className="self-start overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <header className="flex flex-col gap-0.5 border-b border-neutral-200 px-6 py-4">
        <h3 className="text-title font-semibold">
          <span className="font-mono">{eventCode(event)}</span> {eventDances(event)}
        </h3>
        <p className="text-small text-neutral-600">{eventGrade(event)}</p>
      </header>

      <ul className="grid gap-2 p-6 sm:grid-cols-2">
        {all.map((a) => {
          const on = selected.includes(a.id)
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(a.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border bg-white px-3 py-2.5 text-left transition-colors',
                  on ? 'border-neutral-900' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50',
                )}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-full font-mono text-small font-semibold transition-colors',
                    on ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500',
                  )}
                >
                  {a.letter}
                </span>
                <span className={cn('min-w-0 flex-1 truncate text-small font-medium', on ? 'text-neutral-900' : 'text-neutral-600')}>
                  {a.name}
                </span>
                <Check
                  aria-hidden
                  className={cn('size-4 shrink-0', on ? 'text-neutral-900' : 'text-transparent')}
                  strokeWidth={2}
                />
              </button>
            </li>
          )
        })}
      </ul>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-3.5">
        <p className="text-small text-neutral-600">
          <span className="font-medium tabular-nums text-neutral-900">{selected.length}</span> of{' '}
          <span className="tabular-nums">{all.length}</span> selected
          {selected.length === 0 && ' · choose at least one'}
        </p>
        <Button
          disabled={!dirty || selected.length === 0 || save.isPending}
          onClick={() =>
            save.mutate(
              { eventId: event.id, adjudicatorIds: selected },
              {
                onSuccess: () => toast.success(`Panel saved for ${eventCode(event)}`),
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          {save.isPending ? 'Saving…' : 'Save panel'}
        </Button>
      </footer>
    </section>
  )
}

interface PanelsTabProps {
  competitionId: string
  competitions: Array<{ id: string; name: string }>
  onCompetitionChange: (id: string) => void
}

export function PanelsTab({ competitionId, competitions, onCompetitionChange }: PanelsTabProps) {
  const events = useEvents(competitionId)
  const panels = usePanels(competitionId)
  const adjudicators = useAdjudicators()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const matching = (events.data ?? []).filter(
    (e) =>
      !needle ||
      `${eventCode(e)} ${eventDances(e)} ${eventGrade(e)}`.toLowerCase().includes(needle),
  )
  const { page, setPage, pageSize, total, pageItems } = usePagination(matching, `${competitionId}|${needle}`)

  // The toolbar stays in every state, so the competition can always be switched
  const toolbar = (
    <Toolbar>
      <SearchField className="w-full sm:w-72" label="Search events" value={query} onChange={setQuery} />
      <CompetitionSelect list={competitions} value={competitionId} onChange={onCompetitionChange} />
    </Toolbar>
  )

  let body
  if (events.isError || panels.isError) {
    body = <ErrorState onRetry={() => void Promise.all([events.refetch(), panels.refetch()])} />
  } else if (events.isLoading || panels.isLoading) {
    body = (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  } else if (!events.data?.length) {
    body = (
      <div className="rounded-xl border border-dashed border-neutral-300 px-6">
        <EmptyState
          title="No events in this competition"
          description="Events are set up by the secretariat. Panels are assigned once they exist."
        />
      </div>
    )
  } else {
    const letters = new Map((adjudicators.data ?? []).map((a) => [a.id, a.letter]))
    const panelOf = (eventId: string) => panels.data?.find((p) => p.eventId === eventId)
    const selected = events.data.find((e) => e.id === selectedId) ?? events.data[0]
    const summary = (eventId: string) => {
      const ids = panelOf(eventId)?.adjudicatorIds
      return ids?.length ? letterRanges(ids.map((id) => letters.get(id) ?? '')) : 'No panel'
    }

    body = (
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {pageItems.length === 0 ? (
            <p className="px-5 py-6 text-small text-neutral-600">No events match "{query.trim()}".</p>
          ) : (
            <ul aria-label="Events" className="divide-y divide-neutral-100">
              {pageItems.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    aria-current={event.id === selected.id ? 'true' : undefined}
                    onClick={() => setSelectedId(event.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition-colors',
                      event.id === selected.id ? 'bg-neutral-100' : 'hover:bg-neutral-50',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-small">
                        <span className="font-mono tabular-nums">{eventCode(event)}</span>{' '}
                        <span className="font-medium text-neutral-900">{eventDances(event)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">{eventGrade(event)}</span>
                    </span>
                    <span className="shrink-0 text-small tabular-nums text-neutral-600">{summary(event.id)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Showing page={page} pageSize={pageSize} total={total} />
        </div>
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label="Events pagination" showSummary={false} />
        </div>

        <PanelEditor key={selected.id} event={selected} initial={panelOf(selected.id)?.adjudicatorIds ?? []} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {toolbar}
      {body}
    </div>
  )
}
