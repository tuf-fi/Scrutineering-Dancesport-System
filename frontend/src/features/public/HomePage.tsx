import { RoundStatus } from '@bis/shared'
import { Link } from 'react-router'
import { ErrorState, PageHeader, Skeleton } from '../../components/ui/index.ts'
import {
  useCompetitionRounds,
  useCompetitions,
  useCompetitorRows,
  useEvents,
  useResultEventIds,
  useResults,
} from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, competitorName, eventCode, eventDances, eventGrade, formatDate, ordinal } from '../../lib/format.ts'

function Podium({ eventId }: { eventId: string }) {
  const results = useResults(eventId)
  const people = useCompetitorRows()
  const byId = new Map((people.data ?? []).map((c) => [c.id, c]))
  const top = [...(results.data ?? [])].filter((r) => r.place <= 3).sort((a, b) => a.place - b.place)

  return (
    <ol className="flex flex-col divide-y divide-neutral-100">
      {top.map((r) => (
        <li key={r.id} className="flex items-baseline gap-4 py-2.5 text-small">
          <span className="w-10 text-neutral-500">{ordinal(r.place)}</span>
          <span className="w-12 font-mono tabular-nums text-neutral-900">{byId.get(r.competitorId)?.backNumber}</span>
          <Link to={`/competitors/${r.competitorId}`} className="flex-1 truncate font-medium text-neutral-900 hover:underline">
            {competitorName(byId.get(r.competitorId)?.names ?? [])}
          </Link>
          <span className="hidden truncate text-neutral-500 sm:block">{byId.get(r.competitorId)?.clubName}</span>
        </li>
      ))}
    </ol>
  )
}

export function HomePage() {
  const competitions = useCompetitions()
  const current = [...(competitions.data ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0]
  const rounds = useCompetitionRounds(current?.id ?? '')
  const events = useEvents(current?.id)
  const withResults = useResultEventIds(current?.id ?? '')

  if (competitions.isError) return <ErrorState onRetry={() => void competitions.refetch()} />
  if (!current) return <Skeleton className="h-40 w-full" />

  const live = (rounds.data ?? []).find((r) => r.status === RoundStatus.Marking || r.status === RoundStatus.Review)
  const latest = [...(events.data ?? [])]
    .filter((e) => withResults.data?.includes(e.id))
    .sort((a, b) => b.number - a.number)
    .slice(0, 3)

  return (
    <div className="flex flex-col gap-12">
      <PageHeader title={current.name} description={`${formatDate(current.date)} · ${current.venue}`} />

      {live && (
        <section aria-label="On the floor now" className="flex flex-col gap-2 border-y border-neutral-200 py-6">
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
            <span aria-hidden className="size-1.5 rounded-full bg-gold-400" />
            On the floor now
          </p>
          <p className="text-display font-semibold leading-tight text-neutral-900">
            <span className="mr-3 font-mono text-title font-medium text-neutral-400">{eventCode({ number: live.eventNumber })}</span>
            {eventDances(live)}
          </p>
          <p className="text-body text-neutral-600">
            {ROUND_TYPE_LABEL[live.type]} · {eventGrade(live)}
          </p>
        </section>
      )}

      <section aria-label="Latest results" className="flex flex-col gap-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-title font-semibold text-neutral-900">Latest results</h2>
          <Link to={`/competitions/${current.id}`} className="text-small font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900">
            All events <span aria-hidden>→</span>
          </Link>
        </div>
        {!events.data || !withResults.data ? (
          <Skeleton className="h-32 w-full" />
        ) : latest.length === 0 ? (
          <p className="text-small text-neutral-600">No results are published yet. They appear here as each event finishes.</p>
        ) : (
          <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
            {latest.map((e) => (
              <article key={e.id} className="flex flex-col gap-2">
                <header>
                  <h3 className="font-semibold text-neutral-900">
                    <Link to={`/competitions/${current.id}/events/${e.id}`} className="hover:underline">
                      <span className="mr-2 font-mono text-neutral-400">{eventCode(e)}</span>
                      {eventDances(e)}
                    </Link>
                  </h3>
                  <p className="text-small text-neutral-600">{eventGrade(e)}</p>
                </header>
                <Podium eventId={e.id} />
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Rankings" className="flex flex-col gap-2 border-t border-neutral-200 pt-6">
        <h2 className="text-title font-semibold text-neutral-900">Rankings</h2>
        <p className="max-w-prose text-body text-neutral-600">
          Points add up across competitions in each age group, class and discipline.{' '}
          <Link to="/rankings" className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900">
            See the rankings
          </Link>
        </p>
      </section>
    </div>
  )
}
