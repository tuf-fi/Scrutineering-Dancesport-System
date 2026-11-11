import { Role, RoundStatus, type ScheduleItem } from '@bis/shared'
import { ArrowUpDown, Pencil } from 'lucide-react'
import { useState } from 'react'
import { CompetitionSelect } from '../../components/CompetitionSelect.tsx'
import { ErrorState, IconButton, PageHeader, Table, Toolbar, toast } from '../../components/ui/index.ts'
import { useMoveScheduledEventTo, useSchedule, useCatalog } from '../../hooks/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { DISCIPLINE_LABEL, ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'
import { useAuth } from '../../stores/auth.ts'
import { EventRoundsDialog } from './EventRoundsDialog.tsx'
import { MovePositionDialog } from './MovePositionDialog.tsx'

export function SchedulePage() {
  const { ageGroupLabel } = useCatalog()
  const [chosen, setChosen] = useState<string | null>(null)
  const { list, competitionId } = useCompetitionChoice(chosen)
  const schedule = useSchedule(competitionId ?? '')
  const move = useMoveScheduledEventTo()
  // The event whose rounds are being set
  const [setting, setSetting] = useState<ScheduleItem | null>(null)
  const [placing, setPlacing] = useState<ScheduleItem | null>(null)
  // The scrutineer chooses rounds; the secretariat and the admin also set the order
  const role = useAuth((s) => s.user?.role)
  const canOrder = role === Role.Admin || role === Role.Secretariat

  if (schedule.isError) return <ErrorState onRetry={() => void schedule.refetch()} />

  const items = schedule.data ?? []

  // An event that has started keeps its place on the floor
  const started = (item: ScheduleItem) => item.rounds.some((r) => r.status !== RoundStatus.Pending)

  // Dropping an event on another takes the other's place in the order
  function moveTo(item: ScheduleItem, to: number) {
    if (!competitionId) return
    move.mutate(
      { competitionId, eventId: item.eventId, to },
      { onSuccess: () => toast.success(`Moved ${eventCode({ number: item.eventNumber })} to place ${to}`), onError: (e) => toast.error(e.message) },
    )
  }
  const drop = (item: ScheduleItem, target: ScheduleItem) => moveTo(item, target.position)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Schedule" description={canOrder ? 'Drag events into the order they are danced in, and choose the rounds each one runs.' : 'The order events are danced in, and the rounds each one runs. Click the rounds to change them.'} />

      <Toolbar>
        <CompetitionSelect list={list} value={competitionId} onChange={setChosen} />
      </Toolbar>

      <Table<ScheduleItem>
        loading={schedule.isLoading || !competitionId}
        rows={items}
        rowKey={(i) => i.eventId}
        minWidthClass="min-w-0"
        paginationLabel="Schedule pagination"
        onReorder={canOrder ? drop : undefined}
        canReorder={(i) => !started(i) && !move.isPending}
        reorderLabel={(i) => `Drag ${eventCode({ number: i.eventNumber })} to move it. Arrow keys move it one place.`}
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
                  {ageGroupLabel(i.ageGroup)} · {i.class} · {DISCIPLINE_LABEL[i.discipline]}
                </span>
              </div>
            ),
          },
          {
            key: 'rounds',
            header: 'Rounds',
            cell: (i) => (
              <button
                type="button"
                onClick={() => setSetting(i)}
                className="text-left underline decoration-neutral-400 underline-offset-4 hover:decoration-gold-500"
              >
                {i.rounds.length ? i.rounds.map((r) => ROUND_TYPE_LABEL[r.type]).join(' › ') : 'Not planned'}
              </button>
            ),
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
                {canOrder && (
                  <IconButton icon={ArrowUpDown} label={`Move ${eventCode({ number: i.eventNumber })} to a position`} disabled={started(i) || move.isPending} onClick={() => setPlacing(i)} />
                )}
                <IconButton icon={Pencil} label={`Set the rounds of ${eventCode({ number: i.eventNumber })}`} onClick={() => setSetting(i)} />
              </div>
            ),
          },
        ]}
      />

      <EventRoundsDialog item={setting} onClose={() => setSetting(null)} />
      <MovePositionDialog
        title={placing ? eventCode({ number: placing.eventNumber }) : null}
        current={placing?.position ?? 1}
        total={items.length}
        onMove={(to) => placing && moveTo(placing, to)}
        onClose={() => setPlacing(null)}
      />
    </div>
  )
}
