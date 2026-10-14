import {
  PaymentStatus,
  pickCurrentCompetition,
  Role,
  RoundStatus,
  type AdjudicatorPin,
  type Club,
  type Competition,
  type Competitor,
  type Entry,
  type Event,
  type Heat,
  type Mark,
  type Panel,
  type Payment,
  type PaymentDetail,
  type PointsRow,
  type RankingPoint,
  type Result,
  type Round,
  type StaffUser,
} from '@bis/shared'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'

export const toCompetition = (r: typeof t.competitions.$inferSelect): Competition => ({
  id: r.id,
  name: r.name,
  date: r.date,
  venue: r.venue,
  organizer: r.organizer,
})

export const toEvent = (r: typeof t.events.$inferSelect): Event => ({
  id: r.id,
  competitionId: r.competitionId,
  number: r.number,
  ageGroup: r.ageGroup,
  class: r.class,
  discipline: r.discipline,
  dances: r.dances,
  isSolo: r.isSolo,
})

// The password hash never leaves the server
export const toClub = (r: typeof t.clubs.$inferSelect): Club => ({
  id: r.id,
  name: r.name,
  contactName: r.contactName,
  contactEmail: r.contactEmail,
  contactPhone: r.contactPhone,
})

export const toCompetitor = (r: typeof t.competitors.$inferSelect): Competitor => ({
  id: r.id,
  names: r.names,
  backNumber: r.backNumber,
  clubId: r.clubId,
})

export const toEntry = (r: typeof t.entries.$inferSelect): Entry => ({
  id: r.id,
  eventId: r.eventId,
  competitorId: r.competitorId,
  scratched: r.scratched,
  paymentId: r.paymentId,
  late: r.late,
})

export const toRound = (r: typeof t.rounds.$inferSelect): Round => ({
  id: r.id,
  eventId: r.eventId,
  type: r.type,
  recallNumber: r.recallNumber,
  status: r.status,
})

export const toMark = (r: typeof t.marks.$inferSelect): Mark => {
  const base = {
    id: r.id,
    roundId: r.roundId,
    adjudicatorId: r.adjudicatorId,
    competitorId: r.competitorId,
    dance: r.dance,
    submittedAt: r.submittedAt,
  }
  return r.kind === 'placing' ? { ...base, kind: 'placing', placing: r.placing ?? 0 } : { ...base, kind: 'x' }
}

export const toResult = (r: typeof t.results.$inferSelect): Result => ({
  id: r.id,
  eventId: r.eventId,
  competitorId: r.competitorId,
  place: r.place,
  placeFrom: r.placeFrom,
  placeTo: r.placeTo,
  approvedBy: r.approvedBy,
  approvedAt: r.approvedAt,
})

export const toRankingPoint = (r: typeof t.rankingPoints.$inferSelect): RankingPoint => ({
  id: r.id,
  competitorId: r.competitorId,
  ageGroup: r.ageGroup,
  class: r.class,
  discipline: r.discipline,
  competitionId: r.competitionId,
  points: r.points,
})

export const toStaff = (r: typeof t.staffUsers.$inferSelect): StaffUser => ({
  id: r.id,
  name: r.name,
  username: r.username,
  role: r.role,
})

export const toPin = (r: typeof t.adjudicatorPins.$inferSelect): AdjudicatorPin => ({
  competitionId: r.competitionId,
  adjudicatorId: r.adjudicatorId,
  pin: r.pin,
})

// TODO: entry fees should come from the organizer's settings
const FEE_SOLO = 500
const FEE_COUPLE = 800
export const feeFor = (event: { isSolo: boolean }) => (event.isSolo ? FEE_SOLO : FEE_COUPLE)

export const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export function cleanNames(names: unknown, what = 'competitor'): string[] {
  const list = Array.isArray(names) ? names.map(clean).filter(Boolean) : []
  if (list.length < 1 || list.length > 2) return fail(`A ${what} is one dancer or a couple.`)
  return list
}

export const getEventRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.events).where(eq(t.events.id, id)).get(), 'Event')

export const getRoundRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.rounds).where(eq(t.rounds.id, id)).get(), 'Round')

export const getCompetitorRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.competitors).where(eq(t.competitors.id, id)).get(), 'Competitor')

export const getClubRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.clubs).where(eq(t.clubs.id, id)).get(), 'Club')

export const getPaymentRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.payments).where(eq(t.payments.id, id)).get(), 'Payment')

export const competitionOfEvent = (ctx: Ctx, eventId: string) => getEventRow(ctx, eventId).competitionId

// The competition happening now (see pickCurrentCompetition): PINs and the club portal belong to it
export function currentCompetition(ctx: Ctx) {
  return pickCurrentCompetition(ctx.db.select().from(t.competitions).all())
}

export const panelAdjudicatorIds = (ctx: Ctx, eventId: string): string[] =>
  ctx.db
    .select({ id: t.adjudicators.id })
    .from(t.panels)
    .innerJoin(t.panelMembers, eq(t.panelMembers.panelId, t.panels.id))
    .innerJoin(t.adjudicators, eq(t.adjudicators.id, t.panelMembers.adjudicatorId))
    .where(eq(t.panels.eventId, eventId))
    .orderBy(asc(t.adjudicators.letter))
    .all()
    .map((r) => r.id)

export const toPanel = (ctx: Ctx, row: typeof t.panels.$inferSelect): Panel => ({
  id: row.id,
  eventId: row.eventId,
  adjudicatorIds: panelAdjudicatorIds(ctx, row.eventId),
})

export const activeEntryRows = (ctx: Ctx, eventId: string) =>
  ctx.db
    .select()
    .from(t.entries)
    .where(and(eq(t.entries.eventId, eventId), eq(t.entries.scratched, false)))
    .all()

export const roundsOfEvent = (ctx: Ctx, eventId: string) =>
  ctx.db.select().from(t.rounds).where(eq(t.rounds.eventId, eventId)).orderBy(asc(t.rounds.position)).all()

export function heatsOfRound(ctx: Ctx, roundId: string): Heat[] {
  const heats = ctx.db.select().from(t.heats).where(eq(t.heats.roundId, roundId)).orderBy(asc(t.heats.number)).all()
  if (heats.length === 0) return []
  const members = ctx.db
    .select()
    .from(t.heatCompetitors)
    .where(inArray(t.heatCompetitors.heatId, heats.map((h) => h.id)))
    .all()
  return heats.map((h) => ({
    id: h.id,
    roundId: h.roundId,
    number: h.number,
    competitorIds: members.filter((m) => m.heatId === h.id).map((m) => m.competitorId),
  }))
}

export const backNumbers = (ctx: Ctx, ids: string[]): Map<string, number | null> =>
  new Map(
    ids.length === 0
      ? []
      : ctx.db
          .select({ id: t.competitors.id, backNumber: t.competitors.backNumber })
          .from(t.competitors)
          .where(inArray(t.competitors.id, ids))
          .all()
          .map((c) => [c.id, c.backNumber]),
  )

const MAX_HEAT = 12

// Splits a field into the fewest even heats of at most 12, lowest back numbers first
export function splitIntoHeats(ctx: Ctx, ids: string[]): string[][] {
  if (ids.length === 0) return []
  const numbers = backNumbers(ctx, ids)
  const sorted = [...ids].sort((a, b) => (numbers.get(a) ?? Infinity) - (numbers.get(b) ?? Infinity))
  const count = Math.ceil(sorted.length / MAX_HEAT)
  const size = Math.ceil(sorted.length / count)
  return Array.from({ length: count }, (_, i) => sorted.slice(i * size, (i + 1) * size))
}

export function saveHeats(ctx: Ctx, roundId: string, groups: string[][]) {
  ctx.db.delete(t.heats).where(eq(t.heats.roundId, roundId)).run()
  groups.forEach((competitorIds, i) => {
    const id = `${roundId}:h${i + 1}`
    ctx.db.insert(t.heats).values({ id, roundId, number: i + 1 }).run()
    for (const competitorId of competitorIds) ctx.db.insert(t.heatCompetitors).values({ heatId: id, competitorId }).run()
  })
}

export const roundAdvanced = (status: RoundStatus) =>
  status === RoundStatus.Approved || status === RoundStatus.Published

// The competitors in a round: its saved heats; else everyone entered (first round) or whoever the
// previous round recalled, once that round is decided
export function fieldOf(ctx: Ctx, round: typeof t.rounds.$inferSelect): string[] {
  const saved = heatsOfRound(ctx, round.id).flatMap((h) => h.competitorIds)
  if (saved.length > 0) return saved
  const previous = roundsOfEvent(ctx, round.eventId).find((r) => r.position === round.position - 1)
  if (!previous) return activeEntryRows(ctx, round.eventId).map((e) => e.competitorId)
  return []
}

// Which rounds an event of this size needs, and how many each recalls
export function planFor(entryCount: number): Array<{ type: typeof t.rounds.$inferInsert.type; recall: number | null }> {
  const final = { type: 'final' as const, recall: null }
  const semi = { type: 'semi_final' as const, recall: 6 }
  if (entryCount <= 7) return [final]
  if (entryCount <= 14) return [semi, final]
  if (entryCount <= 24) return [{ type: 'round_1' as const, recall: 12 }, semi, final]
  return [{ type: 'round_1' as const, recall: 24 }, { type: 'round_2' as const, recall: 12 }, semi, final]
}

export function paymentDetail(ctx: Ctx, row: typeof t.payments.$inferSelect): PaymentDetail {
  const lines = ctx.db
    .select({
      entryId: t.entries.id,
      eventId: t.events.id,
      eventNumber: t.events.number,
      dances: t.events.dances,
      isSolo: t.events.isSolo,
      names: t.competitors.names,
    })
    .from(t.entries)
    .innerJoin(t.events, eq(t.events.id, t.entries.eventId))
    .innerJoin(t.competitors, eq(t.competitors.id, t.entries.competitorId))
    .where(eq(t.entries.paymentId, row.id))
    .all()
  const club = ctx.db.select().from(t.clubs).where(eq(t.clubs.id, row.clubId)).get()
  const payment: Payment = {
    id: row.id,
    clubId: row.clubId,
    entryIds: lines.map((l) => l.entryId),
    amountDue: row.amountDue,
    amountPaid: row.amountPaid,
    referenceNumber: row.referenceNumber,
    receiptUrl: row.receipt,
    status: row.status,
    rejectionReason: row.rejectionReason,
    checkedBy: row.checkedBy,
    checkedAt: row.checkedAt,
  }
  return {
    ...payment,
    clubName: club?.name ?? 'Unknown club',
    lines: lines.map((l) => ({
      entryId: l.entryId,
      eventId: l.eventId,
      eventNumber: l.eventNumber,
      dances: l.dances,
      competitorNames: l.names,
      fee: feeFor(l),
    })),
  }
}

export const pointsRows = (ctx: Ctx): PointsRow[] =>
  ctx.db
    .select()
    .from(t.pointsTable)
    .orderBy(asc(t.pointsTable.sortOrder))
    .all()
    .map((r) => ({ place: r.place, label: r.label, points: r.points }))

export const paymentCanBeChanged = (status: PaymentStatus | undefined) =>
  status === undefined || status === PaymentStatus.Unpaid || status === PaymentStatus.Rejected

const STAFF_ROLES: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Mc]
export const isStaff = (ctx: Ctx) => ctx.user !== null && STAFF_ROLES.includes(ctx.user.role)

// Events whose final has not been published yet: only staff may see their results
export function hiddenEventIds(ctx: Ctx): Set<string> {
  if (isStaff(ctx)) return new Set()
  return new Set(
    ctx.db
      .select({ eventId: t.rounds.eventId })
      .from(t.rounds)
      .where(and(eq(t.rounds.type, 'final'), inArray(t.rounds.status, ['pending', 'marking', 'review', 'approved'])))
      .all()
      .map((r) => r.eventId),
  )
}
