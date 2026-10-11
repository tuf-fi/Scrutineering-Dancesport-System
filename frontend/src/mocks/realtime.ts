import { SubmissionStatus, type AdjudicatorSubmission, type Mark } from '@bis/shared'
import { panels } from './data/adjudicators.ts'
import { liveRoundId, marks, rounds } from './data/progress.ts'

// Fakes the venue socket: adjudicators submit one at a time while someone is watching.
// TODO: replace with Socket.IO events in phase 3.
const TICK_MS = 2500
const START_SUBMITTED = 3

const liveRound = rounds.find((r) => r.id === liveRoundId)
const adjudicatorIds = panels.find((p) => p.eventId === liveRound?.eventId)?.adjudicatorIds ?? []

let submitted = START_SUBMITTED
let timer: ReturnType<typeof setInterval> | undefined
const listeners = new Set<(s: AdjudicatorSubmission[]) => void>()

const submittedAt = (adjudicatorId: string) =>
  marks.find((m) => m.roundId === liveRoundId && m.adjudicatorId === adjudicatorId)?.submittedAt ?? null

function liveSnapshot(): AdjudicatorSubmission[] {
  return adjudicatorIds.map((adjudicatorId, i) => ({
    roundId: liveRoundId,
    adjudicatorId,
    status:
      i < submitted
        ? SubmissionStatus.Submitted
        : i === submitted
          ? SubmissionStatus.Marking
          : SubmissionStatus.Waiting,
    submittedAt: i < submitted ? submittedAt(adjudicatorId) : null,
  }))
}

// Rounds that are not live are either done (marks exist) or not started
function staticSnapshot(roundId: string): AdjudicatorSubmission[] {
  const round = rounds.find((r) => r.id === roundId)
  const ids = panels.find((p) => p.eventId === round?.eventId)?.adjudicatorIds ?? []
  return ids.map((adjudicatorId) => {
    const mark = marks.find((m) => m.roundId === roundId && m.adjudicatorId === adjudicatorId)
    return {
      roundId,
      adjudicatorId,
      status: mark ? SubmissionStatus.Submitted : SubmissionStatus.Waiting,
      submittedAt: mark?.submittedAt ?? null,
    }
  })
}

export function getSubmissionSnapshot(roundId: string): AdjudicatorSubmission[] {
  return roundId === liveRoundId ? liveSnapshot() : staticSnapshot(roundId)
}

export function isLiveRound(roundId: string): boolean {
  return roundId === liveRoundId
}

export function liveRoundComplete(): boolean {
  return submitted >= adjudicatorIds.length
}

// Marks the scrutineer can see so far; the live round only shows submitted adjudicators
export function visibleMarks(roundId: string): Mark[] {
  const all = marks.filter((m) => m.roundId === roundId)
  if (roundId !== liveRoundId) return all
  const done = new Set(adjudicatorIds.slice(0, submitted))
  return all.filter((m) => done.has(m.adjudicatorId))
}

function tick() {
  if (liveRoundComplete()) return stop()
  submitted++
  const snap = liveSnapshot()
  listeners.forEach((l) => l(snap))
  if (liveRoundComplete()) stop()
}

function stop() {
  clearInterval(timer)
  timer = undefined
}

export function subscribeSubmissions(
  roundId: string,
  listener: (s: AdjudicatorSubmission[]) => void,
): () => void {
  listener(getSubmissionSnapshot(roundId))
  if (roundId !== liveRoundId) return () => {}

  listeners.add(listener)
  if (!timer && !liveRoundComplete()) timer = setInterval(tick, TICK_MS)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stop()
  }
}

// Demo helper: replay the live round from the start
export function resetLiveRound() {
  submitted = START_SUBMITTED
  const snap = liveSnapshot()
  listeners.forEach((l) => l(snap))
  if (listeners.size > 0 && !timer) timer = setInterval(tick, TICK_MS)
}
