import { ProgramKind, RoundType } from '@bis/shared'
import { and, asc, eq } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { panelAdjudicatorIds, roundAdjudicatorIds, roundsOfEvent } from './shared.ts'

// The adjudicators who mark each round, when a round is marked by some of the event's panel (a pool of 7 where 5 mark
// each round). A round with no set is marked by the whole panel.

const eventRow = (ctx: Ctx, id: string) => found(ctx.db.select().from(t.events).where(eq(t.events.id, id)).get(), 'Event')

// A round that has started keeps the adjudicators it started with
const started = (ctx: Ctx, eventId: string, roundType: string) => {
  const round = roundsOfEvent(ctx, eventId).find((r) => r.type === roundType)
  return round !== undefined && round.status !== 'pending'
}

function writeSet(ctx: Ctx, eventId: string, roundType: RoundType, ids: string[] | null) {
  ctx.db.delete(t.roundSets).where(and(eq(t.roundSets.eventId, eventId), eq(t.roundSets.roundType, roundType))).run()
  for (const adjudicatorId of ids ?? []) ctx.db.insert(t.roundSets).values({ eventId, roundType, adjudicatorId }).run()
}

export const roundSets = {
  // Each round's set as ids; null where the whole panel marks it
  getRoundSets: (ctx: Ctx, competitionId: string) => {
    const events = ctx.db.select({ id: t.events.id }).from(t.events).where(eq(t.events.competitionId, competitionId)).all()
    const ids = new Set(events.map((e) => e.id))
    const rows = ctx.db.select().from(t.roundSets).all().filter((r) => ids.has(r.eventId))
    const by = new Map<string, string[]>()
    for (const r of rows) by.set(`${r.eventId}:${r.roundType}`, [...(by.get(`${r.eventId}:${r.roundType}`) ?? []), r.adjudicatorId])
    return [...by].map(([key, adjudicatorIds]) => {
      const [eventId, roundType] = key.split(':') as [string, RoundType]
      return { eventId, roundType, adjudicatorIds }
    })
  },

  // Who marks one round, for its printed sheets
  getRoundSet(ctx: Ctx, roundId: string): string[] {
    const round = found(ctx.db.select().from(t.rounds).where(eq(t.rounds.id, String(roundId))).get(), 'Round')
    return roundAdjudicatorIds(ctx, round)
  },

  // Chooses the adjudicators of one round from the event's panel; null puts the whole panel back
  setRoundSet(ctx: Ctx, eventId: string, roundType: RoundType, adjudicatorIds: string[] | null): void {
    const event = eventRow(ctx, eventId)
    if (!Object.values(RoundType).includes(roundType)) return fail('Choose a round.')
    if (started(ctx, event.id, roundType)) return fail('This round has started, so its adjudicators can no longer change.', 409)
    const panel = panelAdjudicatorIds(ctx, event.id)
    let chosen: string[] | null = null
    if (adjudicatorIds !== null) {
      const list = Array.isArray(adjudicatorIds) ? [...new Set(adjudicatorIds)] : []
      if (list.length === 0) return fail('Choose at least one adjudicator.')
      if (list.some((id) => !panel.includes(id))) return fail('Choose from the adjudicators on the event\'s panel.')
      // Everyone on the panel is the same as no set at all
      chosen = list.length === panel.length ? null : list
    }
    ctx.db.transaction(() => {
      writeSet(ctx, event.id, roundType, chosen)
      record(ctx.db, actor(ctx).id, 'Changed the adjudicators of a round', `Event ${event.number}, ${roundType}`, { after: { adjudicatorIds: chosen } })
    })
    ctx.defer(() => ctx.hub.program())
  },

  // Gives the rounds that have not started a set each: the window of adjudicators moves on by one place every round, so
  // different people sit out. Returns how many rounds were given a set.
  rotateRoundSets(ctx: Ctx, competitionId: string, setSize: number): number {
    found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, String(competitionId))).get(), 'Competition')
    if (!Number.isInteger(setSize) || setSize < 1) return fail('Say how many adjudicators mark each round.')
    const slots = ctx.db
      .select()
      .from(t.programSlots)
      .where(eq(t.programSlots.competitionId, competitionId))
      .orderBy(asc(t.programSlots.sequence))
      .all()
      .filter((s) => s.kind === ProgramKind.Round && s.eventId && s.roundType)
    let turn = 0
    let done = 0
    ctx.db.transaction(() => {
      for (const slot of slots) {
        const event = eventRow(ctx, slot.eventId!)
        const panel = panelAdjudicatorIds(ctx, event.id)
        if (panel.length === 0 || started(ctx, event.id, slot.roundType!)) continue
        const size = Math.min(setSize, panel.length)
        const picked = size === panel.length ? null : Array.from({ length: size }, (_, i) => panel[(turn + i) % panel.length]!)
        writeSet(ctx, event.id, slot.roundType as RoundType, picked)
        turn += 1
        done += 1
      }
      record(ctx.db, actor(ctx).id, 'Rotated the adjudicators of the rounds', String(competitionId), { after: { setSize, rounds: done } })
    })
    ctx.defer(() => ctx.hub.program())
    return done
  },
}
