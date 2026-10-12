import { Class, type AgeGroup, type Discipline, type RankingPoint } from '@bis/shared'

export interface CategoryFilter {
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
}

export interface RankingRow {
  competitorId: string
  rank: number
  points: number
  // Different competitions the points came from
  competitions: number
}

const matches = (p: RankingPoint, f: CategoryFilter) =>
  p.ageGroup === f.ageGroup && p.class === f.class && p.discipline === f.discipline

// Totals each competitor's points in one category, highest first.
// Equal points share a rank, and the next rank skips (1, 2, 2, 4).
export function rankCategory(points: RankingPoint[], filter: CategoryFilter): RankingRow[] {
  const totals = new Map<string, { points: number; competitions: Set<string> }>()
  for (const p of points) {
    if (!matches(p, filter)) continue
    const entry = totals.get(p.competitorId) ?? { points: 0, competitions: new Set<string>() }
    entry.points += p.points
    entry.competitions.add(p.competitionId)
    totals.set(p.competitorId, entry)
  }

  const sorted = [...totals]
    .map(([competitorId, t]) => ({ competitorId, points: t.points, competitions: t.competitions.size }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.competitions - a.competitions ||
        a.competitorId.localeCompare(b.competitorId),
    )

  let rank = 0
  let previous: number | null = null
  return sorted.map((row, i) => {
    if (row.points !== previous) {
      rank = i + 1
      previous = row.points
    }
    return { ...row, rank }
  })
}

// Classes that have any ranking data, in the usual order (E1, D, C, B, A)
export function availableClasses(points: RankingPoint[]): Class[] {
  const present = new Set(points.map((p) => p.class))
  return Object.values(Class).filter((c) => present.has(c))
}

// Every category a competitor has points in
export function categoriesOf(points: RankingPoint[], competitorId: string): CategoryFilter[] {
  const seen = new Map<string, CategoryFilter>()
  for (const p of points) {
    if (p.competitorId !== competitorId) continue
    seen.set(`${p.ageGroup}|${p.class}|${p.discipline}`, {
      ageGroup: p.ageGroup,
      class: p.class,
      discipline: p.discipline,
    })
  }
  return [...seen.values()]
}
