import { RoundStatus, RoundType, SubmissionStatus } from '@bis/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from './api.ts'
import { panels } from './data/adjudicators.ts'
import { ageGroupOf, competitors } from './data/competitors.ts'
import { currentCompetitionId } from './data/competitions.ts'
import { entries } from './data/entries.ts'
import { completedEvent, currentEvents, events, featuredEvent } from './data/events.ts'
import { payments } from './data/payments.ts'
import { liveRoundId, marks, rounds } from './data/progress.ts'
import { results } from './data/results.ts'
import { getSubmissionSnapshot, resetLiveRound, subscribeSubmissions } from './realtime.ts'

const byId = <T extends { id: string }>(items: T[]) => new Map(items.map((i) => [i.id, i]))

describe('program', () => {
  it('numbers each competition sequentially from 1', () => {
    for (const competitionId of new Set(events.map((e) => e.competitionId))) {
      const numbers = events.filter((e) => e.competitionId === competitionId).map((e) => e.number)
      expect(numbers).toEqual(numbers.map((_, i) => i + 1))
    }
  })

  it('has more than 50 events in the current competition', () => {
    expect(currentEvents.length).toBeGreaterThan(50)
  })

  it('only enters a dancer in events for their own age group', () => {
    const eventById = byId(events)
    for (const entry of entries) {
      expect(ageGroupOf.get(entry.competitorId)).toBe(eventById.get(entry.eventId)?.ageGroup)
    }
  })

  it('gives every competitor a unique back number', () => {
    const numbers = competitors.map((c) => c.backNumber)
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  it('gives each entry a real event and competitor, once per event', () => {
    const e = byId(events)
    const c = byId(competitors)
    const keys = new Set(entries.map((x) => `${x.eventId}|${x.competitorId}`))
    expect(keys.size).toBe(entries.length)
    for (const x of entries) {
      expect(e.has(x.eventId)).toBe(true)
      expect(c.has(x.competitorId)).toBe(true)
    }
  })

  it('links every payment to entries that point back at it', () => {
    const entryById = byId(entries)
    for (const p of payments) {
      for (const id of p.entryIds) expect(entryById.get(id)?.paymentId).toBe(p.id)
    }
  })
})

describe('featured event', () => {
  const entryCount = entries.filter((e) => e.eventId === featuredEvent.id).length
  const panel = panels.find((p) => p.eventId === featuredEvent.id)!

  it('is a solo event with a large field and seven adjudicators', () => {
    expect(featuredEvent.isSolo).toBe(true)
    expect(entryCount).toBeGreaterThanOrEqual(30)
    expect(panel.adjudicatorIds).toHaveLength(7)
  })

  it('has every adjudicator mark exactly the recall number in each marked round', () => {
    for (const round of rounds.filter((r) => r.eventId === featuredEvent.id)) {
      if (round.recallNumber === null || round.status === RoundStatus.Pending) continue
      for (const adjudicatorId of panel.adjudicatorIds) {
        const count = marks.filter((m) => m.roundId === round.id && m.adjudicatorId === adjudicatorId).length
        expect(count).toBe(round.recallNumber)
      }
    }
  })
})

describe('completed event', () => {
  it('has each adjudicator use every final place once', () => {
    const final = rounds.find((r) => r.eventId === completedEvent.id && r.type === RoundType.Final)!
    const panel = panels.find((p) => p.eventId === completedEvent.id)!
    for (const adjudicatorId of panel.adjudicatorIds) {
      const placings = marks
        .filter((m) => m.roundId === final.id && m.adjudicatorId === adjudicatorId)
        .map((m) => (m.kind === 'placing' ? m.placing : 0))
        .sort((a, b) => a - b)
      expect(placings).toEqual([1, 2, 3, 4, 5, 6])
    }
  })

  it('places finalists 1 to 6 and every entrant exactly once', () => {
    const own = results.filter((r) => r.eventId === completedEvent.id)
    expect(own.map((r) => r.place).filter((p) => p <= 6).sort()).toEqual([1, 2, 3, 4, 5, 6])
    expect(own).toHaveLength(entries.filter((e) => e.eventId === completedEvent.id).length)
  })
})

describe('live submissions', () => {
  afterEach(() => {
    vi.useRealTimers()
    resetLiveRound()
  })

  it('adds one submission per tick until every adjudicator is done', () => {
    vi.useFakeTimers()
    resetLiveRound()
    const seen: number[] = []
    const count = (s: ReturnType<typeof getSubmissionSnapshot>) =>
      s.filter((x) => x.status === SubmissionStatus.Submitted).length
    const stop = subscribeSubmissions(liveRoundId, (s) => seen.push(count(s)))

    vi.advanceTimersByTime(60_000)
    stop()

    expect(seen[0]).toBe(3)
    expect(seen.at(-1)).toBe(7)
    expect(seen.every((n, i) => i === 0 || n === seen[i - 1] + 1)).toBe(true)
  })

  it('shows only submitted adjudicators marks, then turns the round to review', async () => {
    vi.useFakeTimers()
    resetLiveRound()
    const stop = subscribeSubmissions(liveRoundId, () => {})

    const before = api.getMarks(liveRoundId)
    await vi.advanceTimersByTimeAsync(300)
    const partial = await before
    expect(new Set(partial.map((m) => m.adjudicatorId)).size).toBe(3)

    await vi.advanceTimersByTimeAsync(20_000)
    const round = api.getRound(liveRoundId)
    await vi.advanceTimersByTimeAsync(300)
    expect((await round).status).toBe(RoundStatus.Review)
    stop()
  })
})

describe('fake api', () => {
  it('returns copies so callers cannot change the sample data', async () => {
    vi.useFakeTimers()
    const pending = api.getCompetitions()
    await vi.advanceTimersByTimeAsync(300)
    const list = await pending
    list[0].name = 'changed'
    expect(currentCompetitionId).toBe(list[0].id)
    const again = api.getCompetitions()
    await vi.advanceTimersByTimeAsync(300)
    expect((await again)[0].name).not.toBe('changed')
    vi.useRealTimers()
  })
})
