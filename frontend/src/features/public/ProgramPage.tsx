import { ProgramKind, ProgramStatus, RoundType, type ProgramRow } from '@bis/shared'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ProgramStatusBadge } from '../../components/ProgramStatusBadge.tsx'
import {
  Button,
  ButtonLink,
  ErrorState,
  Input,
  PageHeader,
  SearchField,
  Select,
  Skeleton,
  Table,
  Toolbar,
  ToolbarActions,
} from '../../components/ui/index.ts'
import { useCompetition, useEntriesByBackNumber, useProgram } from '../../hooks/index.ts'
import {
  ROUND_TYPE_LABEL,
  eventCode,
  eventDances,
  eventGrade,
  formatClock,
  formatDate,
  letterRanges,
  programAction,
  programLineName,
} from '../../lib/format.ts'
import { filterProgram, programPrintPath } from '../../lib/programFilter.ts'

// The line itself in words, for the strip above the table
function Line({ label, row, empty }: { label: string; row: ProgramRow | undefined; empty: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h2 className="text-small font-semibold text-neutral-900">{label}</h2>
      {row ? (
        <>
          <p className="text-balance text-title font-semibold text-neutral-900">
            {row.kind === ProgramKind.Round && row.eventNumber !== null ? (
              <>
                <span className="mr-2 font-mono font-medium text-neutral-600">{eventCode({ number: row.eventNumber })}</span>
                {eventDances(row)}
              </>
            ) : (
              row.label
            )}
          </p>
          <p className="text-small text-neutral-600">
            {formatClock(row.startTime)}
            {row.roundType && ` · ${ROUND_TYPE_LABEL[row.roundType]}`}
            {programAction(row) && ` · ${programAction(row)}`}
          </p>
        </>
      ) : (
        <p className="text-small text-neutral-600">{empty}</p>
      )}
    </div>
  )
}

// The running order of one competition, live: what is on the floor, what is next, and when everything else starts
export function ProgramPage() {
  const { competitionId = '' } = useParams()
  const competition = useCompetition(competitionId)
  const program = useProgram(competitionId)
  const [query, setQuery] = useState('')
  const [round, setRound] = useState('all')
  const [back, setBack] = useState('')
  // A back number is a whole number; anything else filters nothing
  const number = /^\d+$/.test(back.trim()) ? Number(back) : null
  const mine = useEntriesByBackNumber(competitionId, number)

  if (competition.isError || program.isError) {
    return <ErrorState onRetry={() => void Promise.all([competition.refetch(), program.refetch()])} />
  }
  if (!competition.data) return <Skeleton className="h-24 w-full max-w-xl" />

  const all = program.data?.rows ?? []
  const rows = filterProgram(all, query, round, number === null ? null : new Set(mine.data ?? []))
  const now = all.find((r) => r.status === ProgramStatus.Current)
  const next = all.find((r) => r.status === ProgramStatus.Next)
  const finished = all.length > 0 && all.every((r) => r.status === ProgramStatus.Completed)
  const filtered = query.trim() !== '' || round !== 'all' || back.trim() !== ''

  return (
    <div className="flex flex-col gap-8">
      <Link to={`/competitions/${competitionId}`} className="w-fit text-small text-neutral-600 hover:text-neutral-900">
        {competition.data.name}
      </Link>
      <PageHeader title="Program" description={`${formatDate(competition.data.date)} · ${competition.data.venue}`} />

      {program.isLoading ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        all.length > 0 && (
          <section
            aria-label="On the floor and up next"
            aria-live="polite"
            className="grid gap-6 border-y border-neutral-200 py-6 sm:grid-cols-2"
          >
            <Line label="On the floor" row={now} empty={finished ? 'The program is complete' : 'Nothing on the floor right now'} />
            <Line label="Up next" row={next} empty={finished ? 'Nothing left' : 'Nothing queued'} />
          </section>
        )
      )}

      <Toolbar>
        <SearchField className="w-full sm:w-72" label="Search program" value={query} onChange={setQuery} />
        <div className="w-full sm:w-52">
          <Select label="Round" value={round} onChange={(e) => setRound(e.target.value)}>
            <option value="all">All rounds</option>
            {Object.values(RoundType).map((t) => (
              <option key={t} value={t}>
                {ROUND_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-full sm:w-36">
          <Input label="Back number" inputMode="numeric" value={back} onChange={(e) => setBack(e.target.value)} className="font-mono tabular-nums" />
        </div>
        {all.length > 0 && (
          <ToolbarActions>
            <ButtonLink variant="secondary" to={programPrintPath(competitionId, query, round, false, back)} target="_blank">
              Print
            </ButtonLink>
            <ButtonLink variant="secondary" to={programPrintPath(competitionId, query, round, true, back)} target="_blank">
              PDF
            </ButtonLink>
          </ToolbarActions>
        )}
      </Toolbar>

      <Table<ProgramRow>
        loading={program.isLoading || (number !== null && mine.isLoading)}
        rows={rows}
        rowKey={(r) => r.slotId}
        minWidthClass="min-w-0"
        paginationLabel="Program pagination"
        detailTitle={programLineName}
        rowClassName={(r) => (r.status === ProgramStatus.Current ? 'bg-gold-50' : undefined)}
        empty={
          all.length === 0
            ? { title: 'No program yet', description: 'The running order appears here once the organizers publish it.' }
            : {
                title: 'No lines match',
                description: 'Try a different round or search.',
                action: filtered ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('')
                      setRound('all')
                      setBack('')
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined,
              }
        }
        columns={[
          { key: 'time', header: 'Time', cell: (r) => formatClock(r.startTime), mono: true, widthClass: 'w-28' },
          {
            key: 'event',
            header: 'Event',
            cell: (r) =>
              r.kind === ProgramKind.Round && r.eventNumber !== null && r.ageGroup && r.class && r.discipline ? (
                <div className="flex flex-col">
                  <span className="font-medium text-neutral-900">
                    <span className="mr-2 font-mono tabular-nums text-neutral-600">{eventCode({ number: r.eventNumber })}</span>
                    {eventDances(r)}
                  </span>
                  <span className="text-xs text-neutral-600">{eventGrade({ ageGroup: r.ageGroup, class: r.class, discipline: r.discipline })}</span>
                  {r.roundType && (
                    <span className="text-xs font-medium text-neutral-900 sm:hidden">
                      {ROUND_TYPE_LABEL[r.roundType]}
                      {programAction(r) && ` · ${programAction(r)}`}
                    </span>
                  )}
                </div>
              ) : (
                <span className="font-medium text-neutral-900">{r.label}</span>
              ),
          },
          { key: 'round', header: 'Round', cell: (r) => (r.roundType ? ROUND_TYPE_LABEL[r.roundType] : ''), muted: true, hideBelow: 'sm' },
          { key: 'dancing', header: 'Dancing', cell: (r) => (r.kind === ProgramKind.Round ? r.entryCount : ''), mono: true, align: 'right', hideBelow: 'md' },
          { key: 'action', header: 'Action', cell: programAction, muted: true, hideBelow: 'md' },
          { key: 'panel', header: 'Adjudicators', cell: (r) => letterRanges(r.panel), mono: true, muted: true, hideBelow: 'md' },
          { key: 'status', header: 'Status', cell: (r) => <ProgramStatusBadge status={r.status} />, align: 'right' },
        ]}
      />
    </div>
  )
}
