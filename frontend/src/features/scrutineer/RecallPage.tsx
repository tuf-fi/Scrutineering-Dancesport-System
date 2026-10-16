import type { RecallRow, RecallTable, TieDecision } from '@bis/shared'
import { ArrowUpRight, Check, Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge, Button, ErrorState, PageHeader, Skeleton, Table, toast } from '../../components/ui/index.ts'
import { useConfirmTie, useProposeTie, useRecallTable, useStaffUsers } from '../../hooks/index.ts'
import { competitorName } from '../../lib/format.ts'
import { GoToFloor } from './GoToFloor.tsx'
import { RoundSelect } from './RoundSelect.tsx'
import { useRoundChoice } from './useRoundChoice.ts'

const OUTCOME = {
  recalled: { label: 'Recalled', tone: 'success' as const },
  tied: { label: 'Tied', tone: 'warning' as const },
  out: { label: 'Not recalled', tone: 'neutral' as const },
}

// Where the tie decision stands, for the recall panel
function useTieStatus(table: RecallTable | undefined, isChairperson: boolean) {
  const staff = useStaffUsers()
  const decision = table?.tie?.decision
  if (!table?.tie) return null
  if (decision?.confirmedBy) {
    const who = staff.data?.find((u) => u.id === decision.confirmedBy)?.name ?? 'the chairperson'
    return { text: `Confirmed by ${who}.`, confirmed: true }
  }
  if (decision) return { text: 'Proposed. Waiting for the chairperson to confirm.', confirmed: false }
  return isChairperson ? { text: 'The scrutineer has not proposed a decision yet.', confirmed: false } : null
}

function TiePanel({
  roundId,
  table,
  readOnly,
  isChairperson,
  status,
}: {
  roundId: string
  table: RecallTable
  readOnly: boolean
  isChairperson: boolean
  status: ReturnType<typeof useTieStatus>
}) {
  const propose = useProposeTie()
  const confirm = useConfirmTie()
  const [choice, setChoice] = useState<TieDecision['choice']>('more')
  const tie = table.tie!
  const above = table.rows.filter((r) => r.xCount > tie.xCount).length
  const decision = tie.decision

  const options: Array<{ id: TieDecision['choice']; label: string; title: string; note: string }> = [
    { id: 'more', label: `Recall all ${tie.count} tied, ${above + tie.count} in total`, title: `Recall all ${tie.count} tied`, note: `${above + tie.count} in total` },
    { id: 'fewer', label: `Recall only the ${above} above the tie`, title: `Recall only the ${above} above`, note: `${above} in total` },
  ]

  const choosing = !readOnly && !decision?.confirmedBy

  return (
    <section aria-label="Tie at the cutoff" className="grid items-start gap-x-16 gap-y-8 border-y border-neutral-200 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      {status && (
        <p
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-small text-neutral-900 lg:col-span-2 ${
            status.confirmed ? 'border-success/30 bg-success-soft' : 'border-warning/30 bg-warning-soft'
          }`}
        >
          {status.confirmed ? (
            <Check aria-hidden size={16} strokeWidth={2.5} className="shrink-0 text-success" />
          ) : (
            <Clock aria-hidden size={16} strokeWidth={2.5} className="shrink-0 text-warning" />
          )}
          {status.text}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <h2 className="text-small font-semibold text-neutral-900">Tie at the cutoff</h2>
        <p className="text-body text-neutral-900">
          <span className="font-mono font-semibold tabular-nums">{tie.count}</span> competitors tied on{' '}
          <span className="font-mono font-semibold tabular-nums">{tie.xCount}</span> X
        </p>
        <p className="text-small text-neutral-600">
          The recall number is <span className="font-mono tabular-nums text-neutral-900">{table.recallNumber}</span>, and the tie crosses it.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {choosing ? (
          <div role="radiogroup" aria-label="Tie decision" className="grid gap-3 sm:grid-cols-2">
            {options.map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-center gap-4 rounded-xl border px-5 py-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-gold-500 ${
                  choice === o.id
                    ? 'border-brown-950 bg-brown-950 text-white'
                    : 'border-neutral-300 bg-white text-neutral-900 hover:border-neutral-900'
                }`}
              >
                <input
                  type="radio"
                  name="tie-decision"
                  checked={choice === o.id}
                  onChange={() => setChoice(o.id)}
                  className="sr-only"
                />
                <span
                  aria-hidden
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                    choice === o.id ? 'border-gold-400' : 'border-neutral-300'
                  }`}
                >
                  {choice === o.id && <span className="size-2.5 rounded-full bg-gold-400" />}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-small font-semibold">{o.title}</span>
                  <span className={`font-mono text-xs tabular-nums ${choice === o.id ? 'text-brown-100' : 'text-neutral-600'}`}>{o.note}</span>
                </span>
              </label>
            ))}
          </div>
        ) : (
          decision && <p className="text-small text-neutral-600">{options.find((o) => o.id === decision.choice)?.label}.</p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          {choosing && (
            <Button
              className="rounded-lg"
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
  const { rounds, list, roundId, floorId, row, setRoundId, readOnly, isChairperson } = useRoundChoice()
  const isFinal = row?.recallNumber === null
  const recall = useRecallTable(roundId, Boolean(row) && !isFinal)
  const tieStatus = useTieStatus(recall.data, isChairperson)

  if (rounds.isError || recall.isError) return <ErrorState onRetry={() => void Promise.all([rounds.refetch(), recall.refetch()])} />

  const table = recall.data
  const cutoffRank = table ? table.rows.filter((r) => r.outcome === 'recalled').length : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Recall" description="X marks per competitor, with the cutoff for the next round." />
      <section aria-label="Recall" className="flex flex-col gap-6 overflow-hidden rounded-2xl bg-brown-950 p-5 text-white sm:px-8 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <RoundSelect inline rounds={list} value={roundId} onChange={setRoundId} />
            <GoToFloor floorId={floorId} roundId={roundId} onGo={setRoundId} />
          </div>
          {table && !isFinal && table.tie && (
            <p className="flex items-center gap-2.5 text-small font-semibold">
              <span aria-hidden className="size-2 rounded-full bg-warning" />
              Tie at the cutoff
            </p>
          )}
        </div>
        {isFinal ? (
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="flex flex-col gap-2">
              <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">A final is placed, not recalled</h2>
              <p className="text-body text-brown-100">Open the results to see the placings.</p>
            </div>
            <Link
              to={`/scrutineer/results?round=${roundId}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-gold-400 px-4 text-small font-semibold text-black transition-colors hover:bg-gold-300 active:bg-gold-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
            >
              Results
              <ArrowUpRight aria-hidden size={16} strokeWidth={2} />
            </Link>
          </div>
        ) : table ? (
          <div role="status" className="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
            <p className="flex items-baseline gap-3">
              <span className="font-mono text-5xl leading-none tabular-nums">{table.recalled}</span>
              <span className="text-body text-brown-100">recalled</span>
            </p>
            <dl className="flex flex-wrap gap-x-10 gap-y-4">
              <div className="flex flex-col gap-1">
                <dt className="text-xs text-brown-100/60">Recall</dt>{' '}
                <dd className="font-mono text-xl tabular-nums">{table.recallNumber}</dd>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-col gap-1">
                  <dt className="text-xs text-brown-100/60">Adjudicators in</dt>
                  <dd className="font-mono text-xl tabular-nums">
                    {table.submittedCount} <span className="font-sans text-body text-brown-100">of</span> {table.adjudicatorCount}
                  </dd>
                </div>
                <div aria-hidden className="h-0.5 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full bg-gold-400 transition-[width]"
                    style={{ width: `${table.adjudicatorCount ? (table.submittedCount / table.adjudicatorCount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </dl>
          </div>
        ) : (
          <Skeleton className="h-20 w-full max-w-md bg-white/10" />
        )}
      </section>

      {isFinal || !table ? null : (
        <>
          {table.tie && <TiePanel roundId={roundId} table={table} readOnly={readOnly} isChairperson={isChairperson} status={tieStatus} />}

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
              { key: 'x', header: 'X marks', cell: (r) => r.xCount, mono: true, bold: true, align: 'right' },
              {
                key: 'outcome',
                header: 'Outcome',
                cell: (r) => (
                  <Badge tone={OUTCOME[r.outcome].tone}>
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
