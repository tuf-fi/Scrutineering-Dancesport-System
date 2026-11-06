import { ProgramKind } from '@bis/shared'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useCompetition, useEntriesByBackNumber, useProgram, useCatalog } from '../../hooks/index.ts'
import {
  ROUND_TYPE_LABEL,
  eventCode,
  eventDances,
  formatClock,
  letterRanges,
  programAction,
  sheetDate,
} from '../../lib/format.ts'
import { filterProgram } from '../../lib/programFilter.ts'
import { num, td, th } from './tableStyles.ts'

const keep = 'whitespace-nowrap'

// "25/Oct/2026, 10:52": when this copy was printed, so an old copy can be told from a new one
function stamp(at: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  // The local date, not the UTC one: before 8 a.m. in the Philippines UTC is still yesterday
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `${sheetDate(date)}, ${pad(at.getHours())}:${pad(at.getMinutes())}`
}

// The whole running order on A4, however many lines it has. Print and PDF both open this page; PDF asks for the
// print dialog at once, where "Save as PDF" is the destination.
export function ProgramPrintPage() {
  const { ageGroupLabel } = useCatalog()
  const { competitionId = '' } = useParams()
  const [params] = useSearchParams()
  const competition = useCompetition(competitionId)
  const program = useProgram(competitionId)
  const [printedAt] = useState(() => new Date())
  const query = params.get('q') ?? ''
  const round = params.get('round') ?? 'all'
  const back = params.get('back') ?? ''
  const number = /^\d+$/.test(back.trim()) ? Number(back) : null
  const mine = useEntriesByBackNumber(competitionId, number)
  const pdf = params.get('pdf') === '1'
  const ready = Boolean(competition.data && program.data && (number === null || mine.data))

  useEffect(() => {
    if (pdf && ready) window.print()
  }, [pdf, ready])

  if (competition.isError || program.isError || mine.isError) {
    return <ErrorState onRetry={() => void Promise.all([competition.refetch(), program.refetch(), mine.refetch()])} />
  }
  if (!competition.data || !program.data || (number !== null && !mine.data)) return <Skeleton className="h-96 w-full" />

  const all = program.data.rows
  const rows = filterProgram(all, query, round, number === null ? null : new Set(mine.data), ageGroupLabel)
  const filtered = rows.length !== all.length
  const filter = [
    query.trim() && `“${query.trim()}”`,
    round !== 'all' && ROUND_TYPE_LABEL[round as keyof typeof ROUND_TYPE_LABEL],
    number !== null && `back number ${number}`,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <article className="border-2 border-neutral-900 text-[10pt] leading-snug text-neutral-900">
      <h1 className="print-exact border-b-2 border-neutral-900 bg-neutral-200 px-3 py-1.5 text-[15pt] font-bold">
        Program: {competition.data.name}
      </h1>

      <dl className="grid grid-cols-3 gap-x-6 border-b-2 border-neutral-900 px-3 py-2.5">
        {[
          ['Date', sheetDate(competition.data.date)],
          ['Location', competition.data.venue],
          ['Printed', stamp(printedAt)],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-[8pt] text-neutral-600">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="print:hidden border-b border-neutral-300 px-3 py-2 text-neutral-600">
        {pdf ? 'In the print dialog, choose Save as PDF as the destination.' : 'Use the Print button above, or save it as a PDF from the print dialog.'}
      </p>

      <div className="px-3 py-3">
        {rows.length === 0 ? (
          <p>{all.length === 0 ? 'The program has not been published yet.' : 'No lines match this filter.'}</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={`${th} ${keep}`}>Time</th>
                <th className={`${th} ${keep}`}>Evt</th>
                <th className={th}>Category</th>
                <th className={`${th} ${keep}`}>Round</th>
                <th className={`${th} ${keep} text-right`}>Dancing</th>
                <th className={`${th} ${keep}`}>Action</th>
                <th className={`${th} ${keep}`}>Adj.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                r.kind === ProgramKind.Round && r.eventNumber !== null && r.ageGroup && r.roundType ? (
                  <tr key={r.slotId} className="break-inside-avoid border-b border-neutral-300">
                    <td className={`${td} ${num} ${keep}`}>{formatClock(r.startTime)}</td>
                    <td className={`${td} ${num} ${keep}`}>{eventCode({ number: r.eventNumber })}</td>
                    <td className={td}>
                      {eventDances(r)} <span className="text-neutral-600">· {ageGroupLabel(r.ageGroup)} {r.class}</span>
                    </td>
                    <td className={`${td} ${keep}`}>{ROUND_TYPE_LABEL[r.roundType]}</td>
                    <td className={`${td} ${num} ${keep} text-right`}>{r.entryCount}</td>
                    <td className={`${td} ${keep}`}>{programAction(r)}</td>
                    <td className={`${td} ${num} ${keep}`}>{letterRanges(r.panel)}</td>
                  </tr>
                ) : (
                  <tr key={r.slotId} className="break-inside-avoid border-b border-neutral-300 font-semibold">
                    <td className={`${td} ${num} ${keep}`}>{formatClock(r.startTime)}</td>
                    <td className={td} colSpan={6}>
                      {r.label}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>

      <footer className="px-3 pb-3 pt-1 font-semibold">
        {rows.length} {rows.length === 1 ? 'line' : 'lines'}
        {filtered && ` of ${all.length}, filtered by ${filter}`}.
      </footer>
    </article>
  )
}
