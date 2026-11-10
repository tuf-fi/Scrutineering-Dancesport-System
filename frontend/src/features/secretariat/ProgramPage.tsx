import { ProgramKind, type ProgramRow } from '@bis/shared'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CompetitionSelect } from '../../components/CompetitionSelect.tsx'
import { ProgramStatusBadge } from '../../components/ProgramStatusBadge.tsx'
import {
  Button,
  ButtonLink,
  Dialog,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
  Table,
  Toolbar,
  ToolbarActions,
  toast,
} from '../../components/ui/index.ts'
import {
  useGenerateProgram,
  useMoveProgramSlot,
  useProgram,
  useRemoveProgramSlot,
  useSetProgramStart,
  useCatalog,
} from '../../hooks/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import {
  PROGRAM_KIND_LABEL,
  ROUND_TYPE_LABEL,
  eventCode,
  eventDances,
  formatClock,
  programLineName,
} from '../../lib/format.ts'
import { programPrintPath } from '../../lib/programFilter.ts'
import { ProgramLineDialog } from './ProgramLineDialog.tsx'

const fail = { onError: (e: Error) => toast.error(e.message) }

// Holds what is typed and saves it when the field is left; the key resets it when the saved time changes
function StartField({ saved, disabled, onSave }: { saved: string; disabled: boolean; onSave: (value: string) => void }) {
  const [value, setValue] = useState(saved)
  return (
    <div className="w-full sm:w-40">
      <Input
        label="Starts at"
        type="time"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value !== saved && onSave(value)}
        disabled={disabled}
        className="font-mono tabular-nums"
      />
    </div>
  )
}

export function ProgramPage() {
  const { eventGrade } = useCatalog()
  const [chosen, setChosen] = useState<string | null>(null)
  const { list, competitionId } = useCompetitionChoice(chosen)
  const program = useProgram(competitionId ?? '')
  const generate = useGenerateProgram(competitionId ?? '')
  const setStart = useSetProgramStart(competitionId ?? '')
  const move = useMoveProgramSlot(competitionId ?? '')
  const remove = useRemoveProgramSlot(competitionId ?? '')
  // The line being edited, or 'new' while adding a break
  const [editing, setEditing] = useState<ProgramRow | 'new' | null>(null)
  const [toRemove, setToRemove] = useState<ProgramRow | null>(null)
  if (program.isError) return <ErrorState onRetry={() => void program.refetch()} />

  const rows = program.data?.rows ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Program"
        description="The running order: every round, break and the awarding, with the time each starts."
      />

      <Toolbar>
        <CompetitionSelect list={list} value={competitionId} onChange={setChosen} />
        <StartField
          key={program.data?.start ?? ''}
          saved={program.data?.start ?? ''}
          disabled={!competitionId}
          onSave={(value) => setStart.mutate(value || null, fail)}
        />
        <ToolbarActions>
          <Button
            variant="secondary"
            disabled={!competitionId || generate.isPending}
            onClick={() => generate.mutate(undefined, { ...fail, onSuccess: () => toast.success('Program updated from the events') })}
          >
            {generate.isPending ? 'Generating…' : rows.length ? 'Add missing rounds' : 'Generate'}
          </Button>
          {competitionId && rows.length > 0 && (
            <ButtonLink variant="secondary" to={programPrintPath(competitionId, '', 'all')} target="_blank">
              Print
            </ButtonLink>
          )}
          <Button disabled={!competitionId} onClick={() => setEditing('new')}>
            Add break
          </Button>
        </ToolbarActions>
      </Toolbar>

      <Table<ProgramRow>
        loading={program.isLoading || !competitionId}
        rows={rows}
        rowKey={(r) => r.slotId}
        minWidthClass="min-w-0"
        paginationLabel="Program pagination"
        detailTitle={programLineName}
        empty={{
          title: 'No program yet',
          description: 'Generate it from the events, then set the start time and add breaks.',
        }}
        columns={[
          { key: 'time', header: 'Time', cell: (r) => formatClock(r.startTime), mono: true, widthClass: 'w-28' },
          { key: 'seq', header: 'Sequence no.', cell: (r) => r.sequence, mono: true, muted: true, widthClass: 'w-28', hideBelow: 'sm' },
          {
            key: 'what',
            header: 'Event',
            cell: (r) =>
              r.kind === ProgramKind.Round && r.eventNumber !== null && r.ageGroup && r.class && r.discipline ? (
                <div className="flex flex-col">
                  <span className="font-medium text-neutral-900">
                    <span className="font-mono tabular-nums">{eventCode({ number: r.eventNumber })}</span> {eventDances(r)}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {eventGrade({ ageGroup: r.ageGroup, class: r.class, discipline: r.discipline })}
                  </span>
                </div>
              ) : (
                <span className="font-medium text-neutral-900">
                  {r.label} <span className="font-normal text-neutral-500">· {PROGRAM_KIND_LABEL[r.kind]}</span>
                </span>
              ),
          },
          { key: 'round', header: 'Round', cell: (r) => (r.roundType ? ROUND_TYPE_LABEL[r.roundType] : ''), muted: true, hideBelow: 'sm' },
          { key: 'entries', header: 'Dancing', cell: (r) => (r.kind === ProgramKind.Round ? r.entryCount : ''), mono: true, align: 'right', hideBelow: 'md' },
          { key: 'minutes', header: 'Min', cell: (r) => r.minutes, mono: true, align: 'right', hideBelow: 'sm' },
          { key: 'status', header: 'Status', cell: (r) => <ProgramStatusBadge status={r.status} />, hideBelow: 'md' },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-36',
            cell: (r) => (
              <div className="flex justify-end gap-0.5">
                <IconButton
                  icon={ArrowUp}
                  label={`Move ${programLineName(r)} up`}
                  disabled={r.sequence === 1 || move.isPending}
                  onClick={() => move.mutate({ slotId: r.slotId, direction: 'up' }, fail)}
                />
                <IconButton
                  icon={ArrowDown}
                  label={`Move ${programLineName(r)} down`}
                  disabled={r.sequence === rows.length || move.isPending}
                  onClick={() => move.mutate({ slotId: r.slotId, direction: 'down' }, fail)}
                />
                <IconButton icon={Pencil} label={`Edit ${programLineName(r)}`} onClick={() => setEditing(r)} />
                <IconButton icon={Trash2} tone="danger" label={`Remove ${programLineName(r)}`} onClick={() => setToRemove(r)} />
              </div>
            ),
          },
        ]}
      />

      {competitionId && (
        <ProgramLineDialog
          open={editing !== null}
          competitionId={competitionId}
          row={editing === 'new' ? null : editing}
          lastSequence={rows.length}
          onClose={() => setEditing(null)}
        />
      )}

      <Dialog
        open={toRemove !== null}
        onClose={() => setToRemove(null)}
        title={`Remove ${toRemove ? programLineName(toRemove) : ''}?`}
        description="It leaves the program only; the event and its entries stay. Add missing rounds puts a round back."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() =>
                toRemove &&
                remove.mutate(toRemove.slotId, {
                  onSuccess: () => setToRemove(null),
                  onError: (e) => {
                    setToRemove(null)
                    toast.error(e.message)
                  },
                })
              }
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </>
        }
      />
    </div>
  )
}
