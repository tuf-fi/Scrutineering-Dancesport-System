import type { MarkingTask, MarkSubmission } from '@bis/shared'
import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { ProgramKind } from '@bis/shared'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useProgram } from '../../hooks/index.ts'
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
  // The next event in the running order, if the secretariat has set one
  const program = useProgram(task.event.competitionId)
  const rows = program.data?.rows ?? []
  const here = rows.findIndex((r) => r.eventId === task.event.id && r.roundType === task.round.type)
  const after = here >= 0 ? rows.slice(here + 1).find((r) => r.kind === ProgramKind.Round && r.eventNumber !== null && r.roundType !== null) : undefined
  const next = after ? { eventNumber: after.eventNumber!, dances: after.dances, roundType: after.roundType!, ageGroup: after.ageGroup, class: after.class, discipline: after.discipline } : null
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

  async function send(submissions: MarkSubmission[], signature?: string) {
    if (sending.current) return
    sending.current = true
    // Stored on the phone first; the screen that follows sends it, and keeps trying until the server has it
    await save({ adjudicatorId, roundId, submissions, signature })
    navigate('/adjudicator/submitted', { replace: true })
  }

  return (
    <MarkSheet
      task={task}
      next={next}
      initial={draft ?? {}}
      onChange={(answers) => void saveDraft({ adjudicatorId, roundId, answers, savedAt: new Date().toISOString() })}
      sign
      onSubmit={(submissions, signature) => void send(submissions, signature)}
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
