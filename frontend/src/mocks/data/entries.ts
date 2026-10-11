import type { Entry } from '@bis/shared'
import { clubs } from './clubs.ts'
import { competitors, coupleCompetitors, soloCompetitors } from './competitors.ts'
import { currentCompetitionId } from './competitions.ts'
import { completedEvent, events, featuredEvent } from './events.ts'
import { createRng, shuffle } from './rng.ts'

const rng = createRng(7)
const clubOf = new Map(competitors.map((c) => [c.id, c.clubId]))

export const paymentIdForClub = (clubId: string) => `pay-${clubId}`

export const entries: Entry[] = events.flatMap((event) => {
  const isCurrent = event.competitionId === currentCompetitionId
  const keepAll = event.id === featuredEvent.id || event.id === completedEvent.id
  const count =
    event.id === featuredEvent.id
      ? 34
      : event.id === completedEvent.id
        ? 20
        : event.isSolo
          ? 4 + Math.floor(rng() * 13)
          : 3 + Math.floor(rng() * 6)
  const pool = shuffle(event.isSolo ? soloCompetitors : coupleCompetitors, rng)

  return pool.slice(0, count).map((c) => ({
    id: `${event.id}:${c.id}`,
    eventId: event.id,
    competitorId: c.id,
    scratched: isCurrent && !keepAll && rng() < 0.05,
    // Past competitions were settled long ago, so no payment is linked
    paymentId: isCurrent ? paymentIdForClub(clubOf.get(c.id) ?? clubs[0].id) : null,
  }))
})
