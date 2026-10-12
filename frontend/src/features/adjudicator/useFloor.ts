import { useEffect } from 'react'
import { useAdjudicatorState, useSubmitMarks } from '../../hooks/index.ts'
import { useAuth } from '../../stores/auth.ts'
import { useConnection } from '../../stores/connection.ts'
import { useOutbox } from '../../stores/outbox.ts'

// What is on the floor for the signed-in adjudicator, refreshed every few seconds
export function useFloor() {
  const user = useAuth((s) => s.user)
  const state = useAdjudicatorState(user?.id ?? '')
  return { adjudicatorId: user?.id ?? '', state, pending: useOutbox((s) => s.pending) }
}

// Sends marks that were saved offline as soon as the phone is back online
export function useOutboxFlush(adjudicatorId: string) {
  const online = useConnection((s) => s.online)
  const { pending, clear } = useOutbox()
  const submit = useSubmitMarks(adjudicatorId)

  useEffect(() => {
    if (!online || !pending || pending.adjudicatorId !== adjudicatorId || submit.isPending) return
    submit.mutate(
      { roundId: pending.roundId, submissions: pending.submissions },
      { onSettled: clear },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pending, adjudicatorId])
}
