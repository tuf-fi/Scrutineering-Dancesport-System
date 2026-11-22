import type { Event } from '@bis/shared'
import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useCatalog, useCompetition, useEventList } from '../../hooks/index.ts'
import type { EventListRow } from '../../hooks/index.ts'
import { eventCode, eventDances, sheetDate } from '../../lib/format.ts'
import { filterEventList } from '../../lib/eventList.ts'
import { num, td, th } from './tableStyles.ts'

interface Chunk {
  event: Event
  rows: EventListRow[]
  continued: boolean
}

// Table rows that fit on an A4 page; the first page also holds the title and the details
const FIRST_PAGE = 24
const NEXT_PAGE = 30
// An event's heading and column titles take about this many rows
const HEADING = 3

// Splits the events into A4 pages, an event carrying over to the next page when it does not fit
function paginate(events: Event[], rows: EventListRow[]): Chunk[][] {
  const pages: Chunk[][] = [[]]
  let left = FIRST_PAGE
  for (const event of events) {
    let rest = rows.filter((r) => r.event.id === event.id)
    let continued = false
    while (rest.length > 0) {
      if (left < HEADING + Math.min(2, rest.length)) {
        pages.push([])
        left = NEXT_PAGE
      }
      const take = rest.slice(0, left - HEADING)
      pages.at(-1)!.push({ event, rows: take, continued })
      rest = rest.slice(take.length)
      left -= HEADING + take.length
      continued = true
    }
  }
  return pages
}

// Every event with the back numbers and athletes entered, on A4 pages shown one by one
export function EventListPrintPage() {
  const { ageGroupLabel } = useCatalog()
  const { competitionId = '' } = useParams()
  const [params] = useSearchParams()
  const competition = useCompetition(competitionId)
  const list = useEventList(competitionId)
  const pdf = params.get('pdf') === '1'
  const ready = Boolean(competition.data) && !list.isLoading

  // PDF opens the print dialog at once; "Save as PDF" is the destination there
  useEffect(() => {
    if (pdf && ready) window.print()
  }, [pdf, ready])

  if (competition.isError || list.isError) return <ErrorState onRetry={() => void Promise.all([competition.refetch(), list.retry()])} />
  if (!competition.data || list.isLoading) return <Skeleton className="h-96 w-full" />

  const rows = filterEventList(list.rows, params.get('event') ?? 'all', params.get('q') ?? '')
  const events = list.events.filter((e) => rows.some((r) => r.event.id === e.id))
  const pages = paginate(events, rows)

  return (
    <div className="flex flex-col">
      <p className="print:hidden mb-4 px-6 text-neutral-600 sm:px-0">
        {pdf ? 'In the print dialog, choose Save as PDF as the destination.' : 'Use the Print button above, or save it as a PDF from the print dialog.'}
      </p>

      {pages.map((chunks, i) => (
        <div key={i} className={`bg-white p-6 shadow-md sm:p-[12mm] print:p-0 print:shadow-none ${i < pages.length - 1 ? 'print-page-break mb-8 print:mb-0' : ''}`}>
          <article aria-label={`Page ${i + 1} of ${pages.length}`} className="flex flex-col border-2 border-neutral-900 text-[10pt] leading-snug text-neutral-900 sm:min-h-[273mm] print:min-h-0">
            {i === 0 ? (
              <>
                <h1 className="print-exact border-b-2 border-neutral-900 bg-neutral-200 px-3 py-1.5 text-[15pt] font-bold">Event list: {competition.data.name}</h1>
                <dl className="grid grid-cols-2 gap-x-6 border-b-2 border-neutral-900 px-3 py-2.5">
                  {[
                    ['Date', sheetDate(competition.data.date)],
                    ['Location', competition.data.venue],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col">
                      <dt className="text-[8pt] text-neutral-600">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="border-b border-neutral-300 px-3 py-1.5 text-[8pt] text-neutral-600">Event list: {competition.data.name}</p>
            )}

            <div className="flex flex-col gap-5 px-3 py-3">
              {rows.length === 0 && <p>No entries yet.</p>}
              {chunks.map(({ event, rows: chunk, continued }) => (
                <section key={`${event.id}-${continued}`} className="break-inside-avoid">
                  <h2 className="mb-1 font-bold">
                    {eventCode(event)} · {eventDances(event)} · {ageGroupLabel(event.ageGroup)} · {event.class}
                    {continued && <span className="font-normal text-neutral-600"> (continued)</span>}
                  </h2>
                  <table className="w-full table-fixed border-collapse">
                    <thead>
                      <tr>
                        <th className={`${th} w-16`}>No.</th>
                        <th className={`${th} w-[45%]`}>{event.isSolo ? 'Solo' : 'Couple'}</th>
                        <th className={th}>Team</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chunk.map((r) => (
                        <tr key={r.key}>
                          <td className={`${td} ${num}`}>{r.backNumber ?? ''}</td>
                          <td className={td}>{r.names}</td>
                          <td className={td}>{r.teamName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>

            <footer className="mt-auto flex justify-between px-3 pb-3 pt-1 font-semibold">
              <span>
                {i === pages.length - 1 && `${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} in ${events.length} ${events.length === 1 ? 'event' : 'events'}.`}
              </span>
              <span className="font-normal text-neutral-600">
                Page {i + 1} of {pages.length}
              </span>
            </footer>
          </article>
        </div>
      ))}
    </div>
  )
}
