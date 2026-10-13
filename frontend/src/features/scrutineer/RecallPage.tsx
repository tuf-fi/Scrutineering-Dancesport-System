import type { RecallRow, RecallTable, TieDecision } from '@bis/shared'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton, Table, Toolbar, toast } from '../../components/ui/index.ts'
import { useConfirmTie, useProposeTie, useRecallTable, useStaffUsers } from '../../hooks/index.ts'
import { competitorName } from '../../lib/format.ts'
import { RoundSelect } from './RoundSelect.tsx'
import { useRoundChoice } from './useRoundChoice.ts'

const OUTCOME = {
  recalled: { label: 'Recalled', tone: 'success' as const },
  tied: { label: 'Tied', tone: 'warning' as const },
  out: { label: 'Not recalled', tone: 'neutral' as const },
}

function TiePanel({
  roundId,
  table,
  readOnly,
  isChairperson,
}: {
  roundId: string
  table: RecallTable
  readOnly: boolean
  isChairperson: boolean
}) {
  const staff = useStaffUsers()
  const propose = useProposeTie()
  const confirm = useConfirmTie()
  const [choice, setChoice] = useState<TieDecision['choice']>('more')
  const tie = table.tie!
  const above = table.rows.filter((r) => r.xCount > tie.xCount).length
  const decision = tie.decision
  const name = (id: string | null) => staff.data?.find((s) => s.id === id)?.name ?? 'the chairperson'

  const options: Array<{ id: TieDecision['choice']; label: string }> = [
    { id: 'more', label: `Recall all ${tie.count} tied, ${above + tie.count} in total` },
    { id: 'fewer', label: `Recall only the ${above} above the tie` },
  ]

  const status = decision?.confirmedBy
    ? `Confirmed by ${name(decision.confirmedBy)}.`
    : decision
      ? 'Proposed. Waiting for the chairperson to confirm.'
      : isChairperson
        ? 'The scrutineer has not proposed a decision yet.'
        : null

  const choosing = !readOnly && !decision?.confirmedBy

  return (
    <section
      aria-label="Tie at the cutoff"
      className="grid gap-x-16 gap-y-6 border-y border-neutral-200 py-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-title font-semibold text-neutral-900">Tie at the cutoff</h2>
        <p className="text-small text-neutral-600">
          <span className="font-mono tabular-nums">{tie.count}</span> competitors have{' '}
          <span className="font-mono tabular-nums">{tie.xCount}</span> X, across the recall number of{' '}
          <span className="font-mono tabular-nums">{table.recallNumber}</span>.
        </p>
        {status && <p className="text-small text-neutral-900">{status}</p>}
      </div>

      <div className="flex flex-col gap-5">
        {choosing ? (
          <div role="radiogroup" aria-label="Tie decision" className="flex flex-col gap-3">
            {options.map((o) => (
              <label key={o.id} className="flex cursor-pointer items-center gap-3 text-small text-neutral-900">
                <input
                  type="radio"
                  name="tie-decision"
                  checked={choice === o.id}
                  onChange={() => setChoice(o.id)}
                  className="size-4 accent-neutral-900"
                />
                {o.label}
              </label>
            ))}
          </div>
        ) : (
          decision && <p className="text-small text-neutral-600">{options.find((o) => o.id === decision.choice)?.label}.</p>
        )}

        <div className="flex flex-wrap gap-3">
          {choosing && (
            <Button
              variant="secondary"
              disabled={propose.isPending}
              onClick={() =>
                propose.mutate(
                  { roundId, choice },
                  { onSuccess: () => toast.success('Decision proposed'), onError: (e) => toast.error(e.message) },
                )
              }
            >
              {decision ? 'Change decision' : 'Propose decision'}
            </Button>
          )}
          {isChairperson && decision && !decision.confirmedBy && (
            <Button
              disabled={confirm.isPending}
              onClick={() =>
                confirm.mutate(roundId, {
                  onSuccess: () => toast.success('Tie decision confirmed'),
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              Confirm tie decision
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

export function RecallPage() {
  const { rounds, list, roundId, row, setRoundId, readOnly, isChairperson } = useRoundChoice()
  const isFinal = row?.recallNumber === null
  const recall = useRecallTable(roundId, Boolean(row) && !isFinal)

  if (rounds.isError || recall.isError) return <ErrorState onRetry={() => void Promise.all([rounds.refetch(), recall.refetch()])} />

  const table = recall.data
  const cutoffRank = table ? table.rows.filter((r) => r.outcome === 'recalled').length : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Recall" description="X marks per competitor, with the cutoff for the next round." />
      <Toolbar>
        <RoundSelect rounds={list} value={roundId} onChange={setRoundId} />
        {table && !isFinal && (
          <p role="status" className="text-small text-neutral-600 sm:ml-auto">
            Recall <span className="font-mono tabular-nums text-neutral-900">{table.recallNumber}</span> ·{' '}
            <span className="font-mono tabular-nums">{table.submittedCount}</span> of{' '}
            <span className="font-mono tabular-nums">{table.adjudicatorCount}</span> adjudicators in ·{' '}
            <span className="font-mono tabular-nums">{table.recalled}</span> recalled
          </p>
        )}
      </Toolbar>

      {isFinal ? (
        <div className="rounded-xl border border-neutral-200 px-6">
          <EmptyState
            title="A final is placed, not recalled"
            description="Open the results to see the placings."
            action={
              <Link to={`/scrutineer/results?round=${roundId}`} className="text-small font-medium underline underline-offset-4">
                Results
              </Link>
            }
          />
        </div>
      ) : !table ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          {table.tie && <TiePanel roundId={roundId} table={table} readOnly={readOnly} isChairperson={isChairperson} />}

          <Table<RecallRow>
            rows={table.rows}
            rowKey={(r) => r.competitorId}
            minWidthClass="min-w-0"
            paginationLabel="Recall pagination"
            detailTitle={(r) => competitorName(r.names)}
            // The gold line sits between the last recalled competitor and the first one out
            rowClassName={(r) =>
              r.rank === cutoffRank + 1 && r.outcome !== 'recalled' ? '[&>td]:shadow-[inset_0_2px_0_var(--color-gold-400)]' : undefined
            }
            empty={{ title: 'No marks yet', description: 'Competitors appear here as adjudicators submit.' }}
            columns={[
              { key: 'rank', header: '#', cell: (r) => r.rank, mono: true, widthClass: 'w-16' },
              { key: 'back', header: 'Back no.', cell: (r) => r.backNumber ?? '–', mono: true },
              { key: 'who', header: 'Competitor', cell: (r) => <span className="font-medium">{competitorName(r.names)}</span>, hideBelow: 'sm' },
              { key: 'x', header: 'X marks', cell: (r) => r.xCount, mono: true, align: 'right' },
              {
                key: 'outcome',
                header: 'Outcome',
                cell: (r) => (
                  <Badge pill tone={OUTCOME[r.outcome].tone}>
                    {OUTCOME[r.outcome].label}
                  </Badge>
                ),
              },
            ]}
          />
        </>
      )}
    </div>
  )
}
