import { describe, expect, it } from 'vitest'
import type { PointsRow } from '@bis/shared'
import { placeEliminated, rankingPoints } from './index.ts'

// The starting table from ROLES_README
const table: PointsRow[] = [
  { place: 1, label: '1st', points: 10 },
  { place: 2, label: '2nd', points: 8 },
  { place: 3, label: '3rd', points: 6 },
  { place: 4, label: '4th', points: 5 },
  { place: 5, label: '5th', points: 4 },
  { place: 6, label: '6th', points: 3 },
  { place: 7, label: '7th (7-competitor final)', points: 2 },
  { place: null, label: 'Semi-final', points: 1 },
]

const pointsOf = (result: ReturnType<typeof rankingPoints>) =>
  Object.fromEntries(result.map((r) => [r.competitorId, r.points]))

describe('ranking points', () => {
  it('reads each finalist\'s points from the table', () => {
    const finalists = [1, 2, 3, 4, 5, 6].map((p) => ({ competitorId: `c${p}`, place: p, announcedPlace: p }))
    expect(pointsOf(rankingPoints(table, finalists))).toEqual({ c1: 10, c2: 8, c3: 6, c4: 5, c5: 4, c6: 3 })
  })

  it('splits the points of the places a tie covers', () => {
    const finalists = [
      { competitorId: 'a', place: 1, announcedPlace: 1 },
      { competitorId: 'b', place: 2.5, announcedPlace: 2 },
      { competitorId: 'c', place: 2.5, announcedPlace: 2 },
      { competitorId: 'd', place: 4, announcedPlace: 4 },
    ]
    expect(pointsOf(rankingPoints(table, finalists))).toEqual({ a: 10, b: 7, c: 7, d: 5 })
  })

  it('splits a three-way tie over three places', () => {
    const finalists = [
      { competitorId: 'a', place: 2, announcedPlace: 1 },
      { competitorId: 'b', place: 2, announcedPlace: 1 },
      { competitorId: 'c', place: 2, announcedPlace: 1 },
    ]
    expect(pointsOf(rankingPoints(table, finalists))).toEqual({ a: 8, b: 8, c: 8 })
  })

  it('counts a place past the table as no points', () => {
    expect(pointsOf(rankingPoints(table, [{ competitorId: 'z', place: 9, announcedPlace: 9 }]))).toEqual({ z: 0 })
  })

  it('gives the semi-final row only to those cut in the semi-final', () => {
    const ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `c${from + i}`)
    const eliminated = placeEliminated([
      { roundType: 'quarter_final', competitorIds: ids(1, 18), recalledIds: ids(1, 12) },
      { roundType: 'semi_final', competitorIds: ids(1, 12), recalledIds: ids(1, 6) },
    ])
    const points = pointsOf(rankingPoints(table, [], eliminated))
    expect(points['c7']).toBe(1)
    expect(points['c12']).toBe(1)
    expect(points['c13']).toBe(0)
  })

  it('follows an edited table', () => {
    const edited = table.map((r) => (r.place === 1 ? { ...r, points: 25 } : r))
    expect(pointsOf(rankingPoints(edited, [{ competitorId: 'a', place: 1, announcedPlace: 1 }]))).toEqual({ a: 25 })
  })
})
