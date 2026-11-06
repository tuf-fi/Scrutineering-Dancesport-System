import { rankingPoints, type EliminatedPlace } from '@bis/scoring'
import { eq } from 'drizzle-orm'
import type { Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { newId } from '../ids.ts'
import { pointsRows } from './shared.ts'

// Works out an event's ranking points from its stored results and the current points table, and
// replaces what was stored. Used when a final is approved and when the admin edits the table.
export function recomputeEventPoints(ctx: Ctx, eventId: string) {
  const event = ctx.db.select().from(t.events).where(eq(t.events.id, eventId)).get()
  if (!event) return
  const rows = ctx.db.select().from(t.results).where(eq(t.results.eventId, eventId)).all()
  const competition = ctx.db.select({ usesPoints: t.competitions.usesPoints }).from(t.competitions).where(eq(t.competitions.id, event.competitionId)).get()

  const finalists = rows
    .filter((r) => r.stage === 'final')
    .map((r) => ({ competitorId: r.competitorId, place: (r.placeFrom + r.placeTo) / 2, announcedPlace: r.placeFrom }))
  const eliminated: EliminatedPlace[] = rows
    .filter((r) => r.stage !== 'final')
    .map((r) => ({
      competitorId: r.competitorId,
      roundType: r.stage,
      from: r.placeFrom,
      to: r.placeTo,
      announcedPlace: r.placeFrom,
      place: (r.placeFrom + r.placeTo) / 2,
      xCount: null,
    }))

  ctx.db.delete(t.rankingPoints).where(eq(t.rankingPoints.eventId, eventId)).run()
  if (competition?.usesPoints === false) return
  for (const p of rankingPoints(pointsRows(ctx), finalists, eliminated)) {
    if (p.points === 0) continue
    ctx.db
      .insert(t.rankingPoints)
      .values({
        id: newId(),
        competitorId: p.competitorId,
        ageGroup: event.ageGroup,
        class: event.class,
        discipline: event.discipline,
        competitionId: event.competitionId,
        eventId,
        points: p.points,
      })
      .run()
  }
}

export function recomputeCompetitionPoints(ctx: Ctx, competitionId: string) {
  const events = ctx.db
    .selectDistinct({ id: t.results.eventId })
    .from(t.results)
    .innerJoin(t.events, eq(t.events.id, t.results.eventId))
    .where(eq(t.events.competitionId, competitionId))
    .all()
  for (const e of events) recomputeEventPoints(ctx, e.id)
}

export function recomputeAllPoints(ctx: Ctx) {
  const events = ctx.db.selectDistinct({ id: t.results.eventId }).from(t.results).all()
  for (const e of events) recomputeEventPoints(ctx, e.id)
}
