import type { CompetitorHistoryLine, PaymentStatus, RankingFilter } from '@bis/shared'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import {
  heatsOfRound,
  hiddenEventIds,
  paymentDetail,
  pointsRows,
  toClub,
  toCompetition,
  toCompetitor,
  toEntry,
  toEvent,
  toMark,
  toPanel,
  toPin,
  toRankingPoint,
  toResult,
  toRound,
  toStaff,
} from './shared.ts'

export const reads = {
  getCompetitions: (ctx: Ctx) =>
    ctx.db.select().from(t.competitions).orderBy(desc(t.competitions.date)).all().map(toCompetition),

  getCompetition: (ctx: Ctx, id: string) =>
    toCompetition(found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, id)).get(), 'Competition')),

  getEvents: (ctx: Ctx, competitionId?: string) =>
    ctx.db
      .select()
      .from(t.events)
      .where(competitionId ? eq(t.events.competitionId, competitionId) : undefined)
      .orderBy(asc(t.events.competitionId), asc(t.events.number))
      .all()
      .map(toEvent),

  getEvent: (ctx: Ctx, id: string) =>
    toEvent(found(ctx.db.select().from(t.events).where(eq(t.events.id, id)).get(), 'Event')),

  getEntries: (ctx: Ctx, eventId: string) =>
    ctx.db.select().from(t.entries).where(eq(t.entries.eventId, eventId)).all().map(toEntry),

  getCompetitors: (ctx: Ctx) => ctx.db.select().from(t.competitors).orderBy(asc(t.competitors.id)).all().map(toCompetitor),

  getClubs: (ctx: Ctx) => ctx.db.select().from(t.clubs).orderBy(asc(t.clubs.name)).all().map(toClub),

  getAdjudicators: (ctx: Ctx) =>
    ctx.db
      .select()
      .from(t.adjudicators)
      .orderBy(asc(t.adjudicators.letter))
      .all()
      .map((a) => ({ id: a.id, name: a.name, letter: a.letter })),

  getAdjudicatorPins: (ctx: Ctx, competitionId: string) =>
    ctx.db.select().from(t.adjudicatorPins).where(eq(t.adjudicatorPins.competitionId, competitionId)).all().map(toPin),

  getPanel: (ctx: Ctx, eventId: string) =>
    toPanel(ctx, found(ctx.db.select().from(t.panels).where(eq(t.panels.eventId, eventId)).get(), 'Panel')),

  getPanels: (ctx: Ctx, competitionId: string) => {
    const events = ctx.db.select({ id: t.events.id }).from(t.events).where(eq(t.events.competitionId, competitionId)).all()
    if (events.length === 0) return []
    return ctx.db
      .select()
      .from(t.panels)
      .where(inArray(t.panels.eventId, events.map((e) => e.id)))
      .all()
      .map((p) => toPanel(ctx, p))
  },

  getRounds: (ctx: Ctx, eventId: string) =>
    ctx.db.select().from(t.rounds).where(eq(t.rounds.eventId, eventId)).orderBy(asc(t.rounds.position)).all().map(toRound),

  getRound: (ctx: Ctx, id: string) =>
    toRound(found(ctx.db.select().from(t.rounds).where(eq(t.rounds.id, id)).get(), 'Round')),

  getHeats: (ctx: Ctx, roundId: string) => heatsOfRound(ctx, roundId),

  getMarks: (ctx: Ctx, roundId: string) =>
    ctx.db.select().from(t.marks).where(eq(t.marks.roundId, roundId)).orderBy(asc(t.marks.submittedAt)).all().map(toMark),

  // Guests see an event's results once its final is published
  getResults: (ctx: Ctx, eventId: string) =>
    hiddenEventIds(ctx).has(eventId)
      ? []
      : ctx.db.select().from(t.results).where(eq(t.results.eventId, eventId)).orderBy(asc(t.results.place)).all().map(toResult),

  getPayments: (ctx: Ctx, status?: PaymentStatus) =>
    ctx.db
      .select()
      .from(t.payments)
      .where(status ? eq(t.payments.status, status) : undefined)
      .all()
      .map((p) => paymentDetailToPayment(ctx, p)),

  getPaymentDetails: (ctx: Ctx) => ctx.db.select().from(t.payments).all().map((p) => paymentDetail(ctx, p)),

  getPointsTable: (ctx: Ctx) => pointsRows(ctx),

  getRankingPoints: (ctx: Ctx, filter: RankingFilter = {}) =>
    ctx.db
      .select()
      .from(t.rankingPoints)
      .where(
        and(
          filter.ageGroup ? eq(t.rankingPoints.ageGroup, filter.ageGroup) : undefined,
          filter.class ? eq(t.rankingPoints.class, filter.class) : undefined,
          filter.discipline ? eq(t.rankingPoints.discipline, filter.discipline) : undefined,
        ),
      )
      .all()
      .map(toRankingPoint),

  getCompetitorHistory: (ctx: Ctx, competitorId: string): CompetitorHistoryLine[] => {
    const hidden = hiddenEventIds(ctx)
    const rows = ctx.db
      .select({ result: t.results, event: t.events, competition: t.competitions })
      .from(t.results)
      .innerJoin(t.events, eq(t.events.id, t.results.eventId))
      .innerJoin(t.competitions, eq(t.competitions.id, t.events.competitionId))
      .where(eq(t.results.competitorId, competitorId))
      .all()
      .filter((r) => !hidden.has(r.event.id))
    const points = new Map(
      ctx.db
        .select()
        .from(t.rankingPoints)
        .where(eq(t.rankingPoints.competitorId, competitorId))
        .all()
        .map((p) => [p.eventId, p.points]),
    )
    return rows
      .map(({ result, event, competition }) => ({
        resultId: result.id,
        competitionId: competition.id,
        competitionName: competition.name,
        competitionDate: competition.date,
        eventNumber: event.number,
        dances: event.dances,
        ageGroup: event.ageGroup,
        class: event.class,
        discipline: event.discipline,
        place: result.place,
        points: points.get(event.id) ?? 0,
      }))
      .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate) || a.eventNumber - b.eventNumber)
  },

  getStaffUsers: (ctx: Ctx) => ctx.db.select().from(t.staffUsers).orderBy(asc(t.staffUsers.name)).all().map(toStaff),

  getAuditLog: (ctx: Ctx) =>
    ctx.db
      .select()
      .from(t.auditLog)
      .orderBy(desc(t.auditLog.at))
      .limit(500)
      .all()
      .map((a) => ({ id: a.id, actorId: a.actorId, action: a.action, target: a.target, at: a.at })),

  // Events that already have results, so the public site only links to what can be shown
  getResultEventIds: (ctx: Ctx, competitionId: string) => {
    const hidden = hiddenEventIds(ctx)
    return ctx.db
      .selectDistinct({ id: t.events.id })
      .from(t.events)
      .innerJoin(t.results, eq(t.results.eventId, t.events.id))
      .where(eq(t.events.competitionId, competitionId))
      .all()
      .map((r) => r.id)
      .filter((id) => !hidden.has(id))
  },
}

// getPayments returns plain payments, without the lines
function paymentDetailToPayment(ctx: Ctx, row: typeof t.payments.$inferSelect) {
  const { clubName: _clubName, lines: _lines, ...payment } = paymentDetail(ctx, row)
  return payment
}
