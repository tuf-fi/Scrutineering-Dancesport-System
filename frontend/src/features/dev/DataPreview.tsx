import { RoundStatus, SubmissionStatus, type AdjudicatorSubmission, type Event } from '@bis/shared'
import { Badge, Button, Skeleton, Table, type BadgeTone } from '../../components/ui/index.ts'
import {
  useAdjudicators,
  useCompetitions,
  useEntries,
  useEvents,
  useLiveSubmissions,
  useRounds,
} from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances, eventGrade } from '../../lib/format.ts'

// Development-only check of the sample data layer; removed once real screens use these hooks

const STATUS: Record<string, { tone: BadgeTone; label: string }> = {
  [SubmissionStatus.Submitted]: { tone: 'success', label: 'Submitted' },
  [SubmissionStatus.Marking]: { tone: 'gold', label: 'Marking' },
  [SubmissionStatus.Waiting]: { tone: 'neutral', label: 'Waiting' },
}

function LiveBoard({ submissions }: { submissions: AdjudicatorSubmission[] }) {
  const { data: adjudicators } = useAdjudicators()
  const letter = (id: string) => adjudicators?.find((a) => a.id === id)?.letter ?? ''
  return (
    <ul className="grid grid-cols-4 border-y border-neutral-900 sm:grid-cols-7">
      {submissions.map((s) => {
        const status = STATUS[s.status]
        return (
          <li
            key={s.adjudicatorId}
            className="flex flex-col gap-1.5 border-b border-neutral-200 py-4 pr-3 last:border-b-0 sm:border-b-0 sm:border-l sm:pl-4 sm:first:border-l-0 sm:first:pl-0"
          >
            <span className="font-mono text-title font-medium">{letter(s.adjudicatorId)}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </li>
        )
      })}
    </ul>
  )
}

function Round({ event }: { event: Event }) {
  const { data: rounds } = useRounds(event.id)
  const live = rounds?.find(
    (r) => r.status === RoundStatus.Marking || r.status === RoundStatus.Review,
  )
  const submissions = useLiveSubmissions(live?.id ?? '')
  const done = submissions.filter((s) => s.status === SubmissionStatus.Submitted).length

  if (!live) return <Skeleton className="h-24 w-full" />
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-title font-semibold">{ROUND_TYPE_LABEL[live.type]} in progress</h2>
        <p className="text-small text-neutral-600">
          <span className="font-mono tabular-nums text-neutral-900">{done}</span> of{' '}
          <span className="font-mono tabular-nums text-neutral-900">{submissions.length}</span>{' '}
          adjudicators submitted · recall{' '}
          <span className="font-mono tabular-nums text-neutral-900">{live.recallNumber}</span>
        </p>
      </div>
      <LiveBoard submissions={submissions} />
    </section>
  )
}

export function DataPreview() {
  const { data: competitions } = useCompetitions()
  const current = competitions?.[0]
  const { data: events, isLoading } = useEvents(current?.id)
  const featured = events?.find(
    (e) => e.ageGroup === 'junior_1' && e.class === 'E1' && e.dances[0] === 'cha_cha_cha',
  )
  const { data: entries } = useEntries(featured?.id ?? '')

  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-col gap-3">
        {featured ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
              <h1 className="text-display font-semibold text-neutral-900">
                {eventDances(featured)}
              </h1>
              <Button size="lg">Open round</Button>
            </div>
            <p className="text-body text-neutral-600">
              <span className="font-mono tabular-nums text-neutral-900">{eventCode(featured)}</span>{' '}
              · {eventGrade(featured)} · Solo ·{' '}
              <span className="font-mono tabular-nums text-neutral-900">{entries?.length ?? '–'}</span>{' '}
              entries
            </p>
          </>
        ) : (
          <>
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-12 w-80" />
            <Skeleton className="h-5 w-64" />
          </>
        )}
      </div>

      {featured && <Round event={featured} />}

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="text-title font-semibold">Program</h2>
          <p className="text-small text-neutral-600">{current?.name}</p>
        </div>
        <Table
          loading={isLoading || !events}
          rows={(events ?? []).slice(0, 8)}
          rowKey={(e) => e.id}
          columns={[
            { key: 'n', header: 'Event', cell: (e) => eventCode(e), mono: true },
            { key: 'd', header: 'Dances', cell: (e) => eventDances(e) },
            { key: 'g', header: 'Grade', cell: (e) => eventGrade(e) },
            { key: 's', header: 'Type', cell: (e) => (e.isSolo ? 'Solo' : 'Couple'), align: 'right' },
          ]}
        />
      </section>
    </div>
  )
}
