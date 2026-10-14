import type { Id } from '@bis/shared'
import { ScoringError } from './errors.ts'

// Skating System Rules 5-8: places for one dance in a final.
// Place k is decided by counting marks of "k and higher" (a column) and looking for a majority.
// Rule 6: the greater majority wins. Rule 7: equal majority, the lower sum wins; still equal, the
// next column decides for those competitors only; still equal at the last column, they share
// the average place. Rule 8: no majority, move to the next column.

export interface PlacingMark {
  adjudicatorId: Id
  competitorId: Id
  placing: number
}

export interface DanceInput {
  competitorIds: Id[]
  adjudicatorIds: Id[]
  marks: PlacingMark[]
}

export interface DancePlace {
  competitorId: Id
  // Average of the shared places, e.g. 3.5; equals announcedPlace when not shared
  place: number
  // The best place in the shared range, as the MC reads it
  announcedPlace: number
  shared: boolean
  // The column ("k and higher") in which this competitor was placed
  column: number
}

export interface DanceColumn {
  // Marks of this place or higher, and their sum
  count: number
  sum: number
}

export interface DanceResult {
  majority: number
  places: DancePlace[]
  // The tabulation, per competitor, for columns 1..n
  columns: Record<Id, DanceColumn[]>
}

export function validateDance(input: DanceInput): string[] {
  const { competitorIds, adjudicatorIds, marks } = input
  const issues: string[] = []
  const competitors = new Set(competitorIds)
  const adjudicators = new Set(adjudicatorIds)
  const n = competitorIds.length

  const byAdjudicator = new Map<Id, PlacingMark[]>()
  for (const m of marks) {
    if (!adjudicators.has(m.adjudicatorId)) issues.push(`Unknown adjudicator ${m.adjudicatorId}.`)
    if (!competitors.has(m.competitorId)) issues.push(`Unknown competitor ${m.competitorId}.`)
    if (!Number.isInteger(m.placing) || m.placing < 1 || m.placing > n) {
      issues.push(`Adjudicator ${m.adjudicatorId} gave an invalid placing ${m.placing} to ${m.competitorId}.`)
    }
    byAdjudicator.set(m.adjudicatorId, [...(byAdjudicator.get(m.adjudicatorId) ?? []), m])
  }

  for (const adjudicatorId of adjudicatorIds) {
    const given = byAdjudicator.get(adjudicatorId) ?? []
    const placed = new Set(given.map((m) => m.competitorId))
    const places = new Set(given.map((m) => m.placing))
    if (given.length !== n || placed.size !== n) {
      issues.push(`Adjudicator ${adjudicatorId} must place all ${n} competitors once.`)
    } else if (places.size !== n) {
      issues.push(`Adjudicator ${adjudicatorId} used a place more than once.`)
    }
  }

  return issues
}

// Marks of this place or higher, and their sum
const countAt = (placings: number[], column: number) => placings.filter((p) => p <= column).length
const sumAt = (placings: number[], column: number) =>
  placings.filter((p) => p <= column).reduce((total, p) => total + p, 0)

// Best first; competitors with equal count and sum at this column go to the next column
function rankGroup(placingsOf: Map<Id, number[]>, group: Id[], column: number, n: number): Id[][] {
  if (group.length === 1 || column > n) return [group]
  const count = (id: Id) => countAt(placingsOf.get(id)!, column)
  const sum = (id: Id) => sumAt(placingsOf.get(id)!, column)
  const sorted = [...group].sort((a, b) => count(b) - count(a) || sum(a) - sum(b))
  const runs: Id[][] = []
  for (const id of sorted) {
    const last = runs[runs.length - 1]
    const head = last?.[0]
    if (last && head !== undefined && count(head) === count(id) && sum(head) === sum(id)) last.push(id)
    else runs.push([id])
  }
  return runs.flatMap((run) => rankGroup(placingsOf, run, column + 1, n))
}

// Rules 5-8 for the place `start`: walk the columns until someone has a majority, then order
// every holder, best first. Used by single dances and by Rule 11 over all dances' marks.
export function rankHolders(
  placingsOf: Map<Id, number[]>,
  candidates: Id[],
  start: number,
  n: number,
  majority: number,
): { column: number; groups: Id[][] } {
  let column = start
  let holders: Id[] = []
  for (; column <= n; column++) {
    holders = candidates.filter((id) => countAt(placingsOf.get(id)!, column) >= majority)
    if (holders.length > 0) break
  }
  // Column n counts every mark, so with a full set of marks someone always holds a majority by then
  if (holders.length === 0) return { column, groups: [candidates] }
  return { column, groups: rankGroup(placingsOf, holders, column, n) }
}

export function placeDance(input: DanceInput): DanceResult {
  const issues = validateDance(input)
  if (issues.length > 0) throw new ScoringError(issues)

  const { competitorIds, adjudicatorIds, marks } = input
  const n = competitorIds.length
  const majority = Math.floor(adjudicatorIds.length / 2) + 1

  const placingsOf = new Map<Id, number[]>(competitorIds.map((id) => [id, []]))
  for (const m of marks) placingsOf.get(m.competitorId)!.push(m.placing)

  const remaining = new Set(competitorIds)
  const places: DancePlace[] = []
  let next = 1
  while (remaining.size > 0) {
    const { column, groups } = rankHolders(placingsOf, [...remaining], next, n, majority)
    for (const group of groups) {
      const average = next + (group.length - 1) / 2
      for (const competitorId of group) {
        places.push({ competitorId, place: average, announcedPlace: next, shared: group.length > 1, column })
        remaining.delete(competitorId)
      }
      next += group.length
    }
  }

  const columns: Record<Id, DanceColumn[]> = {}
  for (const id of competitorIds) {
    const placings = placingsOf.get(id)!
    columns[id] = Array.from({ length: n }, (_, i) => ({ count: countAt(placings, i + 1), sum: sumAt(placings, i + 1) }))
  }

  return { majority, places, columns }
}
