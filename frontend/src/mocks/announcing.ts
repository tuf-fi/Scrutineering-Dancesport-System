import { type Announcement, type Event, type Round, RoundType } from '@bis/shared'
import { clubs } from './data/clubs.ts'
import { competitors } from './data/competitors.ts'
import { completedEvent, featuredEvent } from './data/events.ts'
import { heats, rounds } from './data/progress.ts'
import { results } from './data/results.ts'

const person = (id: string) => competitors.find((c) => c.id === id)
const backNumbers = (ids: string[]) =>
  ids
    .map((id) => person(id)?.backNumber)
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b)

function base(event: Event, round: Round) {
  return {
    eventNumber: event.number,
    dances: event.dances,
    ageGroup: event.ageGroup,
    class: event.class,
    discipline: event.discipline,
    roundType: round.type,
    heat: null,
    numbers: [] as number[],
    result: null,
  }
}

// The next event to the floor: its first heat
function callFor(event: Event, round: Round): Announcement[] {
  const first = heats.find((h) => h.roundId === round.id && h.number === 1)
  if (!first) return []
  return [{ ...base(event, round), id: `call:${round.id}`, kind: 'call', heat: 1, numbers: backNumbers(first.competitorIds) }]
}

// TODO: the real announcements come from the scrutineer publishing each round; the sample replays one finished event
export function announcements(): Announcement[] {
  const list: Announcement[] = []

  const live = rounds.find((r) => r.eventId === featuredEvent.id && r.status !== 'published' && r.status !== 'pending')
  if (live) list.push(...callFor(featuredEvent, live))

  const done = rounds.filter((r) => r.eventId === completedEvent.id)
  done.forEach((round, i) => {
    const next = done[i + 1]
    if (!next || next.type === RoundType.Final) return
    // Who goes through is who is in the next round
    const through = heats.filter((h) => h.roundId === next.id).flatMap((h) => h.competitorIds)
    list.push({ ...base(completedEvent, round), id: `recall:${round.id}`, kind: 'recall', numbers: backNumbers(through) })
  })

  const final = done.find((r) => r.type === RoundType.Final)
  const placed = results
    .filter((r) => r.eventId === completedEvent.id && r.place <= 6)
    .sort((a, b) => b.place - a.place)
  if (final && placed.length > 0) {
    list.push({
      ...base(completedEvent, final),
      id: `finalists:${final.id}`,
      kind: 'finalists',
      numbers: backNumbers(placed.map((r) => r.competitorId)),
    })
    // Read out from last place up, one at a time
    for (const r of placed) {
      const dancer = person(r.competitorId)
      list.push({
        ...base(completedEvent, final),
        id: `result:${r.id}`,
        kind: 'result',
        result: {
          place: r.place,
          backNumber: dancer?.backNumber ?? null,
          names: dancer?.names ?? [],
          clubName: clubs.find((c) => c.id === dancer?.clubId)?.name ?? '',
        },
      })
    }
  }
  return list
}
