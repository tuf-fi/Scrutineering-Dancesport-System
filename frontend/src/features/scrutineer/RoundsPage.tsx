import { RoundStatus, SubmissionStatus, type RoundRow, type RoundType } from '@bis/shared'
import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { RoundStatusBadge, ROUND_STATUS_LABEL } from '../../components/RoundStatusBadge.tsx'
import { Button, ErrorState, DarkPanel, PageHeader, SearchField, Select, Table, Toolbar, ToolbarActions, glass, toast } from '../../components/ui/index.ts'
import { ApiError } from '../../api/http.ts'
import { useClearFloor, useLiveSubmissions, usePlanRounds, useRedances, useStartRound, useCatalog } from '../../hooks/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'
import { useRoundChoice } from './useRoundChoice.ts'

const ROUND_ORDER: RoundType[] = ['round_1', 'round_2', 'quarter_final', 'semi_final', 'final']

// A round can start once the one before it in the same event is approved or published
function canStart(row: RoundRow, all: RoundRow[]): boolean {
  if (row.status !== RoundStatus.Pending) return false
  const earlier = all
    .filter((r) => r.eventId === row.eventId && ROUND_ORDER.indexOf(r.type) < ROUND_ORDER.indexOf(row.type))
    .sort((a, b) => ROUND_ORDER.indexOf(b.type) - ROUND_ORDER.indexOf(a.type))[0]
  return !earlier || earlier.status === RoundStatus.Approved || earlier.status === RoundStatus.Published
}

function OnTheFloor({ row, readOnly }: { row: RoundRow; readOnly: boolean }) {
  const { ageGroupLabel } = useCatalog()
  const clear = useClearFloor()
  const submissions = useLiveSubmissions(row.roundId)
  const submitted = submissions.filter((s) => s.status === SubmissionStatus.Submitted).length
  const redance = useRedances(row.roundId).data?.find((x) => !x.doneAt)
  const canRedance = !readOnly && (row.status === RoundStatus.Marking || row.status === RoundStatus.Review)

  const links: Array<[string, string]> = [
    ['Live board', 'live'],
    ['Heats', 'heats'],
    ['Recall', 'recall'],
    ['Results', 'results'],
    ...(canRedance ? ([['Redance', 'heats']] as Array<[string, string]>) : []),
  ]

  return (
    <DarkPanel aria-label={`On the floor: ${eventCode({ number: row.eventNumber })}`} className="flex flex-col gap-8 p-4 sm:p-6 lg:gap-10 lg:p-8">
      <div className="flex items-center justify-between gap-4">
        <p className="text-small text-brown-100">On the floor</p>
        <p className="flex items-center gap-2.5 text-small font-semibold text-white">
          <span className="relative flex size-2">
            {row.status === RoundStatus.Marking && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-gold-400 opacity-60 motion-reduce:hidden" />}
            <span aria-hidden className="relative size-2 rounded-full bg-gold-400" />
          </span>
          {ROUND_STATUS_LABEL[row.status]}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">{eventDances(row)}</h2>
        <p className="flex items-center gap-3 text-body text-brown-100">
          <span className="font-mono tabular-nums text-gold-400">{eventCode({ number: row.eventNumber })}</span>
          <span aria-hidden className="h-3 w-px bg-white/25" />
          {ageGroupLabel(row.ageGroup)} · {row.class}
        </p>
      </div>
      <dl className={`grid grid-cols-2 gap-y-6 p-4 sm:grid-cols-4 sm:divide-x sm:divide-white/10 ${glass}`}>
        {[
          ['Round', ROUND_TYPE_LABEL[row.type]],
          ['Submitted', `${submitted} of ${submissions.length}`],
          ['Heats', row.heatCount || '–'],
          ['Recall', row.recallNumber ?? 'Final'],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1.5 sm:px-6 sm:first:pl-0">
            <dt className="text-xs text-brown-100/60">{label}</dt>
            <dd className="font-mono text-2xl tabular-nums text-white">{value}</dd>
            {label === 'Submitted' && submissions.length > 0 && (
              <div aria-hidden className="mt-1 h-0.5 w-24 overflow-hidden rounded-full bg-white/15">
                <div className="h-full bg-gold-400 transition-[width]" style={{ width: `${(submitted / submissions.length) * 100}%` }} />
              </div>
            )}
          </div>
        ))}
      </dl>
      {redance && (
        <p role="status" className="text-small font-medium text-gold-400">
          {row.recallNumber === null ? 'Redance of the final' : `Redance of heat ${redance.heat}`}: {redance.redone.length} of {redance.required.length} adjudicators have marked it again.
        </p>
      )}
      <nav aria-label="Open this round" className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {links.map(([label, page], i) => (
          <Link
            key={page}
            to={`/scrutineer/${page}?round=${row.roundId}`}
            className={
              (i === 0
                ? 'bg-gold-400 text-black hover:bg-gold-300 active:bg-gold-500 '
                : 'text-brown-100 hover:bg-white/10 hover:text-white ') +
              'mr-1 inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-small font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400'
            }
          >
            {label}
            {i === 0 && <ArrowUpRight aria-hidden size={16} strokeWidth={2} />}
          </Link>
        ))}
        {!readOnly && row.status === RoundStatus.Marking && submitted === 0 && (
          <button
            type="button"
            disabled={clear.isPending}
            onClick={() => clear.mutate(row.roundId, { onSuccess: () => toast.success('Round taken off the floor'), onError: (e) => toast.error(e.message) })}
            className="ml-auto inline-flex h-10 items-center rounded-lg px-4 text-small font-semibold text-brown-100/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
          >
            Take off the floor
          </button>
        )}
      </nav>
    </DarkPanel>
  )
}

export function RoundsPage() {
  const { competitionId, rounds, list, row, readOnly, fallback } = useRoundChoice()
  const start = useStartRound()
  const plan = usePlanRounds()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [starting, setStarting] = useState(false)

  if (rounds.isError) return <ErrorState onRetry={() => void rounds.refetch()} />

  // Every round on the floor, or else the round chosen in the address once it has started
  const floorRows = list.some((r) => r.onFloor) ? list.filter((r) => r.onFloor) : row && !fallback && row.status !== RoundStatus.Pending ? [row] : []
  const needle = query.trim().toLowerCase()
  const rows = [...list]
    .sort((a, b) => (a.sequence ?? Infinity) - (b.sequence ?? Infinity) || a.eventNumber - b.eventNumber)
    .filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (!needle || `${eventCode({ number: r.eventNumber })} ${eventDances(r)} ${ROUND_TYPE_LABEL[r.type]}`.toLowerCase().includes(needle)),
    )

  const startable = rows.filter((r) => canStart(r, list))
  const chosen = startable.filter((r) => picked.has(r.roundId))
  const allChosen = startable.length > 0 && chosen.length === startable.length
  const toggle = (id: string) => setPicked((p) => (p.has(id) ? new Set([...p].filter((x) => x !== id)) : new Set([...p, id])))

  // One after another in table order: the server refuses a round whose adjudicators are already marking another
  async function startChosen() {
    setStarting(true)
    let started = 0
    for (const r of chosen) {
      try {
        await start.mutateAsync(r.roundId)
        started++
      } catch (e) {
        const label = eventCode({ number: r.eventNumber })
        if (e instanceof ApiError && e.status === 409) toast.warning(`${label}: ${e.message}`)
        else toast.error(e instanceof Error ? e.message : 'Could not start the round')
      }
    }
    setPicked(new Set())
    setStarting(false)
    if (started > 0) toast.success(started === 1 ? 'Round on the floor' : `${started} rounds on the floor`)
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Rounds" description="Where the competition is, and every round still to run." />

      {floorRows.map((r) => (
        <OnTheFloor key={r.roundId} row={r} readOnly={readOnly} />
      ))}

      <div className="flex flex-col gap-6">
        <Toolbar>
          <SearchField className="w-full sm:w-72" label="Search rounds" value={query} onChange={setQuery} />
          <div className="w-full sm:w-52">
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {Object.values(RoundStatus).map((s) => (
                <option key={s} value={s}>
                  {ROUND_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </div>
          {!readOnly && (
            <ToolbarActions>
            <Button className="rounded-lg" disabled={chosen.length === 0 || starting} onClick={() => void startChosen()}>
              {starting ? 'Starting…' : chosen.length > 0 ? `Start selected (${chosen.length})` : 'Start selected'}
            </Button>
            <Button
              className="rounded-lg"
              disabled={plan.isPending || !competitionId}
              onClick={() =>
                plan.mutate(competitionId, {
                  onSuccess: (n) => toast.success(n === 0 ? 'Every event with entries already has its rounds' : `Planned rounds for ${n} event${n === 1 ? '' : 's'}`),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              Plan rounds
            </Button>
            </ToolbarActions>
          )}
        </Toolbar>

        <Table<RoundRow>
          loading={rounds.isLoading}
          rows={rows}
          rowKey={(r) => r.roundId}
          minWidthClass="min-w-0"
          paginationLabel="Rounds pagination"
          detailTitle={(r) => `${eventCode({ number: r.eventNumber })} ${eventDances(r)} · ${ROUND_TYPE_LABEL[r.type]}`}
          empty={{ title: 'No rounds match', description: 'Try a different status or search.' }}
          columns={[
            ...(readOnly
              ? []
              : [
                  {
                    key: 'pick',
                    header: '',
                    widthClass: 'w-12',
                    detail: false as const,
                    headerCell: (
                      <input
                        type="checkbox"
                        aria-label="Select every round that can start"
                        checked={allChosen}
                        disabled={startable.length === 0}
                        onChange={() => setPicked(allChosen ? new Set() : new Set(startable.map((r) => r.roundId)))}
                        className="size-4 accent-gold-500"
                      />
                    ),
                    cell: (r: RoundRow) =>
                      canStart(r, list) ? (
                        <input
                          type="checkbox"
                          aria-label={`Select ${eventCode({ number: r.eventNumber })} ${ROUND_TYPE_LABEL[r.type]} to start`}
                          checked={picked.has(r.roundId)}
                          onChange={() => toggle(r.roundId)}
                          className="size-4 accent-gold-500"
                        />
                      ) : null,
                  },
                ]),
            { key: 'sequence', header: 'Sequence', cell: (r) => r.sequence ?? '–', mono: true, muted: true, align: 'center', widthClass: 'w-28' },
            {
              key: 'event',
              header: 'Event',
              cell: (r) => (
                <Link to={`/scrutineer/live?round=${r.roundId}`} className="font-medium text-neutral-900 underline decoration-neutral-400 underline-offset-4 hover:decoration-gold-500">
                  <span className="font-mono tabular-nums">{eventCode({ number: r.eventNumber })}</span> {eventDances(r)}
                </Link>
              ),
            },
            { key: 'round', header: 'Round', cell: (r) => ROUND_TYPE_LABEL[r.type], muted: true },
            { key: 'recall', header: 'Recall', cell: (r) => r.recallNumber ?? 'Final', mono: true, align: 'center', hideBelow: 'sm' },
            { key: 'entries', header: 'Entries', cell: (r) => r.entryCount, mono: true, align: 'center', hideBelow: 'md' },
            { key: 'heats', header: 'Heats', cell: (r) => r.heatCount || '–', mono: true, align: 'center', hideBelow: 'md' },
            { key: 'status', header: 'Status', cell: (r) => <RoundStatusBadge status={r.status} /> },
            ...(readOnly
              ? []
              : [
                  {
                    key: 'start',
                    header: 'Action',
                    align: 'right' as const,
                    detail: false as const,
                    cell: (r: RoundRow) =>
                      canStart(r, list) ? (
                        <Button
                          size="sm"
                          disabled={start.isPending}
                          aria-label={`Start ${eventCode({ number: r.eventNumber })} ${ROUND_TYPE_LABEL[r.type]}`}
                          onClick={() => start.mutate(r.roundId, { onSuccess: () => toast.success('Round on the floor'), onError: (e) => (e instanceof ApiError && e.status === 409 ? toast.warning(e.message) : toast.error(e.message)) })}
                        >
                          Start
                        </Button>
                      ) : null,
                  },
                ]),
          ]}
        />
      </div>
    </div>
  )
}
