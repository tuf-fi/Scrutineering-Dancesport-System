import { RoundStatus, type ScheduleItem } from '@bis/shared'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { CompetitionSelect } from '../../components/CompetitionSelect.tsx'
import { ErrorState, IconButton, PageHeader, Table, Toolbar, toast } from '../../components/ui/index.ts'
import { useMoveScheduledEvent, useSchedule } from '../../hooks/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { AGE_GROUP_LABEL, DISCIPLINE_LABEL, ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'

export function SchedulePage() {
  const [chosen, setChosen] = useState<string | null>(null)
  const { list, competitionId } = useCompetitionChoice(chosen)
  const schedule = useSchedule(competitionId ?? '')
  const move = useMoveScheduledEvent()

  if (schedule.isError) return <ErrorState onRetry={() => void schedule.refetch()} />

  const items = schedule.data ?? []
  const last = items.length

  // An event that has started keeps its place on the floor
  const started = (item: ScheduleItem) => item.rounds.some((r) => r.status !== RoundStatus.Pending)

  function shift(item: ScheduleItem, direction: 'up' | 'down') {
    if (!competitionId) return
    move.mutate(
      { competitionId, eventId: item.eventId, direction },
      { onError: (e) => toast.error(e.message) },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Schedule" description="The order events are danced in, and the rounds each one runs." />

      <Toolbar>
        <CompetitionSelect list={list} value={competitionId} onChange={setChosen} />
      </Toolbar>

      <Table<ScheduleItem>
        loading={schedule.isLoading || !competitionId}
        rows={items}
        rowKey={(i) => i.eventId}
        minWidthClass="min-w-0"
        paginationLabel="Schedule pagination"
        detailTitle={(i) => `${eventCode({ number: i.eventNumber })} ${eventDances(i)}`}
        empty={{ title: 'No events scheduled', description: 'Events appear here once the competition has them.' }}
        columns={[
          { key: 'position', header: 'Order', cell: (i) => i.position, mono: true, widthClass: 'w-20' },
          {
            key: 'event',
            header: 'Event',
            cell: (i) => (
              <div className="flex flex-col">
                <span className="font-medium text-neutral-900">
                  <span className="font-mono tabular-nums">{eventCode({ number: i.eventNumber })}</span> {eventDances(i)}
                </span>
                <span className="text-xs text-neutral-500">
                  {AGE_GROUP_LABEL[i.ageGroup]} · {i.class} · {DISCIPLINE_LABEL[i.discipline]}
                </span>
              </div>
            ),
          },
          {
            key: 'rounds',
            header: 'Rounds',
            cell: (i) =>
              i.rounds.length ? i.rounds.map((r) => ROUND_TYPE_LABEL[r.type]).join(' › ') : 'Not planned',
            muted: true,
            hideBelow: 'sm',
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (i) => (
              <div className="flex justify-end gap-0.5">
                <IconButton
                  icon={ArrowUp}
                  label={`Move ${eventCode({ number: i.eventNumber })} up`}
                  disabled={i.position === 1 || started(i) || move.isPending}
                  onClick={() => shift(i, 'up')}
                />
                <IconButton
                  icon={ArrowDown}
                  label={`Move ${eventCode({ number: i.eventNumber })} down`}
                  disabled={i.position === last || started(i) || move.isPending}
                  onClick={() => shift(i, 'down')}
                />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
