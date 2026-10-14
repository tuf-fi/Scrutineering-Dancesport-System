import type { Id, RoundType } from '@bis/shared'
import { ScoringError } from './errors.ts'

// Places for competitors cut before the final. Everyone cut in the same round shares the range of
// places just below everyone who went further: 30 start, 24 / 18 / 12 / 6 recalled, so the cut
// are 25th-30th, 19th-24th, 13th-18th and 7th-12th. Their X counts are shown but do not order them.

export interface RoundOutcome {
  roundType: RoundType
  // Everyone who danced the round, and the ones recalled to the next
  competitorIds: Id[]
  recalledIds: Id[]
  // Total X marks per competitor, kept for the printout only
  xCounts?: Record<Id, number>
}

export interface EliminatedPlace {
  competitorId: Id
  roundType: RoundType
  // The shared range, e.g. 13 to 18
  from: number
  to: number
  // The best place in the range, as the MC reads it and as results are stored
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
    const to = from + out.length - 1
    for (const competitorId of out) {
      placed.push({
        competitorId,
        roundType: round.roundType,
        from,
        to,
        announcedPlace: from,
        place: (from + to) / 2,
        xCount: round.xCounts?.[competitorId] ?? null,
      })
    }
    from = to + 1
  }

  return placed.sort((a, b) => a.from - b.from || a.competitorId.localeCompare(b.competitorId))
}
