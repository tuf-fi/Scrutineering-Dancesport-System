import type { Entry } from '@bis/shared'
import { teams } from './teams.ts'
import { competitors, poolFor } from './competitors.ts'
import { currentCompetitionId } from './competitions.ts'
import { completedEvent, events, featuredEvent } from './events.ts'
import { createRng, shuffle } from './rng.ts'

const rng = createRng(7)
const teamOf = new Map(competitors.map((c) => [c.id, c.teamId]))

export const paymentIdForTeam = (teamId: string) => `pay-${teamId}`

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
  const pool = shuffle(poolFor(event.isSolo, event.ageGroup), rng)

  return pool.slice(0, count).map((c) => ({
    id: `${event.id}:${c.id}`,
    eventId: event.id,
    competitorId: c.id,
    scratched: isCurrent && !keepAll && rng() < 0.05,
    // Past competitions were settled long ago, so no payment is linked
    paymentId: isCurrent ? paymentIdForTeam(teamOf.get(c.id) ?? teams[0].id) : null,
  }))
})
