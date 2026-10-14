import { RoundStatus, SubmissionStatus, type RoundRow, type RoundType } from '@bis/shared'
import { useState } from 'react'
import { Link } from 'react-router'
import { RoundStatusBadge, ROUND_STATUS_LABEL } from '../../components/RoundStatusBadge.tsx'
import { Button, ButtonLink, ErrorState, PageHeader, SearchField, Select, Table, Toolbar, toast } from '../../components/ui/index.ts'
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
    <section aria-label="On the floor" className="flex flex-col gap-5 border-y border-neutral-200 py-8">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">On the floor</p>
        <RoundStatusBadge status={row.status} />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-display font-semibold leading-tight text-neutral-900">
          <span className="mr-3 font-mono text-title font-medium text-neutral-400">{eventCode({ number: row.eventNumber })}</span>
          {eventDances(row)}
        </h2>
        <p className="text-body text-neutral-600">
          {AGE_GROUP_LABEL[row.ageGroup]} · {row.class}
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-12 gap-y-4">
        {[
          ['Round', ROUND_TYPE_LABEL[row.type]],
          ['Submitted', `${submitted} of ${submissions.length}`],
          ['Heats', row.heatCount || '–'],
          ['Recall', row.recallNumber ?? 'Final'],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-xs text-neutral-500">{label}</dt>
            <dd className="text-body font-medium text-neutral-900">{value}</dd>
          </div>
        ))}
      </dl>
      <nav aria-label="Open this round" className="flex flex-wrap items-center gap-2">
        {links.map(([label, page]) => (
          <ButtonLink key={page} size="sm" variant="secondary" to={`/scrutineer/${page}?round=${row.roundId}`}>
            {label}
          </ButtonLink>
        ))}
        {!readOnly && row.status === RoundStatus.Marking && submitted === 0 && (
          <Button
            size="sm"
            variant="ghost"
            disabled={clear.isPending}
            onClick={() => clear.mutate(competitionId, { onSuccess: () => toast.success('Round taken off the floor'), onError: (e) => toast.error(e.message) })}
          >
            Take off the floor
          </Button>
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
              className="w-full sm:ml-auto sm:w-auto"
              variant="secondary"
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
