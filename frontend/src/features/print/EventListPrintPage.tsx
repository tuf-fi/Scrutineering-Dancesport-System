import type { Competition, Event } from '@bis/shared'
import { useParams, useSearchParams } from 'react-router'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useCatalog, useCompetition, useEventList } from '../../hooks/index.ts'
import type { EventListRow } from '../../hooks/index.ts'
import { DISCIPLINE_LABEL, eventCode, eventDances, sheetDate } from '../../lib/format.ts'
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

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
// A couple is counted as one couple; a solo as one dancer
const countOf = (isSolo: boolean, n: number) => (isSolo ? plural(n, 'solo dancer') : plural(n, 'couple'))

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

const totals = (rows: EventListRow[]) => {
  const solos = rows.filter((r) => r.event.isSolo).length
  const couples = rows.length - solos
  return [couples > 0 && plural(couples, 'couple'), solos > 0 && plural(solos, 'solo dancer')].filter(Boolean).join(' and ') || '0 entries'
}

// Every event with the back numbers and athletes entered, on A4 pages shown one by one
export function EventListPrintPage() {
  const { competitionId = '' } = useParams()
  const [params] = useSearchParams()
  const competition = useCompetition(competitionId)
  const list = useEventList(competitionId)

  if (competition.isError || list.isError) return <ErrorState onRetry={() => void Promise.all([competition.refetch(), list.retry()])} />
  if (!competition.data || list.isLoading) return <Skeleton className="h-96 w-full" />

  const rows = filterEventList(list.rows, params.get('event') ?? 'all', params.get('q') ?? '')
  const events = list.events.filter((e) => rows.some((r) => r.event.id === e.id))

  return (
    <div className="flex flex-col">
      <p data-pdf-skip className="print:hidden mb-4 px-6 text-neutral-600 sm:px-0">
        Use Print or Download PDF above.
      </p>
      <EventListSheets competition={competition.data} events={events} rows={rows} />
    </div>
  )
}

// The A4 pages themselves, also drawn off screen when the list is saved as a PDF from the admin page
export function EventListSheets({ competition, events, rows }: { competition: Competition; events: Event[]; rows: EventListRow[] }) {
  const { ageGroupLabel } = useCatalog()
  const pages = paginate(events, rows)

  return (
    <>
      {pages.map((chunks, i) => (
        <div key={i} data-pdf-page className={`bg-white p-6 shadow-md sm:p-[12mm] print:p-0 print:shadow-none ${i < pages.length - 1 ? 'print-page-break mb-8 print:mb-0' : ''}`}>
          <article aria-label={`Page ${i + 1} of ${pages.length}`} className="flex flex-col border-2 border-neutral-900 text-[10pt] leading-snug text-neutral-900 sm:min-h-[273mm] print:min-h-0">
            {i === 0 ? (
              <>
                <h1 className="print-exact border-b-2 border-neutral-900 bg-neutral-200 px-3 py-1.5 text-[15pt] font-bold">Event list: {competition.name}</h1>
                <dl className="grid grid-cols-2 gap-x-6 border-b-2 border-neutral-900 px-3 py-2.5">
                  {[
                    ['Date', sheetDate(competition.date)],
                    ['Location', competition.venue],
                  ].map(([label, value]) => (
                    <div key={label} className="flex flex-col">
                      <dt className="text-[8pt] text-neutral-600">{label}</dt>
                      <dd className="font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="border-b border-neutral-300 px-3 py-1.5 text-[8pt] text-neutral-600">Event list: {competition.name}</p>
            )}

            <div className="flex flex-col gap-5 px-3 py-3">
              {rows.length === 0 && <p>No entries yet.</p>}
              {chunks.map(({ event, rows: chunk, continued }) => (
                <section key={`${event.id}-${continued}`} className="break-inside-avoid">
                  <h2 className="flex justify-between gap-4 font-bold">
                    <span>
                    {eventCode(event)} - {ageGroupLabel(event.ageGroup)} - {event.class} - {DISCIPLINE_LABEL[event.discipline]}
                    {continued && <span className="font-normal text-neutral-600"> (continued)</span>}
                    </span>
                    {!continued && <span className="shrink-0 font-normal text-neutral-600">{countOf(event.isSolo, rows.filter((r) => r.event.id === event.id).length)}</span>}
                  </h2>
                  <p className="mb-1 text-[9pt] text-neutral-600">{eventDances(event)}</p>
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
                {i === pages.length - 1 && `${totals(rows)} in ${plural(events.length, 'event')}.`}
              </span>
              <span className="font-normal text-neutral-600">
                Page {i + 1} of {pages.length}
              </span>
            </footer>
          </article>
        </div>
      ))}
    </>
  )
}
