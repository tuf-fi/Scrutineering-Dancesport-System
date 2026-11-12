import { RoundStatus, type SkatingRow } from '@bis/shared'
import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { skatingColumns } from '../../components/skatingColumns.tsx'
import { RoundStatusBadge } from '../../components/RoundStatusBadge.tsx'
import { Button, ButtonLink, Dialog, ErrorState, PageHeader, SkeletonList, Table, Toolbar, ToolbarActions, toast } from '../../components/ui/index.ts'
import { useApproveRound, useFinalTie, usePublishRound, useSkatingTable } from '../../hooks/index.ts'
import { competitorName } from '../../lib/format.ts'
import { FinalTieSection } from './FinalTieSection.tsx'
import { NoRounds } from './NoRounds.tsx'
import { RoundSelect } from './RoundSelect.tsx'
import { useRoundChoice } from './useRoundChoice.ts'

export function ResultsPage() {
  const { rounds, list, roundId, row, setRoundId, readOnly, isChairperson, noRounds } = useRoundChoice()
  const skating = useSkatingTable(roundId)
  const undecided = row?.status === RoundStatus.Marking || row?.status === RoundStatus.Review
  const finalTie = useFinalTie(roundId, Boolean(row) && row?.recallNumber === null && undecided)
  const approve = useApproveRound()
  const publish = usePublishRound()
  const [confirming, setConfirming] = useState<'approve' | 'publish' | null>(null)

  if (rounds.isError || skating.isError) return <ErrorState onRetry={() => void Promise.all([rounds.refetch(), skating.refetch()])} />
  if (noRounds) return <NoRounds title="Results" description="Each adjudicator's marks and how the round works out." canPlan={!readOnly} />

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
        actions={
          status ? (
            <>
              <span className="text-small font-medium text-neutral-600">Status</span>
              <RoundStatusBadge status={status} />
            </>
          ) : undefined
        }
      />
      <Toolbar>
        <RoundSelect rounds={list} value={roundId} onChange={setRoundId} />
        <ToolbarActions>
          {row && status !== RoundStatus.Pending ? (
            <ButtonLink
              className="rounded-lg"
              to={row.recallNumber === null ? `/print/results/${row.eventId}` : `/print/recall/${row.eventId}?round=${roundId}`}
              target="_blank"
            >
              Print summary
              <ArrowUpRight aria-hidden size={16} strokeWidth={2} />
            </ButtonLink>
          ) : (
            <Button className="rounded-lg" disabled>
              Print summary
              <ArrowUpRight aria-hidden size={16} strokeWidth={2} />
            </Button>
          )}
          {!readOnly && action && (
            <Button onClick={() => setConfirming(action)}>{action === 'approve' ? 'Approve results' : 'Publish results'}</Button>
          )}
        </ToolbarActions>
      </Toolbar>

      {finalTie.data && finalTie.data.groups.length > 0 && undecided && (
        <FinalTieSection key={JSON.stringify(finalTie.data.decision)} tie={finalTie.data} readOnly={readOnly} isChairperson={isChairperson} />
      )}

      {!skating.data ? (
        <SkeletonList rows={5} />
      ) : (
        <>
          <Table<SkatingRow>
            rows={skating.data.rows}
            rowKey={(r) => r.competitorId}
            minWidthClass="min-w-[36rem]"
            paginationLabel="Results pagination"
            detailTitle={(r) => competitorName(r.names)}
            empty={{ title: 'No marks yet', description: 'The table fills in as adjudicators submit.' }}
            columns={skatingColumns(skating.data)}
          />
          {!skating.data.complete && (
            <p className="text-xs text-neutral-500">Provisional until every adjudicator has submitted.</p>
          )}
        </>
      )}

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === 'approve' ? 'Approve these results?' : 'Publish these results?'}
        description={
          confirming === 'approve'
            ? 'The marks are locked. You can then publish the round.'
            : 'Publishing makes the results public on the website and the compere screen.'
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
