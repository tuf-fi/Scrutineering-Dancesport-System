import { RoundStatus, SubmissionStatus, type AdjudicatorSubmission } from '@bis/shared'
import { useState } from 'react'
import { Link } from 'react-router'
import { RoundStatusBadge } from '../../components/RoundStatusBadge.tsx'
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton, Table, Toolbar, toast } from '../../components/ui/index.ts'
import { useAdjudicators, useEnterMarks, useLiveSubmissions, useMarkingTask } from '../../hooks/index.ts'
import { MarkSheet } from '../adjudicator/MarkSheet.tsx'
import { RoundSelect } from './RoundSelect.tsx'
import { useRoundChoice } from './useRoundChoice.ts'

const STATUS = {
  [SubmissionStatus.Waiting]: { label: 'Not in', tone: 'neutral' as const },
  [SubmissionStatus.Marking]: { label: 'Marking', tone: 'gold' as const },
  [SubmissionStatus.Submitted]: { label: 'Submitted', tone: 'success' as const },
}

// Typing in what an adjudicator wrote on a paper sheet, when their phone cannot send it
export function PaperMarksPage() {
  const { rounds, list, roundId, row, setRoundId } = useRoundChoice()
  const submissions = useLiveSubmissions(roundId)
  const adjudicators = useAdjudicators()
  const task = useMarkingTask(roundId, Boolean(row) && row?.status === RoundStatus.Marking)
  const enter = useEnterMarks()
  const [chosen, setChosen] = useState<string | null>(null)

  if (rounds.isError || task.isError) return <ErrorState onRetry={() => void Promise.all([rounds.refetch(), task.refetch()])} />

  const people = new Map((adjudicators.data ?? []).map((a) => [a.id, a]))
  const open = row?.status === RoundStatus.Marking
  const adjudicator = chosen ? people.get(chosen) : undefined

  if (chosen && adjudicator && task.data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={`Paper marks for ${adjudicator.letter}, ${adjudicator.name}`}
          description="Type in the sheet exactly as written. It is recorded as entered by you."
          actions={
            <Button variant="ghost" onClick={() => setChosen(null)}>
              Back
            </Button>
          }
        />
        <MarkSheet
          key={`${roundId}:${chosen}`}
          task={task.data}
          busy={enter.isPending}
          confirm={{
            title: `Enter these marks for ${adjudicator.letter}?`,
            description: 'They cannot be changed once entered. They are recorded as typed in by you from a paper sheet.',
            action: 'Enter marks',
          }}
          onSubmit={(marks) =>
            enter.mutate(
              { adjudicatorId: chosen, roundId, submissions: marks },
              {
                onSuccess: () => {
                  toast.success(`Marks entered for ${adjudicator.letter}`)
                  setChosen(null)
                },
                onError: (e) => toast.error(e.message),
              },
            )
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Paper marks"
        description="Enter an adjudicator's marks from their paper sheet when their phone cannot send them."
        actions={row ? <RoundStatusBadge status={row.status} /> : undefined}
      />
      <Toolbar>
        <RoundSelect rounds={list} value={roundId} onChange={setRoundId} />
        {row && (
          <Link
            to={`/print/blank-sheets/${row.eventId}`}
            className="text-small font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-4 hover:decoration-neutral-900 sm:ml-auto"
          >
            Print blank sheets
          </Link>
        )}
      </Toolbar>

      {!row ? (
        <EmptyState title="No round chosen" description="Pick a round that is on the floor." />
      ) : !open ? (
        <EmptyState
          title="This round is not open for marking"
          description="Paper marks can be entered while a round is on the floor and before every adjudicator has submitted."
        />
      ) : adjudicators.isLoading || (task.isLoading && !task.data) ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <Table<AdjudicatorSubmission>
          rows={submissions}
          rowKey={(s) => s.adjudicatorId}
          minWidthClass="min-w-0"
          paginationLabel="Adjudicators pagination"
          empty={{ title: 'No adjudicators on this panel yet' }}
          columns={[
            { key: 'letter', header: 'Letter', cell: (s) => people.get(s.adjudicatorId)?.letter ?? '?', mono: true, widthClass: 'w-24' },
            { key: 'who', header: 'Adjudicator', cell: (s) => <span className="font-medium">{people.get(s.adjudicatorId)?.name ?? s.adjudicatorId}</span> },
            { key: 'status', header: 'Status', cell: (s) => <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge> },
            {
              key: 'enter',
              header: 'Action',
              align: 'right',
              detail: false,
              cell: (s) =>
                s.status === SubmissionStatus.Submitted ? null : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!task.data}
                    aria-label={`Enter paper marks for ${people.get(s.adjudicatorId)?.letter ?? ''}`}
                    onClick={() => setChosen(s.adjudicatorId)}
                  >
                    Enter marks
                  </Button>
                ),
            },
          ]}
        />
      )}
    </div>
  )
}
