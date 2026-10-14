import { RoundType } from '@bis/shared'
import { describe, expect, it } from 'vitest'
import { adjudicatorState, demoRounds, startDemoRound, submitMarks } from './adjudicating.ts'
import { panels } from './data/adjudicators.ts'
import { completedEvent, currentEvents } from './data/events.ts'
import { completedPoints, liveRoundId, rounds } from './data/progress.ts'
import { rankingPoints, results } from './data/results.ts'
import { recallTable, skatingTable } from './scrutinizing.ts'

describe('final worked out by the Skating System', () => {
  const final = rounds.find((r) => r.eventId === completedEvent.id && r.type === RoundType.Final)!
  const table = skatingTable(final.id)

  it('is complete and places every finalist', () => {
    expect(table.kind).toBe('placing')
    expect(table.complete).toBe(true)
    expect(table.rows).toHaveLength(table.places)
  })

  it('matches the stored results and shows the column counts', () => {
    for (const row of table.rows) {
      const stored = results.find((r) => r.eventId === completedEvent.id && r.competitorId === row.competitorId)
      expect(stored?.place).toBe(row.place)
      expect(row.majority).toHaveLength(table.places)
      // Everyone is placed 1st to last by some adjudicator, so the last column counts the whole panel
      expect(row.majority.at(-1)).toBe(table.adjudicators.length)
    }
  })

  it('turns placings into ranking points from the points table', () => {
    const winner = table.rows[0]!
    const points = completedPoints.get(`res:${completedEvent.id}:${winner.competitorId}`)
    expect(points).toBe(10)
    expect(rankingPoints.some((p) => p.competitorId === winner.competitorId && p.points === 10)).toBe(true)
  })
})

describe('recall rounds', () => {
  it('has no tie once a round is decided and recalls exactly the requested number', () => {
    const decided = rounds.find((r) => r.eventId === completedEvent.id && r.recallNumber !== null)
    expect(decided).toBeDefined()
    const table = recallTable(decided!.id)
    expect(table.tie).toBeNull()
    expect(table.recalled).toBe(decided!.recallNumber)
    expect(table.rows.filter((r) => r.outcome === 'recalled')).toHaveLength(table.recalled)
  })

  it('tallies the live round from the adjudicators who have submitted so far', () => {
    const table = recallTable(liveRoundId)
    const total = table.rows.reduce((sum, r) => sum + r.xCount, 0)
    expect(total).toBe(table.recallNumber * table.submittedCount)
    expect(skatingTable(liveRoundId).complete).toBe(false)
  })
})

describe('multi-dance final', () => {
  it('shows each dance\'s place and the overall place', () => {
    const demo = demoRounds().find((d) => {
      const round = rounds.find((r) => r.id === d.roundId)!
      return round.recallNumber === null && (currentEvents.find((e) => e.id === round.eventId)?.dances.length ?? 0) > 1
    })
    expect(demo).toBeDefined()
    if (!demo) return
    startDemoRound(demo.roundId)
    const round = rounds.find((r) => r.id === demo.roundId)!
    const adjudicatorId = panels.find((p) => p.eventId === round.eventId)!.adjudicatorIds[0]!
    const state = adjudicatorState(adjudicatorId)
    if (state.status !== 'marking') throw new Error('expected a round to mark')
    const order = state.task.competitors.map((c) => c.id)
    submitMarks(adjudicatorId, demo.roundId, state.task.dances.map((dance) => ({ dance, competitorIds: order })))

    const table = skatingTable(demo.roundId)
    expect(table.complete).toBe(false)
    expect(table.places).toBe(0)
    expect(table.rows.map((r) => r.competitorId)).toEqual(order)
    expect(table.rows[0]?.dancePlaces).toHaveLength(state.task.dances.length)
    expect(table.rows[0]?.place).toBe(1)
  })
})
