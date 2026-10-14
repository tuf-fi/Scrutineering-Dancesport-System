import type { Dance, Id } from '@bis/shared'
import { ScoringError } from './errors.ts'
import { placeDance, rankHolders, validateDance, type DanceResult, type PlacingMark } from './skating.ts'

// Skating System Rules 9-11: the overall places of a multi-dance final.
// Rule 9: add each competitor's dance places; the lowest total wins.
// Rule 10: equal totals, one place at a time: the most marks of that place or higher wins,
// then the lower sum of those marks. Rule 11: still equal, treat every adjudicator's marks from
// every dance as one dance (Rules 5-8) to pick the best. Still equal after that, they share.

export interface FinalDance {
  dance: Dance
  marks: PlacingMark[]
}

export interface FinalInput {
  competitorIds: Id[]
  adjudicatorIds: Id[]
  dances: FinalDance[]
}

export type DecidedBy = 'total' | 'rule10' | 'rule11' | 'shared'

export interface FinalRow {
  competitorId: Id
  // Each dance's place (an average when shared in that dance)
  dancePlaces: Partial<Record<Dance, number>>
  total: number
  // Average of the shared places, e.g. 3.5; equals announcedPlace when not shared
  place: number
  // The best place in the shared range, as the MC reads it
  announcedPlace: number
  shared: boolean
  decidedBy: DecidedBy
}

export interface FinalResult {
  // Sorted by place
  rows: FinalRow[]
  dances: Array<{ dance: Dance; result: DanceResult }>
}

interface SummaryInput {
  competitorIds: Id[]
  // One entry per dance: competitor -> place
  dancePlaces: Array<Record<Id, number>>
  // Every adjudicator's placing per competitor over all dances, for Rule 11
  allMarks: Map<Id, number[]>
  adjudicatorCount: number
}

interface Placed {
  place: number
  announcedPlace: number
  shared: boolean
  decidedBy: DecidedBy
}

// Marks of this place or higher in the final summary, and their sum at face value
function summaryCount(places: number[], column: number) {
  const hits = places.filter((p) => p <= column)
  return { count: hits.length, sum: hits.reduce((total, p) => total + p, 0) }
}

function summarise(input: SummaryInput): Map<Id, Placed> {
  const { competitorIds, dancePlaces, allMarks, adjudicatorCount } = input
  const n = competitorIds.length
  const placesOf = new Map<Id, number[]>(competitorIds.map((id) => [id, dancePlaces.map((d) => d[id]!)]))
  const total = (id: Id) => placesOf.get(id)!.reduce((sum, p) => sum + p, 0)
  const majority11 = Math.floor((adjudicatorCount * dancePlaces.length) / 2) + 1

  const result = new Map<Id, Placed>()
  const totals = [...new Set(competitorIds.map(total))].sort((a, b) => a - b)
  let next = 1

  for (const groupTotal of totals) {
    const remaining = competitorIds.filter((id) => total(id) === groupTotal)
    if (remaining.length === 1) {
      result.set(remaining[0]!, { place: next, announcedPlace: next, shared: false, decidedBy: 'total' })
      next += 1
      continue
    }

    while (remaining.length > 0) {
      if (remaining.length === 1) {
        result.set(remaining[0]!, { place: next, announcedPlace: next, shared: false, decidedBy: 'rule10' })
        next += 1
        break
      }

      // Rule 10 for the place under review
      const scored = remaining.map((id) => ({ id, ...summaryCount(placesOf.get(id)!, next) }))
      const best = scored.reduce((a, b) => (b.count > a.count || (b.count === a.count && b.sum < a.sum) ? b : a))
      const tied = scored.filter((s) => s.count === best.count && s.sum === best.sum).map((s) => s.id)

      if (tied.length === 1) {
        result.set(best.id, { place: next, announcedPlace: next, shared: false, decidedBy: 'rule10' })
        remaining.splice(remaining.indexOf(best.id), 1)
        next += 1
        continue
      }

      // Rule 11: only the best of the tied competitors takes this place; the rest go back to Rule 10
      const { groups } = rankHolders(allMarks, tied, next, n, majority11)
      const top = groups[0]!
      const average = next + (top.length - 1) / 2
      for (const id of top) {
        result.set(id, {
          place: average,
          announcedPlace: next,
          shared: top.length > 1,
          decidedBy: top.length > 1 ? 'shared' : 'rule11',
        })
        remaining.splice(remaining.indexOf(id), 1)
      }
      next += top.length
    }
  }

  return result
}

export function placeFinal(input: FinalInput): FinalResult {
  const { competitorIds, adjudicatorIds, dances } = input
  const issues = dances.flatMap((d) =>
    validateDance({ competitorIds, adjudicatorIds, marks: d.marks }).map((issue) => `${d.dance}: ${issue}`),
  )
  if (dances.length === 0) issues.push('A final needs at least one dance.')
  if (new Set(dances.map((d) => d.dance)).size !== dances.length) issues.push('A dance appears more than once.')
  if (issues.length > 0) throw new ScoringError(issues)

  const results = dances.map((d) => ({
    dance: d.dance,
    result: placeDance({ competitorIds, adjudicatorIds, marks: d.marks }),
  }))
  const dancePlaces = results.map(({ result }) =>
    Object.fromEntries(result.places.map((p) => [p.competitorId, p.place])),
  )

  const allMarks = new Map<Id, number[]>(competitorIds.map((id) => [id, []]))
  for (const d of dances) for (const m of d.marks) allMarks.get(m.competitorId)!.push(m.placing)

  const placed = summarise({ competitorIds, dancePlaces, allMarks, adjudicatorCount: adjudicatorIds.length })

  const rows = competitorIds
    .map<FinalRow>((competitorId) => ({
      competitorId,
      dancePlaces: Object.fromEntries(results.map(({ dance }, i) => [dance, dancePlaces[i]![competitorId]!])),
      total: dancePlaces.reduce((sum, d) => sum + d[competitorId]!, 0),
      ...placed.get(competitorId)!,
    }))
    .sort((a, b) => a.place - b.place || a.competitorId.localeCompare(b.competitorId))

  return { rows, dances: results }
}

// Rules 9 and 10 alone, from dance places already worked out. A Rule 11 tie has no marks to
// work from here, so those competitors are left sharing the place.
export function combineDances(competitorIds: Id[], dancePlaces: Array<Record<Id, number>>): Map<Id, Placed> {
  return summarise({
    competitorIds,
    dancePlaces,
    allMarks: new Map(competitorIds.map((id) => [id, []])),
    adjudicatorCount: 1,
  })
}
