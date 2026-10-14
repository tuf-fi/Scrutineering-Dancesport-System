import { loadSent, type PendingSubmission } from './phoneDb.ts'

// Marks that were sent in this page session, and when. Used so that marks the server has only just accepted are not
// offered again while its answer catches up.
const sentThisSession = new Map<string, { savedAt: string; at: number }>()

// How long after sending marks they are not offered again. A takeover from an older backup takes much longer than this.
export const COOLDOWN_MS = 15_000

const keyOf = (adjudicatorId: string, roundId: string) => `${adjudicatorId}:${roundId}`

export function rememberSent(pending: Pick<PendingSubmission, 'adjudicatorId' | 'roundId' | 'savedAt'>) {
  sentThisSession.set(keyOf(pending.adjudicatorId, pending.roundId), { savedAt: pending.savedAt, at: Date.now() })
}

// Marks this phone already sent for a round the server now says has not been submitted: the server lost them
// (it was restored from an older backup). Returns what to send again, or null when there is nothing to recover.
export async function lostMarksToResend(adjudicatorId: string, roundId: string): Promise<Omit<PendingSubmission, 'savedAt'> | null> {
  const kept = await loadSent(adjudicatorId, roundId)
  if (!kept) return null
  const recent = sentThisSession.get(keyOf(adjudicatorId, roundId))
  if (recent && recent.savedAt === kept.savedAt && Date.now() - recent.at < COOLDOWN_MS) return null
  return { adjudicatorId, roundId, submissions: kept.submissions }
}

// For tests: forget what was sent in this page session
export const forgetSentThisSession = () => sentThisSession.clear()
