import {
  type FeeLine,
  unpricedEvents,
  unpricedMessage,
  PayMethod,
  PaymentStatus,
  registrationFee,
  registrationWarnings,
  type Team,
  type TeamInput,
  type Coach,
  type CoachInput,
  type RegistrationInput,
  type RegistrationQuote,
  type RegistrationResult,
} from '@bis/shared'
import { and, desc, eq, sql } from 'drizzle-orm'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import { confirmCascade, impactSummary, removeCascade } from './cascade.ts'
import { record } from '../core/audit.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { readPaymentSettings } from '../paymentSettings.ts'
import { checkEligible, checkNotStarted } from './secretariat.ts'
import { applySettles, catalogOf, feesOf, priorEntries, clean, giveCoachMembershipId, getCompetitorRow, getEventRow, isStaff, toTeam, toEvent } from './shared.ts'

const toCoach = (r: typeof t.coaches.$inferSelect): Coach => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  memberYear: r.memberYear,
  summitYear: r.summitYear,
  memberMonth: r.memberMonth,
  summitPeriod: r.summitPeriod,
  membershipId: r.membershipId ?? null,
  summits: r.summits ?? [],
})

// The dates a coach attended a Summit: valid days, each once, newest first
function summitDates(value: unknown): string[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > 50) return fail('Send the summit dates as a list.')
  const days = value.map((v) => (typeof v === 'string' ? v.trim() : ''))
  if (days.some((d) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)))) return fail('Enter each summit date as year-month-day.')
  return [...new Set(days)].sort().reverse()
}

const year = (value: unknown): number | null => (Number.isInteger(value) && (value as number) > 2000 ? (value as number) : null)
const month = (value: unknown): number | null => (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 12 ? (value as number) : null)

// Today in the Philippines, as YYYY-MM-DD
const today = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)

type Quote = ReturnType<typeof quote>

export interface Agreed {
  total: number
  warnings: string[]
  charge: t.RequestCharge
}

const agreedPrice = (agreed: Agreed) => ({ lines: [], total: agreed.total, warnings: agreed.warnings, paymentRequired: true })

export const feesByEvent = (lines: FeeLine[]): Record<string, number> => Object.fromEntries(lines.flatMap((l) => (l.eventId ? [[l.eventId, l.amount]] : [])))

// What a payment of this price settles once it is paid, now or later
export function settlesOf(priced: Quote, competitorId: string): t.PaymentSettles | null {
  const coachSettled = priced.collect.membership || priced.collect.summit
  if (priced.chargedMembers === 0 && !coachSettled) return null
  return {
    year: priced.year,
    ...(priced.chargedMembers > 0 ? { competitorId } : {}),
    ...(coachSettled ? { coachId: priced.coachId, coachMembership: priced.collect.membership, coachSummit: priced.collect.summit } : {}),
  }
}

// Memberships already charged and still waiting to be paid or confirmed, which are not charged again: on a payment that
// still has entries, or on an entry request waiting for the secretariat
function waitingCharges(ctx: Ctx): t.PaymentSettles[] {
  const billed = ctx.sqlite
    .prepare(
      `SELECT settles FROM payments p WHERE settles IS NOT NULL AND status IN ('unpaid', 'for_checking', 'rejected')
       AND EXISTS (SELECT 1 FROM entries e WHERE e.payment_id = p.id)`,
    )
    .all() as Array<{ settles: string }>
  const requested = ctx.db.select({ charge: t.entryRequests.charge }).from(t.entryRequests).where(eq(t.entryRequests.status, 'waiting')).all()
  return [...billed.map((p) => JSON.parse(p.settles) as t.PaymentSettles), ...requested.flatMap((r) => (r.charge?.settles ? [r.charge.settles] : []))]
}

// Prices the entries of one dancer or couple, and notes what the secretariat should look at
export function quote(ctx: Ctx, competitorId: string, eventIds: string[], coachFees = { membership: false, summit: false }) {
  const competitor = getCompetitorRow(ctx, competitorId)
  const ids = Array.isArray(eventIds) ? [...new Set(eventIds)] : []
  if (ids.length === 0) return fail('Choose at least one event.')
  const events = ids.map((id) => getEventRow(ctx, id))
  if (new Set(events.map((e) => e.competitionId)).size > 1) return fail('Choose events from one competition.')
  const competition = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, events[0]!.competitionId)).get(), 'Competition')
  const competitionYear = Number(competition.date.slice(0, 4))

  const details = competitor.details
  // A free competition asks for no fee, membership or payment: only the warnings about who may enter remain
  if (!competition.paymentRequired) {
    const catalog = catalogOf(ctx)
    const warnings = [...registrationWarnings(details ?? undefined, competitor.names.length, events.map(toEvent), catalog, 0)]
    const day = today()
    if (competition.entryDeadline && day > competition.entryDeadline) warnings.push(`Entries closed on ${competition.entryDeadline}. This is a late entry.`)
    return { lines: [], total: 0, warnings, year: competitionYear, chargedMembers: 0, collect: { membership: false, summit: false }, coachId: undefined, paymentRequired: false }
  }
  // A dancer is covered by the entry form's membership year, or by a membership paid on their own account (matched by email)
  const accountOf = (email: string | undefined) =>
    email ? ctx.db.select({ year: t.athletes.memberYear, request: t.athletes.request }).from(t.athletes).where(eq(t.athletes.email, email.trim().toLowerCase())).get() : undefined
  const unpaid = details?.memberYear === competitionYear ? [] : competitor.names.map((_, i) => accountOf(details?.dancers[i]?.email)).filter((a) => a?.year !== competitionYear)
  const newMembers = unpaid.length
  // Not charged again while a charge for it is waiting: here, or a payment the team already sent for the athlete
  const waiting = waitingCharges(ctx).filter((w) => w.year === competitionYear)
  const chargedMembers = waiting.some((w) => w.competitorId === competitor.id)
    ? 0
    : unpaid.filter((a) => !(a?.request && !a.request.rejectedReason && a.request.year === competitionYear)).length
  const { memberships } = readPaymentSettings(ctx.sqlite)
  const catalog = catalogOf(ctx)
  const fees = feesOf(ctx, competition.id)
  const unpriced = unpricedEvents(fees, events)
  if (unpriced.length > 0) return fail(unpricedMessage(unpriced), 409)
  const prior = priorEntries(ctx, competitor.id, competition.id, fees)

  // The coach's own fees, offered while they have not paid this year
  const coachRow = details?.coachId ? ctx.db.select().from(t.coaches).where(eq(t.coaches.id, details.coachId)).get() : undefined
  const coach = coachRow
    ? {
        name: coachRow.name,
        membershipDue: coachRow.memberYear !== competitionYear && !waiting.some((w) => w.coachId === coachRow.id && w.coachMembership),
        summitDue: coachRow.summitYear !== competitionYear && !waiting.some((w) => w.coachId === coachRow.id && w.coachSummit),
      }
    : undefined
  const collect = {
    membership: Boolean(coach?.membershipDue && coachFees.membership),
    summit: Boolean(coach?.summitDue && coachFees.summit),
  }
  const { lines, total } = registrationFee(fees, events, memberships, chargedMembers, prior, collect)

  const warnings = registrationWarnings(details ?? undefined, competitor.names.length, events.map(toEvent), catalog, newMembers)
  const day = today()
  if (competition.entryDeadline && day > competition.entryDeadline) {
    warnings.push(`Entries closed on ${competition.entryDeadline}. This is a late entry.`)
  }
  if (competition.feeDeadline && day > competition.feeDeadline) {
    warnings.push(`Fees were due on ${competition.feeDeadline}. An entry still unpaid is subject to disqualification.`)
  }
  return { lines, total, warnings, ...(coach ? { coach } : {}), year: competitionYear, chargedMembers, collect, coachId: coachRow?.id, paymentRequired: true }
}

// Enters one dancer or couple in several events at once, with one payment; a receipt is kept when it was sent online
// agreed is the price an entry request showed; without one the entry is priced now
export function enterCompetitor(ctx: Ctx, input: RegistrationInput, receipt?: string, agreed?: Agreed): RegistrationResult {
  const competitor = getCompetitorRow(ctx, input?.competitorId)
  const priced = agreed ? agreedPrice(agreed) : quote(ctx, competitor.id, input.eventIds, input.coachFees)
  if (priced.paymentRequired && !Object.values(PayMethod).includes(input.method)) return fail('Choose how it was paid.')
  for (const id of new Set(input.eventIds)) {
    const event = getEventRow(ctx, id)
    checkEligible(ctx, competitor.id, event)
    if (ctx.db.select().from(t.entries).where(and(eq(t.entries.eventId, id), eq(t.entries.competitorId, competitor.id))).get()) {
      return fail(`Already entered in E${event.number}.`, 409)
    }
    checkNotStarted(ctx, id)
  }

  const user = actor(ctx)
  if (!priced.paymentRequired) {
    for (const eventId of new Set(input.eventIds)) {
      ctx.db.insert(t.entries).values({ id: newId(), eventId, competitorId: competitor.id, scratched: false, paymentId: null, late: false }).run()
    }
    record(ctx.db, user.id, 'Registered entries', competitor.names.join(' & '), { after: { events: input.eventIds.length, payment: 'not required' } })
    return { lines: [], total: 0, warnings: priced.warnings, paymentId: '' }
  }
  const paid = input.method !== PayMethod.Unpaid
  const paymentId = newId()
  const settles = agreed ? agreed.charge.settles : settlesOf(priced as Quote, competitor.id)
  const fees = agreed ? agreed.charge.fees : feesByEvent(priced.lines)
  ctx.db
    .insert(t.payments)
    .values({
      id: paymentId,
      teamId: competitor.teamId,
      competitionId: getEventRow(ctx, input.eventIds[0]!).competitionId,
      late: false,
      amountDue: priced.total,
      amountPaid: paid ? priced.total : null,
      referenceNumber: paid ? clean(input.reference) || null : null,
      method: input.method,
      settles,
      receipt: receipt ?? null,
      status: !paid ? PaymentStatus.Unpaid : input.method === PayMethod.Cash ? PaymentStatus.PaidAtVenue : PaymentStatus.Approved,
      checkedBy: paid ? user.id : null,
      checkedAt: paid ? now() : null,
    })
    .run()
  for (const eventId of new Set(input.eventIds)) {
    ctx.db.insert(t.entries).values({ id: newId(), eventId, competitorId: competitor.id, scratched: false, paymentId, late: false, fee: fees[eventId] ?? null }).run()
  }
  if (paid) applySettles(ctx, paymentId)
  record(ctx.db, user.id, 'Registered entries', competitor.names.join(' & '), {
    after: { events: input.eventIds.length, total: priced.total, method: input.method },
  })
  return { lines: priced.lines, total: priced.total, warnings: priced.warnings, paymentId }
}

export const registration = {
  saveTeam(ctx: Ctx, input: TeamInput, id?: string): Team {
    const name = clean(input?.name)
    if (!name) return fail('Enter the team name.')
    const values = { name, contactName: clean(input.contactName), contactEmail: clean(input.contactEmail), contactPhone: clean(input.contactPhone) }
    const same = ctx.db.select().from(t.teams).all().find((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== id)
    if (same) return fail('A team with this name already exists.', 409)
    if (id) {
      found(ctx.db.select().from(t.teams).where(eq(t.teams.id, id)).get(), 'Team')
      ctx.db.update(t.teams).set(values).where(eq(t.teams.id, id)).run()
      record(ctx.db, actor(ctx).id, 'Edited team', name)
      return toTeam({ id, ...values })
    }
    const row = { id: newId(), ...values }
    ctx.db.insert(t.teams).values(row).run()
    record(ctx.db, actor(ctx).id, 'Added team', name)
    return toTeam(row)
  },

  deleteTeam(ctx: Ctx, id: string, cascade?: boolean): void {
    const row = found(ctx.db.select().from(t.teams).where(eq(t.teams.id, id)).get(), 'Team')
    const impact = confirmCascade(ctx, 'team', id, cascade)
    removeCascade(ctx, 'team', id)
    record(ctx.db, actor(ctx).id, 'Deleted team', row.name, { before: { removed: impactSummary(impact) } })
  },

  // An athlete picks their coach from this list, so they get names only, not contact details or payments
  getCoaches: (ctx: Ctx): Coach[] =>
    ctx.db
      .select()
      .from(t.coaches)
      .orderBy(desc(sql`rowid`))
      .all()
      .map((c) => (isStaff(ctx) ? toCoach(c) : { id: c.id, name: c.name, email: '', phone: '', memberYear: null, summitYear: null, membershipId: null, summits: [] })),

  saveCoach(ctx: Ctx, input: CoachInput, id?: string): Coach {
    const name = clean(input?.name)
    if (!name) return fail('Enter the coach’s name.')
    const values = { name, email: clean(input.email), phone: clean(input.phone), memberYear: year(input.memberYear), summitYear: year(input.summitYear), memberMonth: month(input.memberMonth), summitPeriod: clean(input.summitPeriod).slice(0, 60) || null, summits: summitDates(input.summits) }
    if (id) {
      found(ctx.db.select().from(t.coaches).where(eq(t.coaches.id, id)).get(), 'Coach')
      ctx.db.update(t.coaches).set(values).where(eq(t.coaches.id, id)).run()
      giveCoachMembershipId(ctx, id)
      record(ctx.db, actor(ctx).id, 'Edited coach', name)
      return toCoach(found(ctx.db.select().from(t.coaches).where(eq(t.coaches.id, id)).get(), 'Coach'))
    }
    if (ctx.db.select().from(t.coaches).all().some((c) => c.name.toLowerCase() === name.toLowerCase())) return fail('A coach with this name already exists.', 409)
    const row = { id: newId(), ...values }
    ctx.db.insert(t.coaches).values(row).run()
    giveCoachMembershipId(ctx, row.id)
    record(ctx.db, actor(ctx).id, 'Added coach', name)
    return toCoach(found(ctx.db.select().from(t.coaches).where(eq(t.coaches.id, row.id)).get(), 'Coach'))
  },

  deleteCoach(ctx: Ctx, id: string, cascade?: boolean): void {
    const row = found(ctx.db.select().from(t.coaches).where(eq(t.coaches.id, id)).get(), 'Coach')
    const impact = confirmCascade(ctx, 'coach', id, cascade)
    removeCascade(ctx, 'coach', id)
    record(ctx.db, actor(ctx).id, 'Deleted coach', row.name, { before: { removed: impactSummary(impact) } })
  },

  quoteRegistration(ctx: Ctx, competitorId: string, eventIds: string[], coachFees?: { membership: boolean; summit: boolean }): RegistrationQuote {
    const { lines, total, warnings, coach } = quote(ctx, competitorId, eventIds, coachFees)
    return { lines, total, warnings, ...(coach ? { coach } : {}) }
  },

  // Enters one dancer or couple in several events at once, as on the paper entry form, with one payment
  registerCompetitor(ctx: Ctx, input: RegistrationInput): RegistrationResult {
    return enterCompetitor(ctx, input)
  },
}
