import { RoundStatus, type CompetitorRow } from '@bis/shared'
import { useMemo, useState, type ReactNode } from 'react'
import { ROUND_STATUS_LABEL } from '../../components/RoundStatusBadge.tsx'
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Table,
  Toolbar,
  ToolbarActions,
  toast,
} from '../../components/ui/index.ts'
import { useCompetitorRows, useHeatAssignments, useSaveHeats } from '../../hooks/index.ts'
import { competitorName } from '../../lib/format.ts'
import { RoundSelect } from './RoundSelect.tsx'
import { useRoundChoice } from './useRoundChoice.ts'

const DEFAULT_HEAT_SIZE = 12

interface Row {
  competitorId: string
  backNumber: number | null
  names: string[]
  heat: number
}

function HeatEditor({
  roundId,
  initial,
  editable,
  status,
  roundSelect,
}: {
  roundId: string
  initial: Array<{ competitorId: string; heat: number }>
  editable: boolean
  status?: RoundStatus
  // Sits first in the toolbar, so the whole page has one row of controls
  roundSelect: ReactNode
}) {
  const people = useCompetitorRows()
  const save = useSaveHeats()
  const [assign, setAssign] = useState(() => new Map(initial.map((a) => [a.competitorId, a.heat])))
  const [size, setSize] = useState(String(DEFAULT_HEAT_SIZE))

  const byId = useMemo(() => new Map((people.data ?? []).map((c: CompetitorRow) => [c.id, c])), [people.data])
  const rows: Row[] = initial
    .map((a) => ({
      competitorId: a.competitorId,
      backNumber: byId.get(a.competitorId)?.backNumber ?? null,
      names: byId.get(a.competitorId)?.names ?? [],
      heat: assign.get(a.competitorId) ?? a.heat,
    }))
    .sort((a, b) => (a.backNumber ?? 0) - (b.backNumber ?? 0))

  const heatNumbers = [...new Set(rows.map((r) => r.heat))].sort((a, b) => a - b)
  const sizes = heatNumbers.map((n) => rows.filter((r) => r.heat === n).length)
  const dirty = initial.some((a) => assign.get(a.competitorId) !== a.heat)

  // Splits the field evenly into the fewest heats of at most `size` competitors
  function split() {
    const per = Math.max(1, Math.floor(Number(size)) || DEFAULT_HEAT_SIZE)
    const count = Math.ceil(rows.length / per)
    const even = Math.ceil(rows.length / count)
    setAssign(new Map(rows.map((r, i) => [r.competitorId, Math.floor(i / even) + 1])))
  }

  function onSave() {
    save.mutate(
      { roundId, assignments: rows.map((r) => ({ competitorId: r.competitorId, heat: r.heat })) },
      { onSuccess: () => toast.success('Heats saved'), onError: (e) => toast.error(e.message) },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="status"
        className="flex flex-col gap-6 overflow-hidden rounded-2xl bg-brown-950 bg-[radial-gradient(36rem_12rem_at_100%_0%,rgb(228_178_46/0.14),transparent_60%)] p-5 text-white sm:px-8 sm:py-6"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-baseline gap-3">
            <span className="font-mono text-4xl leading-none tabular-nums">{heatNumbers.length}</span>{' '}
            <span className="text-body text-brown-100">
              heat{heatNumbers.length === 1 ? '' : 's'} · <span className="font-mono tabular-nums">{rows.length}</span> competitors
            </span>
          </p>
          {status && (
            <p className="flex items-center gap-2.5 text-small font-semibold">
              <span className="relative flex size-2">
                {status === RoundStatus.Marking && (
                  <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-gold-400 opacity-60 motion-reduce:hidden" />
                )}
                <span aria-hidden className="relative size-2 rounded-full bg-gold-400" />
              </span>
              {ROUND_STATUS_LABEL[status]}
            </p>
          )}
        </div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-[repeat(auto-fit,minmax(7rem,1fr))]">
          {heatNumbers.map((n, i) => (
            <li key={n} className="flex min-w-0 flex-col gap-2">
              <span aria-hidden className="h-0.5 overflow-hidden rounded-full bg-white/15">
                <span className="block h-full bg-gold-400" style={{ width: `${(sizes[i] / Math.max(...sizes)) * 100}%` }} />
              </span>
              <span className="flex items-baseline justify-between gap-2 text-xs text-brown-100/70">
                <span className="truncate">Heat {n}</span>
                <span className="font-mono tabular-nums text-white">{sizes[i]}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>


      <Toolbar>
        {roundSelect}
        {editable && (
          <>
            <div className="w-full sm:w-28">
              <Input
                label="Per heat"
                inputMode="numeric"
                value={size}
                onChange={(e) => setSize(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <ToolbarActions>
              <Button variant="secondary" onClick={split}>
                Split evenly
              </Button>
              <Button disabled={!dirty || save.isPending} onClick={onSave}>
                {save.isPending ? 'Saving…' : 'Save heats'}
              </Button>
            </ToolbarActions>
          </>
        )}
      </Toolbar>
      <Table<Row>
        loading={people.isLoading}
        rows={rows}
        rowKey={(r) => r.competitorId}
        minWidthClass="min-w-0"
        paginationLabel="Competitors pagination"
        empty={{ title: 'No competitors in this round' }}
        columns={[
          { key: 'back', header: 'Back no.', cell: (r) => r.backNumber ?? '–', mono: true, widthClass: 'w-28' },
          { key: 'who', header: 'Competitor', cell: (r) => <span className="font-medium">{competitorName(r.names)}</span> },
          {
            key: 'heat',
            header: 'Heat',
            align: 'right',
            widthClass: 'w-36',
            cell: (r) =>
              editable ? (
                <div className="ml-auto w-24">
                  <Select
                    label={`Heat for ${competitorName(r.names)}`}
                    hideLabel
                    value={r.heat}
                    onChange={(e) => setAssign((a) => new Map(a).set(r.competitorId, Number(e.target.value)))}
                    className="h-8! font-mono"
                  >
                    {Array.from({ length: Math.max(...heatNumbers) + 1 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : (
                r.heat
              ),
            mono: true,
          },
        ]}
      />
    </div>
  )
}

export function HeatsPage() {
  const { rounds, list, roundId, row, setRoundId, readOnly } = useRoundChoice()
  const heats = useHeatAssignments(roundId)

  if (rounds.isError || heats.isError) return <ErrorState onRetry={() => void Promise.all([rounds.refetch(), heats.refetch()])} />

  const roundSelect = <RoundSelect rounds={list} value={roundId} onChange={setRoundId} />
  const closed = row?.status === RoundStatus.Approved || row?.status === RoundStatus.Published

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Heats"
        description="Split the round's competitors into heats, then move anyone who needs a different one."
      />
      {!heats.data || heats.data.length === 0 ? (
        <>
          <Toolbar>{roundSelect}</Toolbar>
          {!heats.data ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="rounded-xl border border-neutral-200 px-6">
              <EmptyState title="No competitors yet" description="This round has no field until the previous round is decided." />
            </div>
          )}
        </>
      ) : (
        <HeatEditor
          key={roundId}
          roundId={roundId}
          initial={heats.data}
          editable={!readOnly && !closed}
          status={row?.status}
          roundSelect={roundSelect}
        />
      )}
    </div>
  )
}
