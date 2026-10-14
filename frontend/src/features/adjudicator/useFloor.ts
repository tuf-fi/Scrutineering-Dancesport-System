import { useEffect, useRef, useState } from 'react'
import { toast } from '../../components/ui/index.ts'
import { useAdjudicatorState, useSubmitMarks } from '../../hooks/index.ts'
import { removeDraft } from '../../lib/phoneDb.ts'
import { classifySendError } from '../../lib/sendPending.ts'
import { useAuth } from '../../stores/auth.ts'
import { useConnection } from '../../stores/connection.ts'
import { useOutbox } from '../../stores/outbox.ts'

// What is on the floor for the signed-in adjudicator, refreshed whenever the server says something changed
export function useFloor() {
  const user = useAuth((s) => s.user)
  const state = useAdjudicatorState(user?.id ?? '')
  return { adjudicatorId: user?.id ?? '', state, pending: useOutbox((s) => s.pending) }
}

const RETRY_MS = 4000

// Sends the marks saved on the phone, and keeps trying until the server has them. They are only forgotten once the
// server has confirmed them, or has refused them for good (the round closed, or it is not this adjudicator's round).
// A dropped Wi-Fi, a stopped server or a session that needs signing in again all leave them saved.
export function useOutboxFlush(adjudicatorId: string) {
  const online = useConnection((s) => s.online)
  const pending = useOutbox((s) => s.pending)
  const clear = useOutbox((s) => s.clear)
  const submit = useSubmitMarks(adjudicatorId)
  const [attempt, setAttempt] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  useEffect(() => {
    if (!online || !pending || pending.adjudicatorId !== adjudicatorId || submit.isPending) return
    submit.mutate(
      { roundId: pending.roundId, submissions: pending.submissions },
      {
        onSuccess: async () => {
          await removeDraft(pending)
          await clear()
        },
        onError: async (error) => {
          const outcome = classifySendError(error)
          if (outcome.result === 'dropped') {
            await clear()
            toast.error(`Your marks could not be sent: ${outcome.message}`)
            return
          }
          // Wi-Fi, server or sign-in trouble: the marks stay saved on the phone, and the next try is soon
          timer.current = setTimeout(() => setAttempt((n) => n + 1), RETRY_MS)
        },
      },
    )
    // submit changes on every render; only these decide when to try
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, pending, adjudicatorId, attempt])
}
