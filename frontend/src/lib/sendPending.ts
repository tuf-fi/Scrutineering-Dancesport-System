import { ApiError, isNetworkError } from '../api/http.ts'
import type { PendingSubmission } from './phoneDb.ts'

// What to do with marks the phone is holding, after trying to send them
export type SendOutcome =
  // The server has them: forget them
  | { result: 'sent' }
  // Not delivered (Wi-Fi, server trouble, or the phone must sign in again): keep them and try again
  | { result: 'kept'; reason: 'network' | 'server' }
  // The server will never accept them (the round closed, it is not this adjudicator's round): forget them and say so
  | { result: 'dropped'; message: string }

// Statuses that mean "never": bad marks, not on this panel, no such round, round not open or already submitted differently
const REFUSED_FOR_GOOD = [400, 403, 404, 409]

export function classifySendError(error: unknown): Exclude<SendOutcome, { result: 'sent' }> {
  if (error instanceof ApiError && REFUSED_FOR_GOOD.includes(error.status)) return { result: 'dropped', message: error.message }
  return { result: 'kept', reason: isNetworkError(error) ? 'network' : 'server' }
}

// One attempt to deliver the phone's held marks. Sending the same marks twice is safe: the server stores them once.
export async function sendPending(
  pending: PendingSubmission,
  submit: (roundId: string, submissions: PendingSubmission['submissions']) => Promise<unknown>,
): Promise<SendOutcome> {
  try {
    await submit(pending.roundId, pending.submissions)
    return { result: 'sent' }
  } catch (error) {
    return classifySendError(error)
  }
}
