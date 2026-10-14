import { useEffect, useRef, useState } from 'react'
import { toast } from '../../components/ui/index.ts'
import { useAdjudicatorState, useSubmitMarks } from '../../hooks/index.ts'
import { removeDraft, removeSent, saveSent } from '../../lib/phoneDb.ts'
import { lostMarksToResend, rememberSent } from '../../lib/recoverSent.ts'
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

  // The server says this adjudicator has not submitted, but the phone remembers sending: the server lost them
  // (restored from an older backup). Send them again; the server stores a repeat once.
  const state = useAdjudicatorState(adjudicatorId)
  const round = state.data?.status === 'marking' ? state.data.task.round.id : null
  const save = useOutbox((s) => s.save)
  useEffect(() => {
    if (!round || pending) return
    let active = true
    void lostMarksToResend(adjudicatorId, round).then((marks) => {
      if (active && marks) void save(marks)
    })
    return () => {
      active = false
    }
  }, [adjudicatorId, round, pending, save])

  useEffect(() => {
    // A retry after a failure goes ahead even if the screen says offline: that flag is what the failure set, and only
    // a successful request can clear it
    const mayTry = online || attempt > 0
    if (!mayTry || !pending || pending.adjudicatorId !== adjudicatorId || submit.isPending) return
    submit.mutate(
      { roundId: pending.roundId, submissions: pending.submissions },
      {
        onSuccess: async () => {
          // The server has them. A copy stays on the phone in case the server is later restored from an older backup.
          await saveSent(pending)
          rememberSent(pending)
          await removeDraft(pending)
          await clear()
        },
        onError: async (error) => {
          const outcome = classifySendError(error)
          if (outcome.result === 'dropped') {
            // Also forget the saved copy, or the phone would offer these marks again and be refused again
            await removeSent(pending)
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
