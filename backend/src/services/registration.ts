import {
  DEFAULT_FEE_SCHEDULE,
  EventKind,
  PayMethod,
  PaymentStatus,
  registrationFee,
  registrationWarnings,
  type Club,
  type ClubInput,
  type Coach,
  type CoachInput,
  type RegistrationInput,
  type RegistrationQuote,
  type RegistrationResult,
} from '@bis/shared'
import { and, asc, desc, eq, lt } from 'drizzle-orm'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import { record } from '../core/audit.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { readPaymentSettings } from '../paymentSettings.ts'
import { checkEligible, checkNotStarted } from './secretariat.ts'
import { applySettles, clean, getCompetitorRow, getEventRow, isStaff, toClub, toEvent } from './shared.ts'

const toCoach = (r: typeof t.coaches.$inferSelect): Coach => ({
  id: r.id,
  name: r.name,
  email: r.email,
  phone: r.phone,
  memberYear: r.memberYear,
  summitYear: r.summitYear,
})

const year = (value: unknown): number | null => (Number.isInteger(value) && (value as number) > 2000 ? (value as number) : null)

// Today in the Philippines, as YYYY-MM-DD
const today = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)

const SUFFIX = ['th', 'st', 'nd', 'rd']
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (SUFFIX[n % 10] ?? 'th')}`

// Beginners who placed in the top 3 of an event may not enter the same event at the next tournament
function medalWarnings(ctx: Ctx, competitorId: string, competition: typeof t.competitions.$inferSelect, events: Array<typeof t.events.$inferSelect>): string[] {
  const previous = ctx.db
    .select()
    .from(t.competitions)
    .where(lt(t.competitions.date, competition.date))
    .orderBy(desc(t.competitions.date))
    .limit(1)
    .get()
  if (!previous) return []
  const earlier = ctx.db.select().from(t.events).where(eq(t.events.competitionId, previous.id)).all()
  const warnings: string[] = []
  for (const event of events.filter((e) => e.kind === EventKind.Beginners)) {
    const same = earlier.filter(
      (e) =>
        e.kind === EventKind.Beginners &&
        e.ageGroup === event.ageGroup &&
        e.class === event.class &&
        e.discipline === event.discipline &&
        e.isSolo === event.isSolo &&
        JSON.stringify(e.dances) === JSON.stringify(event.dances),
    )
    for (const e of same) {
      const result = ctx.db.select().from(t.results).where(and(eq(t.results.eventId, e.id), eq(t.results.competitorId, competitorId))).get()
      if (result && result.place <= 3) {
        warnings.push(`E${event.number}: placed ${ordinal(result.place)} in this event at ${previous.name}. Beginners in the top 3 may not enter it at the next tournament.`)
      }
    }
  }
  return warnings
}

// Prices the entries of one dancer or couple, and notes what the secretariat should look at
function quote(ctx: Ctx, competitorId: string, eventIds: string[], coachFees = { membership: false, summit: false }) {
  const competitor = getCompetitorRow(ctx, competitorId)
  const ids = Array.isArray(eventIds) ? [...new Set(eventIds)] : []
  if (ids.length === 0) return fail('Choose at least one event.')
  const events = ids.map((id) => getEventRow(ctx, id))
  if (new Set(events.map((e) => e.competitionId)).size > 1) return fail('Choose events from one competition.')
  const competition = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, events[0]!.competitionId)).get(), 'Competition')
  const competitionYear = Number(competition.date.slice(0, 4))

  const details = competitor.details
  // A dancer is covered by the entry form's membership year, or by a membership paid on their own account (matched by email)
  const paidOnAccount = (email: string | undefined) =>
    Boolean(email) && ctx.db.select({ year: t.athletes.memberYear }).from(t.athletes).where(eq(t.athletes.email, email!.trim().toLowerCase())).get()?.year === competitionYear
  const newMembers =
    details?.memberYear === competitionYear ? 0 : competitor.names.filter((_, i) => !paidOnAccount(details?.dancers[i]?.email)).length
  const schedule = readPaymentSettings(ctx.sqlite).schedule ?? DEFAULT_FEE_SCHEDULE
  // Entries already made in this competition, not counting the fixed-price events
  const prior = ctx.db
    .select({ kind: t.events.kind })
    .from(t.entries)
    .innerJoin(t.events, eq(t.events.id, t.entries.eventId))
    .where(and(eq(t.entries.competitorId, competitor.id), eq(t.entries.scratched, false), eq(t.events.competitionId, competition.id)))
    .all()
    .filter((e) => e.kind !== EventKind.Ranking && e.kind !== EventKind.InterCollegiate).length

  // The coach's own fees, offered while they have not paid this year
  const coachRow = details?.coachId ? ctx.db.select().from(t.coaches).where(eq(t.coaches.id, details.coachId)).get() : undefined
  const coach = coachRow
    ? { name: coachRow.name, membershipDue: coachRow.memberYear !== competitionYear, summitDue: coachRow.summitYear !== competitionYear }
    : undefined
  const collect = {
    membership: Boolean(coach?.membershipDue && coachFees.membership),
    summit: Boolean(coach?.summitDue && coachFees.summit),
  }
  const { lines, total } = registrationFee(schedule, events.map(toEvent), newMembers, prior, collect)

  const warnings = [
    ...registrationWarnings(details ?? undefined, competitor.names.length, events.map(toEvent), competitionYear),
    ...medalWarnings(ctx, competitor.id, competition, events),
  ]
  const day = today()
  if (competition.entryDeadline && day > competition.entryDeadline) {
    warnings.push(`Entries closed on ${competition.entryDeadline}. This is a late entry.`)
  }
  if (competition.feeDeadline && day > competition.feeDeadline) {
    warnings.push(`Fees were due on ${competition.feeDeadline}. An entry still unpaid is subject to disqualification.`)
  }
  return { lines, total, warnings, ...(coach ? { coach } : {}), year: competitionYear, newMembers, collect, coachId: coachRow?.id }
}

export const registration = {
  saveClub(ctx: Ctx, input: ClubInput, id?: string): Club {
    const name = clean(input?.name)
    if (!name) return fail('Enter the club name.')
    const values = { name, contactName: clean(input.contactName), contactEmail: clean(input.contactEmail), contactPhone: clean(input.contactPhone) }
    const same = ctx.db.select().from(t.clubs).all().find((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== id)
    if (same) return fail('A club with this name already exists.', 409)
    if (id) {
      found(ctx.db.select().from(t.clubs).where(eq(t.clubs.id, id)).get(), 'Club')
      ctx.db.update(t.clubs).set(values).where(eq(t.clubs.id, id)).run()
      record(ctx.db, actor(ctx).id, 'Edited club', name)
      return toClub({ id, ...values })
    }
    const row = { id: newId(), ...values }
    ctx.db.insert(t.clubs).values(row).run()
    record(ctx.db, actor(ctx).id, 'Added club', name)
    return toClub(row)
  },

  deleteClub(ctx: Ctx, id: string): void {
    const club = found(ctx.db.select().from(t.clubs).where(eq(t.clubs.id, id)).get(), 'Club')
    if (ctx.db.select().from(t.competitors).where(eq(t.competitors.clubId, id)).get()) {
      return fail('This club has competitors. Move or delete them first.', 409)
    }
    ctx.db.delete(t.clubs).where(eq(t.clubs.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Deleted club', club.name)
  },

  // An athlete picks their coach from this list, so they get names only, not contact details or payments
  getCoaches: (ctx: Ctx): Coach[] =>
    ctx.db
      .select()
      .from(t.coaches)
      .orderBy(asc(t.coaches.name))
      .all()
      .map((c) => (isStaff(ctx) ? toCoach(c) : { id: c.id, name: c.name, email: '', phone: '', memberYear: null, summitYear: null })),

  saveCoach(ctx: Ctx, input: CoachInput, id?: string): Coach {
    const name = clean(input?.name)
    if (!name) return fail('Enter the coach’s name.')
    const values = { name, email: clean(input.email), phone: clean(input.phone), memberYear: year(input.memberYear), summitYear: year(input.summitYear) }
    if (id) {
      found(ctx.db.select().from(t.coaches).where(eq(t.coaches.id, id)).get(), 'Coach')
      ctx.db.update(t.coaches).set(values).where(eq(t.coaches.id, id)).run()
      record(ctx.db, actor(ctx).id, 'Edited coach', name)
      return toCoach({ id, ...values })
    }
    const row = { id: newId(), ...values }
    ctx.db.insert(t.coaches).values(row).run()
    record(ctx.db, actor(ctx).id, 'Added coach', name)
    return toCoach(row)
  },

  deleteCoach(ctx: Ctx, id: string): void {
    const coach = found(ctx.db.select().from(t.coaches).where(eq(t.coaches.id, id)).get(), 'Coach')
    if (ctx.db.select().from(t.competitors).all().some((c) => c.details?.coachId === id)) {
      return fail('This coach has competitors. Change their coach first.', 409)
    }
    ctx.db.delete(t.coaches).where(eq(t.coaches.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Deleted coach', coach.name)
  },

  quoteRegistration(ctx: Ctx, competitorId: string, eventIds: string[], coachFees?: { membership: boolean; summit: boolean }): RegistrationQuote {
    const { lines, total, warnings, coach } = quote(ctx, competitorId, eventIds, coachFees)
    return { lines, total, warnings, ...(coach ? { coach } : {}) }
  },

  // Enters one dancer or couple in several events at once, as on the paper entry form, with one payment
  registerCompetitor(ctx: Ctx, input: RegistrationInput): RegistrationResult {
    const competitor = getCompetitorRow(ctx, input?.competitorId)
    if (!Object.values(PayMethod).includes(input.method)) return fail('Choose how it was paid.')
    const priced = quote(ctx, competitor.id, input.eventIds, input.coachFees)
    for (const id of new Set(input.eventIds)) {
      const event = getEventRow(ctx, id)
      checkEligible(ctx, competitor.id, event)
      if (ctx.db.select().from(t.entries).where(and(eq(t.entries.eventId, id), eq(t.entries.competitorId, competitor.id))).get()) {
        return fail(`Already entered in E${event.number}.`, 409)
      }
      checkNotStarted(ctx, id)
    }

    const user = actor(ctx)
    const paid = input.method !== PayMethod.Unpaid
    const paymentId = newId()
    // What the payment settles once it is paid, now or later
    const coachSettled = priced.collect.membership || priced.collect.summit
    const settles: t.PaymentSettles | null =
      priced.newMembers > 0 || coachSettled
        ? {
            year: priced.year,
            ...(priced.newMembers > 0 ? { competitorId: competitor.id } : {}),
            ...(coachSettled ? { coachId: priced.coachId, coachMembership: priced.collect.membership, coachSummit: priced.collect.summit } : {}),
          }
        : null
    ctx.db
      .insert(t.payments)
      .values({
        id: paymentId,
        clubId: competitor.clubId,
        competitionId: getEventRow(ctx, input.eventIds[0]!).competitionId,
        late: false,
        amountDue: priced.total,
        amountPaid: paid ? priced.total : null,
        referenceNumber: paid ? clean(input.reference) || null : null,
        method: input.method,
        settles,
        status: !paid ? PaymentStatus.Unpaid : input.method === PayMethod.Cash ? PaymentStatus.PaidAtVenue : PaymentStatus.Approved,
        checkedBy: paid ? user.id : null,
        checkedAt: paid ? now() : null,
      })
      .run()
    for (const eventId of new Set(input.eventIds)) {
      ctx.db.insert(t.entries).values({ id: newId(), eventId, competitorId: competitor.id, scratched: false, paymentId, late: false }).run()
    }
    if (paid) applySettles(ctx, paymentId)
    record(ctx.db, user.id, 'Registered entries', competitor.names.join(' & '), {
      after: { events: input.eventIds.length, total: priced.total, method: input.method },
    })
    return { lines: priced.lines, total: priced.total, warnings: priced.warnings, paymentId }
  },
}
