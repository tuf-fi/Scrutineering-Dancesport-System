import type { Dance, Id } from '@bis/shared'
import { ScoringError } from './errors.ts'

// Skating System Rule 1: every adjudicator marks exactly the recall number per dance;
// the competitors with the most X marks, summed over all adjudicators and dances, go through.

export interface CallbackMark {
  adjudicatorId: Id
  competitorId: Id
  dance: Dance
}

export interface CallbackInput {
  competitorIds: Id[]
  adjudicatorIds: Id[]
  dances: Dance[]
  recallNumber: number
  marks: CallbackMark[]
}

export interface CallbackRow {
  competitorId: Id
  xCount: number
  // Competition ranking: equal counts share the best rank
  rank: number
  // tied: on the cutoff and cannot be settled without a decision
  outcome: 'recalled' | 'tied' | 'out'
}

export interface CallbackTie {
  xCount: number
  competitorIds: Id[]
  // Recalled if the chairperson recalls only those above the tie, or everyone on it
  fewerCount: number
  moreCount: number
}

export interface CallbackResult {
  recallNumber: number
  rows: CallbackRow[]
  tie: CallbackTie | null
}

export type TieChoice = 'fewer' | 'more'

export function validateCallback(input: CallbackInput): string[] {
  const { competitorIds, adjudicatorIds, dances, recallNumber, marks } = input
  const issues: string[] = []
  const competitors = new Set(competitorIds)
  const adjudicators = new Set(adjudicatorIds)

  if (!Number.isInteger(recallNumber) || recallNumber < 1 || recallNumber > competitorIds.length) {
    issues.push(`Recall number ${recallNumber} must be between 1 and ${competitorIds.length}.`)
  }

  const seen = new Set<string>()
  const perAdjudicatorDance = new Map<string, number>()
  for (const m of marks) {
    if (!adjudicators.has(m.adjudicatorId)) issues.push(`Unknown adjudicator ${m.adjudicatorId}.`)
    if (!competitors.has(m.competitorId)) issues.push(`Unknown competitor ${m.competitorId}.`)
    if (!dances.includes(m.dance)) issues.push(`Dance ${m.dance} is not in this round.`)
    const key = `${m.adjudicatorId}|${m.dance}|${m.competitorId}`
    if (seen.has(key)) issues.push(`Adjudicator ${m.adjudicatorId} marked ${m.competitorId} twice in ${m.dance}.`)
    seen.add(key)
    const countKey = `${m.adjudicatorId}|${m.dance}`
    perAdjudicatorDance.set(countKey, (perAdjudicatorDance.get(countKey) ?? 0) + 1)
  }

  for (const adjudicatorId of adjudicatorIds) {
    for (const dance of dances) {
      const count = perAdjudicatorDance.get(`${adjudicatorId}|${dance}`) ?? 0
      if (count !== recallNumber) {
        issues.push(`Adjudicator ${adjudicatorId} marked ${count} in ${dance}, not ${recallNumber}.`)
      }
    }
  }

  return issues
}

export function tallyCallback(input: CallbackInput): CallbackResult {
  const issues = validateCallback(input)
  if (issues.length > 0) throw new ScoringError(issues)

  const { competitorIds, recallNumber, marks } = input
  const counts = new Map<Id, number>(competitorIds.map((id) => [id, 0]))
  for (const m of marks) counts.set(m.competitorId, (counts.get(m.competitorId) ?? 0) + 1)

  const sorted = [...competitorIds].sort((a, b) => counts.get(b)! - counts.get(a)! || a.localeCompare(b))
  const cutoff = counts.get(sorted[recallNumber - 1]!)!
  const above = sorted.filter((id) => counts.get(id)! > cutoff)
  const onCutoff = sorted.filter((id) => counts.get(id)! === cutoff)
  const tie: CallbackTie | null =
    above.length + onCutoff.length === recallNumber
      ? null
      : {
          xCount: cutoff,
          competitorIds: onCutoff,
          fewerCount: above.length,
          moreCount: above.length + onCutoff.length,
        }

  const rows = sorted.map<CallbackRow>((competitorId) => {
    const xCount = counts.get(competitorId)!
    let outcome: CallbackRow['outcome']
    if (xCount > cutoff) outcome = 'recalled'
    else if (xCount === cutoff) outcome = tie ? 'tied' : 'recalled'
    else outcome = 'out'
    return { competitorId, xCount, rank: 1 + sorted.filter((id) => counts.get(id)! > xCount).length, outcome }
  })

  return { recallNumber, rows, tie }
}

// Competitors going to the next round; a tie needs the chairperson's choice first
export function recalledIds(result: CallbackResult, choice?: TieChoice): Id[] {
  if (!result.tie) return result.rows.filter((r) => r.outcome === 'recalled').map((r) => r.competitorId)
  if (!choice) throw new ScoringError(['The tie at the cutoff must be decided first.'])
  if (choice === 'fewer' && result.tie.fewerCount === 0) {
    throw new ScoringError(['Recalling only those above the tie would recall nobody.'])
  }
  const limit = choice === 'more' ? result.tie.moreCount : result.tie.fewerCount
  return result.rows.slice(0, limit).map((r) => r.competitorId)
}
