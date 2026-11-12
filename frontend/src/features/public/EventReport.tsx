import type { EventReport, EventReportPlaced, EventReportPerson, EventReportRound } from '@bis/shared'
import { ArrowUpRight } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ErrorState, Skeleton, Table, type Column } from '../../components/ui/index.ts'
import { useEventReport } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { DANCE_LABEL, ROUND_TYPE_LABEL, competitorName, ordinal, placeRange } from '../../lib/format.ts'
import { FinalMarks } from './FinalMarks.tsx'

interface PartProps {
  index: number
  title: string
  meta?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

// One part of the sheet, a row like the competitions list: it opens in place, and the panel grows smoothly
function Part({ index, title, meta, open, onToggle, children }: PartProps) {
  const panel = useId()
  const item = useRef<HTMLLIElement>(null)
  const mounted = useRef(false)
  // Once the open part above has closed, bring this one to the top so the reader is on the part they pressed
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (!open) return
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => item.current?.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }), 320)
    return () => clearTimeout(timer)
  }, [open])
  return (
    <li ref={item} className="relative scroll-mt-20 border-t border-neutral-200">
      {/* A gold bar runs down the open item, from its title to the end of its content */}
      <span aria-hidden className={cn('pointer-events-none absolute inset-y-0 left-0 w-0.5 bg-gold-400 transition-opacity duration-300', open ? 'opacity-100' : 'opacity-0')} />
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className={cn(
          'group grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 px-3 py-5 text-left transition-colors duration-300 hover:bg-gold-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-500 sm:grid-cols-[4rem_minmax(0,1fr)_auto_1.5rem] sm:gap-x-8 sm:py-6',
          open && 'bg-gold-50',
        )}
      >
        <span className="font-mono text-xs font-medium tabular-nums text-gold-700">{String(index).padStart(2, '0')}</span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-balance text-[1.125rem] font-semibold leading-[1.2] tracking-[-0.02em] text-neutral-900 sm:text-[1.375rem]">{title}</span>
          {meta && <span className="font-mono text-xs uppercase text-neutral-500 sm:hidden">{meta}</span>}
        </span>
        <span className="hidden font-mono text-xs uppercase text-neutral-500 sm:inline">{meta}</span>
        <ArrowUpRight
          aria-hidden
          className={cn('size-5 self-center text-neutral-400 transition duration-300 group-hover:text-gold-500', open ? 'rotate-90 text-gold-500' : 'group-hover:rotate-45')}
          strokeWidth={1.5}
        />
      </button>

      {/* The panel stays mounted and grows from zero height, so it opens and closes smoothly */}
      <div
        className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div id={panel} className="flex flex-col gap-10 px-3 pb-10 pt-6">
            {children}
          </div>
        </div>
      </div>
    </li>
  )
}

function Subtitle({ children }: { children: ReactNode }) {
  return <h3 className="text-small font-bold uppercase tracking-wide text-neutral-900">{children}</h3>
}

const who = (r: EventReportPerson) => (
  <span className="flex flex-col">
    <Link
      to={`/competitors/${r.competitorId}`}
      className="font-semibold text-neutral-900 transition-colors hover:text-gold-700 focus-visible:outline-2 focus-visible:outline-gold-500"
    >
      {competitorName(r.names)}
    </Link>
    {r.team && <span className="text-small text-neutral-600">{r.team}</span>}
  </span>
)

const placeText = (r: EventReportPlaced) => (
  <span className={cn('font-semibold', r.place <= 3 ? 'text-gold-700' : 'text-neutral-500')}>{placeRange(r) ?? ordinal(r.place)}</span>
)

function PlacedTable({ rows, label }: { rows: EventReportPlaced[]; label: string }) {
  const columns: Column<EventReportPlaced>[] = [
    { key: 'place', header: 'Place', cell: placeText, mono: true, widthClass: 'w-32' },
    { key: 'who', header: 'Participant', cell: who },
    { key: 'no', header: 'No.', cell: (r) => r.backNumber ?? '–', mono: true, align: 'right', widthClass: 'w-24' },
  ]
  return (
    <Table<EventReportPlaced>
      variant="plain"
      rows={rows}
      rowKey={(r) => r.competitorId}
      minWidthClass="min-w-0"
      paginationLabel={`${label} pagination`}
      empty={{ title: 'Nobody here', description: 'No one was placed in this round.' }}
      columns={columns}
    />
  )
}

function Officials({ report }: { report: EventReport }) {
  const rows: Array<[string, ReactNode]> = [
    ['Organizer', report.competition.organizer],
    ['Executor', report.competition.executor],
    ['Scrutineer', report.scrutineer || '–'],
  ]
  return (
    <dl className="border-b border-neutral-200 text-small">
      {rows.map(([term, value]) => (
        <div key={term} className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-x-4 border-t border-neutral-200 py-3.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <dt className="font-mono text-xs uppercase text-neutral-500">{term}</dt>
          <dd className="font-semibold text-neutral-900">{value}</dd>
        </div>
      ))}
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-x-4 border-t border-neutral-200 py-3.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <dt className="font-mono text-xs uppercase text-neutral-500">Adjudicators</dt>
        <dd>
          <ul aria-label="Adjudicators" className="flex flex-col gap-2">
            {report.adjudicators.map((a) => (
              <li key={a.letter} className="flex items-baseline gap-4">
                <span className="w-4 font-mono text-xs font-medium text-gold-700">{a.letter}</span>
                <span className="font-semibold text-neutral-900">{a.name}</span>
              </li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  )
}

type MarkRow = EventReportRound['rows'][number]

// Each adjudicator's marks for one dance, then what they came to
function MarksTable({ round, danceIndex }: { round: EventReportRound; danceIndex: number }) {
  const dance = round.dances[danceIndex]!
  const letters: Column<MarkRow>[] = round.letters.map((letter, i) => ({
    key: `adj-${letter}`,
    header: letter,
    cell: (r) => {
      const mark = r.perDance[danceIndex]?.marks[i]
      return mark === null || mark === undefined ? '–' : round.isFinal ? mark : 'X'
    },
    mono: true,
    align: 'center',
  }))
  const tail: Column<MarkRow>[] = round.isFinal
    ? [
        { key: 'rank', header: 'Rank', cell: (r) => r.perDance[danceIndex]?.place ?? '–', mono: true, align: 'center' },
        ...(round.dances.length > 1 && danceIndex === round.dances.length - 1
          ? [
              { key: 'sum', header: 'Total', cell: (r: MarkRow) => r.total, mono: true, align: 'center' as const },
              { key: 'place', header: 'Place', cell: (r: MarkRow) => (r.place ? ordinal(r.place) : '–'), mono: true, align: 'center' as const, bold: true },
            ]
          : []),
      ]
    : [
        { key: 'x', header: 'X', cell: (r) => r.total, mono: true, align: 'center', bold: true },
        { key: 'through', header: 'Recalled', cell: (r) => (r.recalled ? 'Yes' : 'No'), muted: true, align: 'right' },
      ]
  const columns: Column<MarkRow>[] = [{ key: 'no', header: 'No.', cell: (r) => r.backNumber ?? '–', mono: true, widthClass: 'w-20' }, ...letters, ...tail]
  return (
    <div className="flex flex-col gap-3">
      {round.dances.length > 1 && <Subtitle>{DANCE_LABEL[dance]}</Subtitle>}
      <Table<MarkRow>
        variant="plain"
        rows={round.rows}
        rowKey={(r) => r.competitorId}
        minWidthClass="min-w-[28rem]"
        paginationLabel={`${DANCE_LABEL[dance]} marks pagination`}
        empty={{ title: 'No marks', description: 'No marks were recorded for this round.' }}
        columns={columns}
      />
    </div>
  )
}

function RankingTable({ report }: { report: EventReport }) {
  type Row = EventReport['ranking'][number]
  const columns: Column<Row>[] = [
    { key: 'place', header: 'Rank', cell: placeText, mono: true, widthClass: 'w-32' },
    { key: 'who', header: 'Participant', cell: who },
    { key: 'no', header: 'No.', cell: (r) => r.backNumber ?? '–', mono: true, align: 'center', widthClass: 'w-20' },
    ...report.rounds.map<Column<Row>>((round) => ({
      key: `round-${round.roundType}`,
      header: round.isFinal ? 'Final' : ROUND_TYPE_LABEL[round.roundType],
      cell: (r) => r.rounds.find((x) => x.roundType === round.roundType)?.value ?? '–',
      mono: true,
      align: 'center',
      hideBelow: 'sm',
    })),
  ]
  return (
    <Table<Row>
      variant="plain"
      rows={report.ranking}
      rowKey={(r) => r.competitorId}
      minWidthClass="min-w-0"
      paginationLabel="Ranking pagination"
      empty={{ title: 'No ranking yet', description: 'It appears once the results are published.' }}
      columns={columns}
    />
  )
}

// The sheet a public visitor reads after an event: who judged, the placings, and what each adjudicator gave
export function EventReportView({ eventId, finalRoundId }: { eventId: string; finalRoundId: string }) {
  const report = useEventReport(eventId)
  // One part is open at a time: opening another closes the open one, and pressing the open one closes it
  const [openPart, setOpenPart] = useState<number | null>(1)
  const at = (n: number) => ({ open: openPart === n, onToggle: () => setOpenPart(openPart === n ? null : n) })
  if (report.isError) return <ErrorState onRetry={() => void report.refetch()} />
  if (!report.data) return <Skeleton className="h-40 w-full" />
  const data = report.data
  const final = data.rounds.find((r) => r.isFinal)
  const earlier = data.rounds.filter((r) => !r.isFinal)
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  return (
    <section aria-labelledby="sheet" className="flex flex-col gap-4">
      <h2 id="sheet" className="text-small font-bold uppercase tracking-wide text-neutral-900">
        Event report
      </h2>
      <ul aria-label="Event report" className="border-b border-neutral-200">
        <Part index={1} title="Competition report" meta={count(data.adjudicators.length, 'adjudicator', 'adjudicators')} {...at(1)}>
          <Officials report={data} />
          {data.listing[0] && (
            <div className="flex flex-col gap-3">
              <Subtitle>Result of the final</Subtitle>
              <PlacedTable rows={data.listing[0].rows} label="Result of the final" />
            </div>
          )}
        </Part>

        <Part index={2} title="Competition listing" meta={count(data.ranking.length, 'competitor', 'competitors')} {...at(2)}>
          {data.listing.map((group) => (
            <div key={group.roundType} className="flex flex-col gap-3">
              <Subtitle>{group.isFinal ? 'Final' : ROUND_TYPE_LABEL[group.roundType]}</Subtitle>
              <PlacedTable rows={group.rows} label={ROUND_TYPE_LABEL[group.roundType]} />
            </div>
          ))}
        </Part>

        <Part index={3} title="Ranking report" meta={count(data.ranking.length, 'competitor', 'competitors')} {...at(3)}>
          <RankingTable report={data} />
        </Part>

        {final && (
          <Part index={4} title="Report of final round" meta={final.dances.map((d) => DANCE_LABEL[d]).join(', ')} {...at(4)}>
            {final.dances.map((_, i) => (
              <MarksTable key={final.dances[i]} round={final} danceIndex={i} />
            ))}
            <FinalMarks roundId={finalRoundId} />
          </Part>
        )}

        {earlier.map((round, i) => (
          <Part key={round.roundType} index={5 + i} title={`Report of ${ROUND_TYPE_LABEL[round.roundType].toLowerCase()}`} meta={count(round.rows.length, 'couple', 'couples')} {...at(5 + i)}>
            {round.dances.map((_, k) => (
              <MarksTable key={round.dances[k]} round={round} danceIndex={k} />
            ))}
          </Part>
        ))}
      </ul>
    </section>
  )
}
