import { RoundStatus, type SkatingRow, type SkatingTable } from '@bis/shared'
import { useState } from 'react'
import { RoundStatusBadge } from '../../components/RoundStatusBadge.tsx'
import { Button, Dialog, ErrorState, PageHeader, Skeleton, Table, Toolbar, toast } from '../../components/ui/index.ts'
import { useApproveRound, usePublishRound, useSkatingTable } from '../../hooks/index.ts'
import { competitorName, ordinal } from '../../lib/format.ts'
import { RoundSelect } from './RoundSelect.tsx'
import { useRoundChoice } from './useRoundChoice.ts'

const placeRange = (k: number) => (k === 1 ? '1' : `1–${k}`)

function columnsFor(table: SkatingTable) {
  const isPlacing = table.kind === 'placing'
  return [
    { key: 'place', header: 'Place', cell: (r: SkatingRow) => (isPlacing ? ordinal(r.place) : r.place), widthClass: 'w-20', mono: true },
    { key: 'back', header: 'Back no.', cell: (r: SkatingRow) => r.backNumber ?? '–', mono: true },
    { key: 'who', header: 'Competitor', cell: (r: SkatingRow) => <span className="font-medium">{competitorName(r.names)}</span>, hideBelow: 'md' as const, detail: false as const },
    ...table.adjudicators.map((a) => ({
      key: `adj-${a.id}`,
      header: a.letter,
      cell: (r: SkatingRow) => r.marks[a.id] ?? '–',
      mono: true,
      align: 'right' as const,
      group: isPlacing ? 'Placings' : 'X marks',
    })),
    ...(isPlacing
      ? Array.from({ length: table.places }, (_, i) => ({
          key: `maj-${i + 1}`,
          header: placeRange(i + 1),
          cell: (r: SkatingRow) => r.majority[i] ?? '',
          mono: true,
          muted: true,
          align: 'right' as const,
          hideBelow: 'md' as const,
          group: 'Majority',
        }))
      : []),
    { key: 'total', header: isPlacing ? 'Total' : 'X', cell: (r: SkatingRow) => r.total, mono: true, align: 'right' as const },
  ]
}

export function ResultsPage() {
  const { rounds, list, roundId, row, setRoundId, readOnly } = useRoundChoice()
  const skating = useSkatingTable(roundId)
  const approve = useApproveRound()
  const publish = usePublishRound()
  const [confirming, setConfirming] = useState<'approve' | 'publish' | null>(null)

  if (rounds.isError || skating.isError) return <ErrorState onRetry={() => void Promise.all([rounds.refetch(), skating.refetch()])} />

  const status = row?.status
  const action = status === RoundStatus.Review ? 'approve' : status === RoundStatus.Approved ? 'publish' : null
  const busy = approve.isPending || publish.isPending

  function run() {
    const mutation = confirming === 'approve' ? approve : publish
    mutation.mutate(roundId, {
      onSuccess: () => {
        toast.success(confirming === 'approve' ? 'Results approved' : 'Results published')
        setConfirming(null)
      },
      onError: (e) => {
        setConfirming(null)
        toast.error(e.message)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Results"
        description="Each adjudicator's marks and how the round works out."
        actions={status ? <RoundStatusBadge status={status} /> : undefined}
      />
      <Toolbar>
        <RoundSelect rounds={list} value={roundId} onChange={setRoundId} />
        {!readOnly && action && (
          <div className="w-full sm:ml-auto sm:w-auto">
            <Button className="w-full sm:w-auto" onClick={() => setConfirming(action)}>
              {action === 'approve' ? 'Approve results' : 'Publish results'}
            </Button>
          </div>
        )}
      </Toolbar>

      {!skating.data ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <Table<SkatingRow>
            rows={skating.data.rows}
            rowKey={(r) => r.competitorId}
            minWidthClass="min-w-[36rem]"
            paginationLabel="Results pagination"
            detailTitle={(r) => competitorName(r.names)}
            empty={{ title: 'No marks yet', description: 'The table fills in as adjudicators submit.' }}
            columns={columnsFor(skating.data)}
          />
          {/* TODO: placings here are a static sample order; the Skating System engine arrives in phase 2 */}
          <p className="text-xs text-neutral-500">Sample order by lowest total. The Skating System calculation is not built yet.</p>
        </>
      )}

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === 'approve' ? 'Approve these results?' : 'Publish these results?'}
        description={
          confirming === 'approve'
            ? 'The marks are locked. You can then publish the round.'
            : 'Publishing makes the results public on the website and the MC screen.'
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={run}>
              {busy ? 'Saving…' : confirming === 'approve' ? 'Approve' : 'Publish'}
            </Button>
          </>
        }
      />
    </div>
  )
}
