import { RoundStatus, SubmissionStatus, type AdjudicatorSubmission, type RoundRow } from '@bis/shared'
import { ArrowUpRight, Check } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ROUND_STATUS_LABEL } from '../../components/RoundStatusBadge.tsx'
import { ErrorState, PageHeader, Skeleton } from '../../components/ui/index.ts'
import { useAdjudicators, useLiveSubmissions } from '../../hooks/index.ts'
import { AGE_GROUP_LABEL, eventCode, eventDances } from '../../lib/format.ts'
import { GoToFloor } from './GoToFloor.tsx'
import { RoundSelect } from './RoundSelect.tsx'
import { useRoundChoice } from './useRoundChoice.ts'

// The venue server flags a phone that stopped sending its heartbeat (quietSince). The sample app has no
// heartbeat, so it flags a phone that has been marking this long without sending.
const QUIET_MS = 20_000

const STATUS = {
  [SubmissionStatus.Waiting]: { label: 'Waiting', name: 'text-white/45', note: 'text-white/45' },
  [SubmissionStatus.Marking]: { label: 'Marking', name: 'text-white', note: 'text-gold-400' },
  [SubmissionStatus.Submitted]: { label: 'Submitted', name: 'text-white', note: 'text-brown-100' },
}

// Remembers when each adjudicator last changed status, so a quiet phone can be flagged
function useSince(submissions: AdjudicatorSubmission[]) {
  const [since, setSince] = useState<Record<string, { status: string; at: number }>>(() =>
    Object.fromEntries(submissions.map((s) => [s.adjudicatorId, { status: s.status, at: Date.now() }])),
  )
  const [now, setNow] = useState(() => Date.now())

  // Adjusting state while rendering: when new submissions arrive, note who changed (within a second)
  const [seen, setSeen] = useState(submissions)
  if (seen !== submissions) {
    setSeen(submissions)
    const next = { ...since }
    for (const s of submissions) {
      if (since[s.adjudicatorId]?.status !== s.status) next[s.adjudicatorId] = { status: s.status, at: now }
    }
    setSince(next)
  }

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (id: string, quietSince?: string) => Math.max(0, now - (quietSince ? new Date(quietSince).getTime() : (since[id]?.at ?? now)))
}

function Board({ row, final, select }: { row: RoundRow; final: boolean; select: ReactNode }) {
  const roundId = row.roundId
  const submissions = useLiveSubmissions(roundId)
  const adjudicators = useAdjudicators()
  const quietFor = useSince(submissions)
  const people = new Map((adjudicators.data ?? []).map((a) => [a.id, a]))
  const submitted = submissions.filter((s) => s.status === SubmissionStatus.Submitted).length
  const done = submissions.length > 0 && submitted === submissions.length

  return (
    <section
      aria-label="On the floor"
      className="flex flex-col gap-10 overflow-hidden rounded-2xl bg-brown-950 p-6 text-white sm:p-10"
    >
      <div className="flex items-center justify-between gap-4">
        {select}
        <p className="flex items-center gap-2.5 text-small font-semibold">
          <span className="relative flex size-2">
            {row.status === RoundStatus.Marking && (
              <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-gold-400 opacity-60 motion-reduce:hidden" />
            )}
            <span aria-hidden className="relative size-2 rounded-full bg-gold-400" />
          </span>
          {ROUND_STATUS_LABEL[row.status]}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">{eventDances(row)}</h2>
        <p className="flex items-center gap-2 text-body text-brown-100">
          <span className="font-mono tabular-nums text-gold-400">{eventCode({ number: row.eventNumber })}</span>
          <span aria-hidden>·</span>
          {AGE_GROUP_LABEL[row.ageGroup]} · {row.class}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="flex w-full max-w-md flex-col gap-4">
          <p role="status" className="flex items-baseline gap-2 text-body text-brown-100">
            <span className="font-mono text-5xl leading-none tabular-nums text-white">{submitted}</span>{' '}
            <span>of {submissions.length} adjudicators have submitted</span>
          </p>
          <div aria-hidden className="h-0.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full bg-gold-400 transition-[width]"
              style={{ width: `${submissions.length ? (submitted / submissions.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        {done && (
          <Link
            to={`/scrutineer/${final ? 'results' : 'recall'}?round=${roundId}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gold-400 px-4 text-small font-semibold text-black transition-colors hover:bg-gold-300 active:bg-gold-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
          >
            {final ? 'Review the results' : 'Review the recall'}
            <ArrowUpRight aria-hidden size={16} strokeWidth={2} />
          </Link>
        )}
      </div>

      {submissions.length === 0 ? (
        <p className="border-t border-white/10 pt-6 text-body text-brown-100">No adjudicators on this panel yet.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-16 gap-y-3.5 lg:grid-cols-2">
          {submissions.map((s) => {
            const silent = quietFor(s.adjudicatorId, s.quietSince ?? undefined)
            const quiet = s.status === SubmissionStatus.Marking && (Boolean(s.quietSince) || silent > QUIET_MS)
            const state = s.holdingMarks
              ? { label: 'Marks on the phone, not sent', name: 'text-white', note: 'text-warning' }
              : quiet
                ? { label: `No response for ${Math.floor(silent / 1000)} s`, name: 'text-white', note: 'text-warning' }
                : STATUS[s.status]
            const person = people.get(s.adjudicatorId)
            const time = s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null
            return (
              <li key={s.adjudicatorId} className="flex items-baseline gap-4">
                <span className="w-4 font-mono text-xs tabular-nums text-white/40">{person?.letter ?? '?'}</span>
                <span className={`min-w-0 flex-1 truncate text-body ${state.name}`}>{person?.name ?? s.adjudicatorId}</span>
                <span className={`inline-flex items-center gap-1.5 text-small ${state.note}`}>
                  {time && <Check aria-hidden size={14} strokeWidth={2.5} className="text-success" />}
                  {state.label}
                  {time && <span className="ml-2 tabular-nums">{time}</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

export function LivePage() {
  const { rounds, list, roundId, floorId, row, setRoundId } = useRoundChoice()

  if (rounds.isError) return <ErrorState onRetry={() => void rounds.refetch()} />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Live board" description="Each adjudicator's phone, updating as marks come in." />
      {row ? <Board key={roundId} row={row} final={row.recallNumber === null} select={
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <RoundSelect inline rounds={list} value={roundId} onChange={setRoundId} />
              <GoToFloor floorId={floorId} roundId={roundId} onGo={setRoundId} />
            </div>
          } /> : <Skeleton className="h-96 w-full" />}
    </div>
  )
}
