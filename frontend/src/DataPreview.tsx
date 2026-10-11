import { RoundStatus, SubmissionStatus, type Event } from '@bis/shared'
import { Badge, Card, Skeleton, Table, type BadgeTone } from './components/ui/index.ts'
import {
  useAdjudicators,
  useCompetitions,
  useEntries,
  useEvents,
  useLiveSubmissions,
  useRounds,
} from './hooks/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances, eventGrade } from './lib/format.ts'

// TODO: temporary check of the sample data layer; removed once real screens use these hooks

const STATUS_TONE: Record<string, BadgeTone> = {
  [SubmissionStatus.Submitted]: 'success',
  [SubmissionStatus.Marking]: 'gold',
  [SubmissionStatus.Waiting]: 'neutral',
}

function LiveBoard({ roundId }: { roundId: string }) {
  const submissions = useLiveSubmissions(roundId)
  const { data: adjudicators } = useAdjudicators()
  const letter = (id: string) => adjudicators?.find((a) => a.id === id)?.letter ?? '?'
  return (
    <div className="flex flex-wrap gap-2">
      {submissions.map((s) => (
        <Card key={s.adjudicatorId} className="flex w-24 flex-col items-center gap-2 p-3">
          <span className="font-mono text-title font-semibold">{letter(s.adjudicatorId)}</span>
          <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge>
        </Card>
      ))}
    </div>
  )
}

function FeaturedEvent({ event }: { event: Event }) {
  const { data: rounds } = useRounds(event.id)
  const { data: entries } = useEntries(event.id)
  const live = rounds?.find(
    (r) => r.status === RoundStatus.Marking || r.status === RoundStatus.Review,
  )
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body">
        <span className="font-mono">{eventCode(event)}</span> {eventDances(event)} ·{' '}
        {eventGrade(event)} · {entries?.length ?? '…'} entries
      </p>
      {live ? (
        <>
          <p className="font-mono text-label uppercase text-gold-700">
            Live: {ROUND_TYPE_LABEL[live.type]}, recall {live.recallNumber}
          </p>
          <LiveBoard roundId={live.id} />
        </>
      ) : (
        <Skeleton className="h-20 w-full" />
      )}
    </div>
  )
}

export function DataPreview() {
  const { data: competitions } = useCompetitions()
  const current = competitions?.[0]
  const { data: events, isLoading } = useEvents(current?.id)
  const featured = events?.find(
    (e) => e.ageGroup === 'junior_1' && e.class === 'E1' && e.dances[0] === 'cha_cha_cha',
  )

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title font-bold">Sample data: {current?.name ?? '…'}</h2>
      {featured && <FeaturedEvent event={featured} />}
      <Table
        loading={isLoading || !events}
        rows={(events ?? []).slice(0, 12)}
        rowKey={(e) => e.id}
        columns={[
          { key: 'n', header: 'Event', cell: (e) => eventCode(e), mono: true },
          { key: 'g', header: 'Grade', cell: (e) => eventGrade(e) },
          { key: 'd', header: 'Dances', cell: (e) => eventDances(e) },
          { key: 's', header: 'Type', cell: (e) => (e.isSolo ? 'Solo' : 'Couple') },
        ]}
      />
    </section>
  )
}
