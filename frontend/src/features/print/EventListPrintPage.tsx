import { useParams, useSearchParams } from 'react-router'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useCatalog, useCompetition, useEventList } from '../../hooks/index.ts'
import { eventCode, eventDances, sheetDate } from '../../lib/format.ts'
import { filterEventList } from '../../lib/eventList.ts'
import { num, td, th } from './tableStyles.ts'

// Every event with the back numbers and athletes entered, one block per event
export function EventListPrintPage() {
  const { ageGroupLabel } = useCatalog()
  const { competitionId = '' } = useParams()
  const [params] = useSearchParams()
  const competition = useCompetition(competitionId)
  const list = useEventList(competitionId)

  if (competition.isError || list.isError) return <ErrorState onRetry={() => void Promise.all([competition.refetch(), list.retry()])} />
  if (!competition.data || list.isLoading) return <Skeleton className="h-96 w-full" />

  const rows = filterEventList(list.rows, params.get('event') ?? 'all', params.get('q') ?? '')
  const events = list.events.filter((e) => rows.some((r) => r.event.id === e.id))

  return (
    <article className="border-2 border-neutral-900 text-[10pt] leading-snug text-neutral-900">
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

      <div className="flex flex-col gap-5 px-3 py-3">
        {events.length === 0 && <p>No entries yet.</p>}
        {events.map((event) => (
          <section key={event.id} className="break-inside-avoid">
            <h2 className="mb-1 font-bold">
              {eventCode(event)} · {eventDances(event)} · {ageGroupLabel(event.ageGroup)} · {event.class}
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
                {rows
                  .filter((r) => r.event.id === event.id)
                  .map((r) => (
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

      <footer className="px-3 pb-3 pt-1 font-semibold">
        {rows.length} {rows.length === 1 ? 'entry' : 'entries'} in {events.length} {events.length === 1 ? 'event' : 'events'}.
      </footer>
    </article>
  )
}
