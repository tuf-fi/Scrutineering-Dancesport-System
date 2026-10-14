import type { MarkingTask, MarkSubmission } from '@bis/shared'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { loadDraft, saveDraft } from '../../lib/phoneDb.ts'
import { useOutbox } from '../../stores/outbox.ts'
import { MarkSheet, type Answers } from './MarkSheet.tsx'
import { useFloor } from './useFloor.ts'

// The adjudicator's marking screen. What they have marked so far is kept on the phone, and confirmed marks are
// saved on the phone before anything is sent, so a refresh or a dropped Wi-Fi never loses them.
function MarkingBoard({ task, adjudicatorId }: { task: MarkingTask; adjudicatorId: string }) {
  const navigate = useNavigate()
  const save = useOutbox((s) => s.save)
  const roundId = task.round.id
  const [draft, setDraft] = useState<Answers | null | undefined>(undefined)
  const sending = useRef(false)

  useEffect(() => {
    let active = true
    void loadDraft(adjudicatorId, roundId).then((d) => active && setDraft(d?.answers ?? null))
    return () => {
      active = false
    }
  }, [adjudicatorId, roundId])

  if (draft === undefined) return <Skeleton className="h-40 w-full" />

  async function send(submissions: MarkSubmission[]) {
    if (sending.current) return
    sending.current = true
    // Stored on the phone first; the screen that follows sends it, and keeps trying until the server has it
    await save({ adjudicatorId, roundId, submissions })
    navigate('/adjudicator/submitted', { replace: true })
  }

  return (
    <MarkSheet
      task={task}
      initial={draft ?? {}}
      onChange={(answers) => void saveDraft({ adjudicatorId, roundId, answers, savedAt: new Date().toISOString() })}
      onSubmit={(submissions) => void send(submissions)}
    />
  )
}

export function MarkPage() {
  const { adjudicatorId, state, pending } = useFloor()

  if (state.isError) return <ErrorState onRetry={() => void state.refetch()} />
  if (!state.data) return <Skeleton className="h-40 w-full" />
  if (pending || state.data.status === 'submitted') return <Navigate to="/adjudicator/submitted" replace />
  if (state.data.status === 'waiting') return <Navigate to="/adjudicator/waiting" replace />

  return <MarkingBoard key={state.data.task.round.id} task={state.data.task} adjudicatorId={adjudicatorId} />
}
