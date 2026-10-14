import { SubmissionStatus, type AdjudicatorSubmission } from '@bis/shared'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { RoundStatusBadge } from '../../components/RoundStatusBadge.tsx'
import { Badge, ErrorState, PageHeader, Skeleton, Table } from '../../components/ui/index.ts'
import { useAdjudicators, useLiveSubmissions } from '../../hooks/index.ts'
import { RoundSelect } from './RoundSelect.tsx'
import { useRoundChoice } from './useRoundChoice.ts'

// The venue server flags a phone that stopped sending its heartbeat (quietSince). The sample app has no
// heartbeat, so it flags a phone that has been marking this long without sending.
const QUIET_MS = 20_000

const STATUS = {
  [SubmissionStatus.Waiting]: { label: 'Waiting', tone: 'neutral' as const },
  [SubmissionStatus.Marking]: { label: 'Marking', tone: 'gold' as const },
  [SubmissionStatus.Submitted]: { label: 'Submitted', tone: 'success' as const },
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

  return (id: string) => Math.max(0, now - (since[id]?.at ?? now))
}

function Board({ roundId, final, select }: { roundId: string; final: boolean; select: ReactNode }) {
  const submissions = useLiveSubmissions(roundId)
  const adjudicators = useAdjudicators()
  const quietFor = useSince(submissions)
  const people = new Map((adjudicators.data ?? []).map((a) => [a.id, a]))
  const submitted = submissions.filter((s) => s.status === SubmissionStatus.Submitted).length
  const done = submissions.length > 0 && submitted === submissions.length

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        {select}
        <div className="flex flex-col items-start gap-1 sm:items-end">
          <p role="status" className="text-small text-neutral-600">
            <span className="font-mono text-title font-semibold tabular-nums text-neutral-900">{submitted}</span> of{' '}
            <span className="font-mono tabular-nums">{submissions.length}</span> adjudicators have submitted
          </p>
          {done && (
            <Link
              to={`/scrutineer/${final ? 'results' : 'recall'}?round=${roundId}`}
              className="text-small font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900"
            >
              {final ? 'Review the results' : 'Review the recall'} <span aria-hidden>→</span>
            </Link>
          )}
        </div>
      </div>

      <Table<AdjudicatorSubmission>
        rows={submissions}
        rowKey={(s) => s.adjudicatorId}
        minWidthClass="min-w-0"
        paginationLabel="Adjudicators pagination"
        empty={{ title: 'No adjudicators on this panel yet' }}
        columns={[
          {
            key: 'letter',
            header: 'Letter',
            cell: (s) => people.get(s.adjudicatorId)?.letter ?? '?',
            mono: true,
            widthClass: 'w-24',
          },
          { key: 'who', header: 'Adjudicator', cell: (s) => <span className="font-medium">{people.get(s.adjudicatorId)?.name ?? s.adjudicatorId}</span> },
          {
            key: 'status',
            header: 'Status',
            cell: (s) => {
              const sinceServer = s.quietSince ? Math.max(0, Date.now() - new Date(s.quietSince).getTime()) : null
              const silent = sinceServer ?? quietFor(s.adjudicatorId)
              const quiet = s.status === SubmissionStatus.Marking && (sinceServer !== null || silent > QUIET_MS)
              return quiet ? (
                <Badge tone="warning">No response for {Math.floor(silent / 1000)} s</Badge>
              ) : (
                <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
              )
            },
          },
          {
            key: 'at',
            header: 'Submitted',
            align: 'right',
            mono: true,
            muted: true,
            hideBelow: 'sm',
            cell: (s) =>
              s.submittedAt ? new Date(s.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '–',
          },
        ]}
      />
    </div>
  )
}

export function LivePage() {
  const { rounds, list, roundId, row, setRoundId } = useRoundChoice()

  if (rounds.isError) return <ErrorState onRetry={() => void rounds.refetch()} />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Live board"
        description="Each adjudicator's phone, updating as marks come in."
        actions={row ? <RoundStatusBadge status={row.status} /> : undefined}
      />
      {row ? (
        <Board
          key={roundId}
          roundId={roundId}
          final={row.recallNumber === null}
          select={<RoundSelect rounds={list} value={roundId} onChange={setRoundId} />}
        />
      ) : (
        <Skeleton className="h-40 w-full" />
      )}
    </div>
  )
}
