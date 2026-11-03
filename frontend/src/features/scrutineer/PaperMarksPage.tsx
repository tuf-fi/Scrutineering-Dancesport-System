import { RoundStatus, SubmissionStatus } from '@bis/shared'
import { useState, type ReactNode } from 'react'
import { EmptyState, ErrorState, PageHeader, Select, SkeletonList, Toolbar, toast } from '../../components/ui/index.ts'
import { useAdjudicators, useEnterAdjudicatorMarks, useLiveSubmissions, useMarkingTask } from '../../hooks/index.ts'
import { MarkSheet } from '../adjudicator/MarkSheet.tsx'
import { GoToFloor } from './GoToFloor.tsx'
import { RoundSelect } from './RoundSelect.tsx'
import { useRoundChoice } from './useRoundChoice.ts'

const OPEN = [RoundStatus.Marking, RoundStatus.Review] as const

// The paper fallback: an adjudicator whose phone failed hands in their sheet, and the scrutineer types it in here
export function PaperMarksPage() {
  const { rounds, list, roundId, floorId, row, setRoundId } = useRoundChoice()
  const [adjudicatorId, setAdjudicatorId] = useState('')

  if (rounds.isError) return <ErrorState onRetry={() => void rounds.refetch()} />

  const roundSelect = (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      <RoundSelect rounds={list} value={roundId} onChange={(id) => { setRoundId(id); setAdjudicatorId('') }} />
      <GoToFloor floorId={floorId} roundId={roundId} onGo={(id) => { setRoundId(id); setAdjudicatorId('') }} />
    </div>
  )
  const open = row !== undefined && (OPEN as readonly string[]).includes(row.status)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Paper marks" description="Type in the marks from an adjudicator's paper sheet when their phone could not send them." />

      {!open && <Toolbar>{roundSelect}</Toolbar>}

      {!row ? (
        <SkeletonList rows={3} />
      ) : !open ? (
        <EmptyState
          title="This round is not open for marks"
          description={row.status === RoundStatus.Pending ? 'Start the round first. Marks can be typed in only while a round is being marked or reviewed.' : 'The round is already approved. Its marks can no longer be entered.'}
        />
      ) : (
        <Sheet key={roundId} roundId={roundId} roundSelect={roundSelect} adjudicatorId={adjudicatorId} onAdjudicator={setAdjudicatorId} />
      )}
    </div>
  )
}

function Sheet({ roundId, roundSelect, adjudicatorId, onAdjudicator }: { roundId: string; roundSelect: ReactNode; adjudicatorId: string; onAdjudicator: (id: string) => void }) {
  const submissions = useLiveSubmissions(roundId)
  const adjudicators = useAdjudicators()
  const task = useMarkingTask(roundId)
  const enter = useEnterAdjudicatorMarks()
  const people = new Map((adjudicators.data ?? []).map((a) => [a.id, a]))
  const waiting = submissions.filter((s) => s.status !== SubmissionStatus.Submitted)
  const chosen = people.get(adjudicatorId)

  // The round and the adjudicator are filters of one row; what is typed in sits below them
  const filters = (children: ReactNode) => <Toolbar>{roundSelect}{children}</Toolbar>
  if (task.isError) return <ErrorState onRetry={() => void task.refetch()} />
  if (adjudicators.isLoading) return <>{filters(null)}<SkeletonList rows={3} /></>
  if (submissions.length > 0 && waiting.length === 0) {
    return (
      <>
        {filters(null)}
        <EmptyState title="Everyone has submitted" description="Every adjudicator on this panel has sent their marks, so there is nothing to type in." />
      </>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {filters(
      <div className="w-full sm:w-80">
        <Select label="Adjudicator" value={adjudicatorId} onChange={(e) => onAdjudicator(e.target.value)}>
          <option value="">Choose who handed in a sheet</option>
          {waiting.map((s) => {
            const person = people.get(s.adjudicatorId)
            return (
              <option key={s.adjudicatorId} value={s.adjudicatorId}>
                {person?.letter ?? '?'} · {person?.name ?? s.adjudicatorId}
              </option>
            )
          })}
        </Select>
      </div>,
      )}

      {!chosen ? (
        <p className="text-body text-neutral-600">Choose the adjudicator whose sheet you are typing in.</p>
      ) : !task.data ? (
        <SkeletonList rows={5} />
      ) : (
        <section aria-label={`Marks of ${chosen.name}`} className="flex flex-col gap-4 border-t border-neutral-200 pt-6">
          <p className="text-small text-neutral-600">
            Typing in the sheet of <span className="font-semibold text-neutral-900">{chosen.letter} · {chosen.name}</span>. Enter exactly what is written on it.
          </p>
          <MarkSheet
            key={`${roundId}-${adjudicatorId}`}
            task={task.data}
            compact
            busy={enter.isPending}
            confirm={{
              title: `Enter the marks of ${chosen.name}?`,
              description: 'Check them against the paper sheet. They cannot be changed once entered.',
              action: 'Enter marks',
            }}
            onSubmit={(marks) =>
              enter.mutate(
                { adjudicatorId, roundId, submissions: marks },
                {
                  onSuccess: () => {
                    toast.success(`Marks entered for ${chosen.name}`)
                    onAdjudicator('')
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          />
        </section>
      )}
    </div>
  )
}
