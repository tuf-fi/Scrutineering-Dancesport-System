import type { Id, RoundType } from '@bis/shared'
import { ScoringError } from './errors.ts'

// Places for competitors cut before the final. The ones cut in a round take the places just below everyone
// who went further (30 start, 24 / 18 / 12 / 6 recalled: the cut fill 25-30, 19-24, 13-18 and 7-12), best X
// count first. Competitors with the same X count share a range, such as 7th-8th; when X counts are not given,
// everyone cut in the round shares the whole range.

export interface RoundOutcome {
  roundType: RoundType
  // Everyone who danced the round, and the ones recalled to the next
  competitorIds: Id[]
  recalledIds: Id[]
  // Total X marks per competitor; a competitor missing from it has none
  xCounts?: Record<Id, number>
}

export interface EliminatedPlace {
  competitorId: Id
  roundType: RoundType
  // The shared range, e.g. 13 to 18
  from: number
  to: number
  // The best place in the range, as the compere reads it and as results are stored
  announcedPlace: number
  // Average of the range
  place: number
  xCount: number | null
}

// Rounds in the order they were danced, the last one recalling the finalists
export function placeEliminated(rounds: RoundOutcome[]): EliminatedPlace[] {
  const issues: string[] = []
  rounds.forEach((round, i) => {
    const entered = new Set(round.competitorIds)
    if (entered.size !== round.competitorIds.length) issues.push(`${round.roundType}: a competitor is listed twice.`)
    if (round.recalledIds.some((id) => !entered.has(id))) {
      issues.push(`${round.roundType}: a recalled competitor did not dance the round.`)
    }
    const next = rounds[i + 1]
    if (next) {
      const recalled = [...round.recalledIds].sort()
      const nextEntered = [...next.competitorIds].sort()
      if (recalled.length !== nextEntered.length || recalled.some((id, j) => id !== nextEntered[j])) {
        issues.push(`${round.roundType}: the recalled competitors are not the ones who danced ${next.roundType}.`)
      }
    }
  })
  if (issues.length > 0) throw new ScoringError(issues)

  const placed: EliminatedPlace[] = []
  let from = (rounds[rounds.length - 1]?.recalledIds.length ?? 0) + 1
  for (let i = rounds.length - 1; i >= 0; i--) {
    const round = rounds[i]!
    const recalled = new Set(round.recalledIds)
    const out = round.competitorIds.filter((id) => !recalled.has(id))
    if (out.length === 0) continue
    const count = (id: Id) => (round.xCounts ? (round.xCounts[id] ?? 0) : null)
    // Best X count first; with no counts everyone is level
    const ordered = [...out].sort((a, b) => (count(b) ?? 0) - (count(a) ?? 0))
    for (let k = 0; k < ordered.length; ) {
      let end = k
      while (end + 1 < ordered.length && count(ordered[end + 1]!) === count(ordered[k]!)) end++
      const groupFrom = from + k
      const groupTo = from + end
      for (const competitorId of ordered.slice(k, end + 1)) {
        placed.push({
          competitorId,
          roundType: round.roundType,
          from: groupFrom,
          to: groupTo,
          announcedPlace: groupFrom,
          place: (groupFrom + groupTo) / 2,
          xCount: count(competitorId),
        })
      }
      k = end + 1
    }
    from += out.length
  }

  return placed.sort((a, b) => a.from - b.from || a.competitorId.localeCompare(b.competitorId))
}
