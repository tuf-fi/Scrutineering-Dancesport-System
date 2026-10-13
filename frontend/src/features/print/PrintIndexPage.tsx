import { Link, useSearchParams } from 'react-router'
import { ErrorState, PageHeader, Select, Skeleton } from '../../components/ui/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { useEvents, useRounds } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'

// Pick an event and a round, then open any sheet for it in a new tab to print or save as PDF
export function PrintIndexPage() {
  const [params, setParams] = useSearchParams()
  const { competitionId } = useCompetitionChoice(null)
  const events = useEvents(competitionId)
  const list = [...(events.data ?? [])].sort((a, b) => a.number - b.number)
  const eventId = list.find((e) => e.id === params.get('event'))?.id ?? list[0]?.id ?? ''
  const rounds = useRounds(eventId)
  const roundId = rounds.data?.find((r) => r.id === params.get('round'))?.id ?? ''
  const query = roundId ? `?round=${roundId}` : ''

  if (events.isError) return <ErrorState onRetry={() => void events.refetch()} />

  const sheets: Array<[string, string, string]> = [
    ['Heat list', `/print/heats/${eventId}${query}`, 'Who dances in which heat'],
    ['Qualified list', `/print/recall/${eventId}${query}`, 'Who goes through to the next round'],
    ['Scores sheet', `/print/scores/${eventId}${query}`, "Every adjudicator's marks"],
    ['Final results', `/print/results/${eventId}`, 'Placings, with room to sign'],
    ['Blank mark sheets', `/print/blank-sheets/${eventId}${query}`, 'One per adjudicator, for the paper fallback'],
  ]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Printouts" description="A4 pages that print from any browser or save as PDF." />

      {!events.data ? (
        <Skeleton className="h-24 w-full max-w-xl" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Event" value={eventId} onChange={(e) => setParams({ event: e.target.value })}>
            {list.map((e) => (
              <option key={e.id} value={e.id}>
                {eventCode(e)} {eventDances(e)}
              </option>
            ))}
          </Select>
          <Select
            label="Round"
            value={roundId}
            onChange={(e) => setParams({ event: eventId, ...(e.target.value ? { round: e.target.value } : {}) })}
          >
            <option value="">Latest round</option>
            {(rounds.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {ROUND_TYPE_LABEL[r.type]}
              </option>
            ))}
          </Select>
        </div>
      )}

      <ul aria-label="Sheets" className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200">
        {sheets.map(([label, to, hint]) => (
          <li key={label}>
            <Link
              to={to}
              target="_blank"
              className="flex items-baseline justify-between gap-4 py-4 text-neutral-900 hover:bg-neutral-50"
            >
              <span className="font-medium">{label}</span>
              <span className="text-small text-neutral-600">{hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
