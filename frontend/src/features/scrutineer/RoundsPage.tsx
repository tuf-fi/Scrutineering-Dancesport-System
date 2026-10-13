import { RoundStatus, SubmissionStatus, type RoundRow } from '@bis/shared'
import { useState } from 'react'
import { Link } from 'react-router'
import { RoundStatusBadge, ROUND_STATUS_LABEL } from '../../components/RoundStatusBadge.tsx'
import { ButtonLink, ErrorState, PageHeader, SearchField, Select, Table, Toolbar } from '../../components/ui/index.ts'
import { useLiveSubmissions } from '../../hooks/index.ts'
import { AGE_GROUP_LABEL, ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'
import { useRoundChoice } from './useRoundChoice.ts'

function OnTheFloor({ row }: { row: RoundRow }) {
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
      <nav aria-label="Open this round" className="flex flex-wrap gap-2">
        {links.map(([label, page]) => (
          <ButtonLink key={page} size="sm" variant="secondary" to={`/scrutineer/${page}?round=${row.roundId}`}>
            {label}
          </ButtonLink>
        ))}
      </nav>
    </section>
  )
}

export function RoundsPage() {
  const { rounds, list, roundId, row } = useRoundChoice()
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

      {row ? <OnTheFloor key={roundId} row={row} /> : null}

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
          ]}
        />
      </div>
    </div>
  )
}
