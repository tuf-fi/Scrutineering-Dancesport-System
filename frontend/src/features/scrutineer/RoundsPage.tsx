import { RoundStatus, SubmissionStatus, type RoundRow, type RoundType } from '@bis/shared'
import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { RoundStatusBadge, ROUND_STATUS_LABEL } from '../../components/RoundStatusBadge.tsx'
import { Button, ErrorState, PageHeader, SearchField, Select, Table, Toolbar, toast } from '../../components/ui/index.ts'
import { useClearFloor, useLiveSubmissions, usePlanRounds, useStartRound } from '../../hooks/index.ts'
import { AGE_GROUP_LABEL, ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'
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

function OnTheFloor({ row, competitionId, readOnly }: { row: RoundRow; competitionId: string; readOnly: boolean }) {
  const clear = useClearFloor()
  const submissions = useLiveSubmissions(row.roundId)
  const submitted = submissions.filter((s) => s.status === SubmissionStatus.Submitted).length

  const links: Array<[string, string]> = [
    ['Live board', 'live'],
    ['Heats', 'heats'],
    ['Recall', 'recall'],
    ['Results', 'results'],
  ]

  return (
    <section
      aria-label="On the floor"
      className="relative flex flex-col gap-12 overflow-hidden rounded-2xl bg-brown-950 bg-[radial-gradient(60rem_24rem_at_100%_0%,rgb(228_178_46/0.16),transparent_60%)] p-6 text-white sm:p-10"
    >
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
        <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">{eventDances(row)}</h2>
        <p className="flex items-center gap-3 text-body text-brown-100">
          <span className="font-mono tabular-nums text-gold-400">{eventCode({ number: row.eventNumber })}</span>
          <span aria-hidden className="h-3 w-px bg-white/25" />
          {AGE_GROUP_LABEL[row.ageGroup]} · {row.class}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-y-6 sm:grid-cols-4 sm:divide-x sm:divide-white/10">
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
            onClick={() => clear.mutate(competitionId, { onSuccess: () => toast.success('Round taken off the floor'), onError: (e) => toast.error(e.message) })}
            className="ml-auto inline-flex h-10 items-center rounded-lg px-4 text-small font-semibold text-brown-100/70 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
          >
            Take off the floor
          </button>
        )}
      </nav>
    </section>
  )
}

export function RoundsPage() {
  const { competitionId, rounds, list, roundId, row, readOnly } = useRoundChoice()
  const start = useStartRound()
  const plan = usePlanRounds()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')

  if (rounds.isError) return <ErrorState onRetry={() => void rounds.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = [...list]
    .sort((a, b) => a.eventNumber - b.eventNumber)
    .filter(
      (r) =>
        (status === 'all' || r.status === status) &&
        (!needle || `${eventCode({ number: r.eventNumber })} ${eventDances(r)} ${ROUND_TYPE_LABEL[r.type]}`.toLowerCase().includes(needle)),
    )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Rounds" description="Where the competition is, and every round still to run." />

      {row && row.status !== RoundStatus.Pending ? (
        <OnTheFloor key={roundId} row={row} competitionId={competitionId} readOnly={readOnly} />
      ) : null}

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
            <Button
              className="w-full rounded-lg sm:ml-auto sm:w-auto"
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
            {
              key: 'event',
              header: 'Event',
              cell: (r) => (
                <Link to={`/scrutineer/live?round=${r.roundId}`} className="font-medium text-neutral-900 hover:underline">
                  <span className="font-mono tabular-nums">{eventCode({ number: r.eventNumber })}</span> {eventDances(r)}
                </Link>
              ),
            },
            { key: 'round', header: 'Round', cell: (r) => ROUND_TYPE_LABEL[r.type], muted: true },
            { key: 'recall', header: 'Recall', cell: (r) => r.recallNumber ?? 'Final', mono: true, align: 'right', hideBelow: 'sm' },
            { key: 'entries', header: 'Entries', cell: (r) => r.entryCount, mono: true, align: 'right', hideBelow: 'md' },
            { key: 'heats', header: 'Heats', cell: (r) => r.heatCount || '–', mono: true, align: 'right', hideBelow: 'md' },
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
                          onClick={() => start.mutate(r.roundId, { onSuccess: () => toast.success('Round on the floor'), onError: (e) => toast.error(e.message) })}
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
