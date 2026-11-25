import { ArrowUpRight, Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button, ButtonLink, ErrorState, PageHeader, SearchField, Select, Table, Toolbar, ToolbarActions, toast } from '../../components/ui/index.ts'
import { useCatalog, useEventList } from '../../hooks/index.ts'
import type { EventListRow } from '../../hooks/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { eventCode, eventDances } from '../../lib/format.ts'
import { filterEventList } from '../../lib/eventList.ts'
import { downloadPdf } from '../../lib/pdf.ts'
import { EventListSheets } from '../print/EventListPrintPage.tsx'

// Every event with the back numbers and the athletes entered, to print or download
export function EventListPage() {
  const { ageGroupLabel } = useCatalog()
  const [params, setParams] = useSearchParams()
  const { list: competitions, competitionId = '' } = useCompetitionChoice(params.get('competition'))
  const { events, rows, isLoading, isError, retry } = useEventList(competitionId)
  const [query, setQuery] = useState('')
  const eventId = events.some((e) => e.id === params.get('event')) ? (params.get('event') as string) : 'all'
  const shown = filterEventList(rows, eventId, query)
  const competition = competitions.find((c) => c.id === competitionId)
  const [saving, setSaving] = useState(false)
  const sheets = useRef<HTMLDivElement>(null)

  // The pages are drawn off screen for a moment, saved as a PDF file, then removed
  useEffect(() => {
    if (!saving) return
    let cancelled = false
    void (async () => {
      try {
        await new Promise((resolve) => requestAnimationFrame(resolve))
        if (!cancelled && sheets.current) await downloadPdf(sheets.current, 'event-list', 210)
      } catch {
        toast.error('The PDF could not be made. Try Print and choose Save as PDF instead.')
      } finally {
        setSaving(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [saving])

  const printPath = () => {
    const q = new URLSearchParams({ ...(eventId !== 'all' ? { event: eventId } : {}), ...(query.trim() ? { q: query.trim() } : {}) }).toString()
    return `/print/event-list/${competitionId}${q ? `?${q}` : ''}`
  }

  if (isError) return <ErrorState onRetry={retry} />

  const pick = (next: Record<string, string>) => setParams((p) => { for (const [k, v] of Object.entries(next)) p.set(k, v); return p }, { replace: true })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Event list" description="Every event with the back numbers and the athletes entered. Download it as a PDF or open the printout to print it." />
      <Toolbar>
        <SearchField label="Search athletes" placeholder="Name, team or back number" value={query} onChange={setQuery} />
        <Select label="Event" value={eventId} onChange={(e) => pick({ event: e.target.value })}>
          <option value="all">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {eventCode(e)} {eventDances(e)} · {ageGroupLabel(e.ageGroup)} · {e.class}
            </option>
          ))}
        </Select>
        {competitions.length > 1 && (
          <Select label="Competition" value={competitionId} onChange={(e) => pick({ competition: e.target.value, event: 'all' })}>
            {competitions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <ToolbarActions>
          <Button variant="secondary" disabled={shown.length === 0 || saving} onClick={() => setSaving(true)}>
            <Download aria-hidden size={16} strokeWidth={2} />
            {saving ? 'Preparing…' : 'Download'}
          </Button>
          <ButtonLink to={printPath()} target="_blank">
            Print
            <ArrowUpRight aria-hidden size={16} strokeWidth={2} />
          </ButtonLink>
        </ToolbarActions>
      </Toolbar>

      {saving && competition && (
        <div ref={sheets} aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 w-[210mm]">
          <EventListSheets competition={competition} events={events.filter((e) => shown.some((r) => r.event.id === e.id))} rows={shown} />
        </div>
      )}

      <Table<EventListRow>
        loading={isLoading}
        rows={shown}
        rowKey={(r) => r.key}
        minWidthClass="min-w-0"
        paginationLabel="Event list pagination"
        empty={{ title: query.trim() ? `No athletes match "${query.trim()}"` : 'No entries yet', description: 'Entries appear here once teams register for events.' }}
        columns={[
          {
            key: 'event',
            header: 'Event',
            cell: (r) => (
              <div className="flex flex-col">
                <span className="font-mono tabular-nums text-neutral-900">{eventCode(r.event)}</span>
                <span className="text-xs text-neutral-500">
                  {ageGroupLabel(r.event.ageGroup)} · {r.event.class} · {eventDances(r.event)}
                </span>
              </div>
            ),
          },
          { key: 'number', header: 'No.', cell: (r) => r.backNumber ?? '–', mono: true, align: 'center' },
          { key: 'names', header: 'Athletes', cell: (r) => <span className="font-medium text-neutral-900">{r.names}</span> },
          { key: 'team', header: 'Team', cell: (r) => r.teamName, hideBelow: 'sm' },
        ]}
      />
    </div>
  )
}
