import {
  DISCIPLINE_DANCES,
  PaymentStatus,
  parseCompetitorCsv,
  type CompetitorRow,
  type EntryRow,
  type Event,
  type EventInput,
  type ImportResult,
  type LateEntryRow,
  type PaymentDetail,
  type ScheduleItem,
} from '@bis/shared'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import { record } from '../core/audit.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import {
  clean,
  cleanNames,
  assertNotHeld,
  feeFor,
  getClubRow,
  getCompetitorRow,
  getEventRow,
  getPaymentRow,
  paymentDetail,
  roundsOfEvent,
  toCompetitor,
  toEvent,
} from './shared.ts'

const clubNames = (ctx: Ctx) => new Map(ctx.db.select().from(t.clubs).all().map((c) => [c.id, c.name]))

function entryRow(ctx: Ctx, entry: typeof t.entries.$inferSelect): EntryRow {
  const competitor = getCompetitorRow(ctx, entry.competitorId)
  const payment = entry.paymentId ? ctx.db.select().from(t.payments).where(eq(t.payments.id, entry.paymentId)).get() : undefined
  return {
    entryId: entry.id,
    competitorId: competitor.id,
    names: competitor.names,
    backNumber: competitor.backNumber,
    clubName: clubNames(ctx).get(competitor.clubId) ?? 'Unknown club',
    scratched: entry.scratched,
    late: entry.late,
    paymentStatus: payment?.status ?? null,
  }
}

function competitorRow(ctx: Ctx, c: typeof t.competitors.$inferSelect): CompetitorRow {
  const entryCount = ctx.db
    .select({ n: sql<number>`count(*)` })
    .from(t.entries)
    .where(and(eq(t.entries.competitorId, c.id), eq(t.entries.scratched, false)))
    .get()?.n
  return { ...toCompetitor(c), clubName: clubNames(ctx).get(c.clubId) ?? 'Unknown club', entryCount: entryCount ?? 0 }
}

function checkBackNumber(ctx: Ctx, competitorId: string, backNumber: number | null) {
  if (backNumber === null) return
  if (!Number.isInteger(backNumber) || backNumber < 1) return fail('A back number is a whole number from 1.')
  const owner = ctx.db.select().from(t.competitors).where(eq(t.competitors.backNumber, backNumber)).get()
  if (owner && owner.id !== competitorId) return fail(`Back number ${backNumber} is already taken by ${owner.names.join(' & ')}.`, 409)
}

function checkEligible(ctx: Ctx, competitorId: string, event: { isSolo: boolean; ageGroup: string }) {
  const competitor = getCompetitorRow(ctx, competitorId)
  if ((competitor.names.length === 1) !== event.isSolo) return fail(event.isSolo ? 'This is a solo event.' : 'This is a couple event.')
  if (competitor.ageGroup && competitor.ageGroup !== event.ageGroup) return fail('This competitor is in a different age group.')
}

// Once an event's first round has started, who is entered is decided on the floor, not here
function checkNotStarted(ctx: Ctx, eventId: string) {
  if (roundsOfEvent(ctx, eventId).some((r) => r.status !== 'pending')) {
    return fail('This event has started. Change heats on the scrutineer screens instead.', 409)
  }
}

function lateRow(ctx: Ctx, entry: typeof t.entries.$inferSelect): LateEntryRow {
  const event = getEventRow(ctx, entry.eventId)
  return {
    ...entryRow(ctx, entry),
    eventId: event.id,
    eventNumber: event.number,
    dances: event.dances,
    fee: feeFor(event),
    paymentId: entry.paymentId ?? '',
  }
}

function scheduleOf(ctx: Ctx, competitionId: string): ScheduleItem[] {
  return ctx.db
    .select()
    .from(t.events)
    .where(eq(t.events.competitionId, competitionId))
    .orderBy(asc(t.events.position))
    .all()
    .map((event, i) => ({
      eventId: event.id,
      position: i + 1,
      eventNumber: event.number,
      ageGroup: event.ageGroup,
      class: event.class,
      discipline: event.discipline,
      dances: event.dances,
      isSolo: event.isSolo,
      rounds: roundsOfEvent(ctx, event.id).map((r) => ({ type: r.type, status: r.status })),
    }))
}

function checkEvent(ctx: Ctx, competitionId: string, input: EventInput, id?: string) {
  if (!Number.isInteger(input?.number) || input.number < 1) return fail('The event number is a whole number from 1.')
  const clash = ctx.db
    .select()
    .from(t.events)
    .where(and(eq(t.events.competitionId, competitionId), eq(t.events.number, input.number)))
    .get()
  if (clash && clash.id !== id) return fail(`Event ${input.number} already exists in this competition.`, 409)
  if (!Array.isArray(input.dances) || input.dances.length === 0) return fail('Choose at least one dance.')
  const allowed = DISCIPLINE_DANCES[input.discipline]
  if (!allowed) return fail('Choose Latin or Standard.')
  if (input.dances.some((d) => !allowed.includes(d))) return fail(`These dances do not belong to ${input.discipline}.`)
}

function addCompetitor(ctx: Ctx, names: string[], clubId: string) {
  const row = { id: newId(), names, ageGroup: null, birthDate: null, backNumber: null, clubId }
  ctx.db.insert(t.competitors).values(row).run()
  return row
}

export const secretariat = {
  getCompetitionEntries: (ctx: Ctx, competitionId: string) => {
    const events = ctx.db.select({ id: t.events.id }).from(t.events).where(eq(t.events.competitionId, competitionId)).all()
    if (events.length === 0) return []
    return ctx.db
      .select()
      .from(t.entries)
      .where(inArray(t.entries.eventId, events.map((e) => e.id)))
      .all()
      .map((e) => ({ id: e.id, eventId: e.eventId, competitorId: e.competitorId, scratched: e.scratched, paymentId: e.paymentId, late: e.late }))
  },

  getEntryRows: (ctx: Ctx, eventId: string): EntryRow[] =>
    ctx.db
      .select()
      .from(t.entries)
      .where(eq(t.entries.eventId, eventId))
      .all()
      .map((e) => entryRow(ctx, e))
      .sort((a, b) => (a.backNumber ?? Infinity) - (b.backNumber ?? Infinity)),

  setEntryScratched(ctx: Ctx, entryId: string, scratched: boolean): EntryRow {
    const entry = found(ctx.db.select().from(t.entries).where(eq(t.entries.id, entryId)).get(), 'Entry')
    const event = getEventRow(ctx, entry.eventId)
    assertNotHeld(ctx, event.competitionId)
    checkNotStarted(ctx, event.id)
    ctx.db.update(t.entries).set({ scratched: Boolean(scratched) }).where(eq(t.entries.id, entryId)).run()
    const row = entryRow(ctx, { ...entry, scratched: Boolean(scratched) })
    record(ctx.db, actor(ctx).id, scratched ? 'Scratched entry' : 'Restored entry', `Event ${event.number}, ${row.names.join(' & ')}`, {
      before: { scratched: entry.scratched },
      after: { scratched: Boolean(scratched) },
    })
    return row
  },

  getCompetitorRows: (ctx: Ctx): CompetitorRow[] =>
    ctx.db.select().from(t.competitors).all().map((c) => competitorRow(ctx, c)),

  createCompetitor(ctx: Ctx, input: { names: string[]; clubId: string }): CompetitorRow {
    const names = cleanNames(input?.names)
    getClubRow(ctx, input.clubId)
    const row = addCompetitor(ctx, names, input.clubId)
    record(ctx.db, actor(ctx).id, 'Added competitor', names.join(' & '))
    return competitorRow(ctx, row)
  },

  setBackNumber(ctx: Ctx, competitorId: string, backNumber: number | null): CompetitorRow {
    const competitor = getCompetitorRow(ctx, competitorId)
    checkBackNumber(ctx, competitorId, backNumber)
    ctx.db.update(t.competitors).set({ backNumber }).where(eq(t.competitors.id, competitorId)).run()
    record(ctx.db, actor(ctx).id, 'Set back number', competitor.names.join(' & '), {
      before: { backNumber: competitor.backNumber },
      after: { backNumber },
    })
    return competitorRow(ctx, { ...competitor, backNumber })
  },

  // Gives every competitor without a back number the next free one
  assignBackNumbers(ctx: Ctx): number {
    const all = ctx.db.select().from(t.competitors).orderBy(asc(t.competitors.clubId), sql`${t.competitors.names} asc`).all()
    const taken = new Set(all.map((c) => c.backNumber).filter((n): n is number => n !== null))
    let next = 1
    let assigned = 0
    for (const c of all) {
      if (c.backNumber !== null) continue
      while (taken.has(next)) next++
      ctx.db.update(t.competitors).set({ backNumber: next }).where(eq(t.competitors.id, c.id)).run()
      taken.add(next)
      assigned++
    }
    record(ctx.db, actor(ctx).id, 'Assigned back numbers', `${assigned} competitors`)
    return assigned
  },

  importCompetitors(ctx: Ctx, rows: Array<{ names: string[]; clubName: string }>): ImportResult {
    const result: ImportResult = { created: 0, skipped: [] }
    const clubs = ctx.db.select().from(t.clubs).all()
    ;(Array.isArray(rows) ? rows : []).forEach((row, i) => {
      const line = i + 2
      const club = clubs.find((c) => c.name.toLowerCase() === clean(row?.clubName).toLowerCase())
      if (!club) return void result.skipped.push({ line, reason: `Unknown club "${clean(row?.clubName)}".` })
      let names: string[]
      try {
        names = cleanNames(row.names)
      } catch (error) {
        return void result.skipped.push({ line, reason: (error as Error).message })
      }
      addCompetitor(ctx, names, club.id)
      result.created++
    })
    record(ctx.db, actor(ctx).id, 'Imported competitors', `${result.created} added, ${result.skipped.length} skipped`)
    return result
  },

  // The server reads the uploaded file itself, so quoted fields with commas come through intact
  importCompetitorsCsv(ctx: Ctx, text: string): ImportResult {
    if (typeof text !== 'string' || text.trim() === '') return fail('The file is empty.')
    return secretariat.importCompetitors(ctx, parseCompetitorCsv(text))
  },

  getLateEntries: (ctx: Ctx, competitionId: string): LateEntryRow[] => {
    const events = ctx.db.select({ id: t.events.id }).from(t.events).where(eq(t.events.competitionId, competitionId)).all()
    if (events.length === 0) return []
    return ctx.db
      .select()
      .from(t.entries)
      .where(and(eq(t.entries.late, true), inArray(t.entries.eventId, events.map((e) => e.id))))
      .all()
      .map((e) => lateRow(ctx, e))
  },

  // A late entry gets its own payment, either paid in cash now or left unpaid
  createLateEntry(ctx: Ctx, input: { competitorId: string; eventId: string; paidInCash: boolean }): LateEntryRow {
    const event = getEventRow(ctx, input?.eventId)
    assertNotHeld(ctx, event.competitionId)
    const competitor = getCompetitorRow(ctx, input.competitorId)
    checkEligible(ctx, competitor.id, event)
    if (ctx.db.select().from(t.entries).where(and(eq(t.entries.eventId, event.id), eq(t.entries.competitorId, competitor.id))).get()) {
      return fail('This competitor is already entered in the event.', 409)
    }
    checkNotStarted(ctx, event.id)
    const user = actor(ctx)
    const fee = feeFor(event)
    const paid = Boolean(input.paidInCash)
    const paymentId = newId()
    ctx.db
      .insert(t.payments)
      .values({
        id: paymentId,
        clubId: competitor.clubId,
        competitionId: event.competitionId,
        late: true,
        amountDue: fee,
        amountPaid: paid ? fee : null,
        status: paid ? PaymentStatus.PaidAtVenue : PaymentStatus.Unpaid,
        checkedBy: paid ? user.id : null,
        checkedAt: paid ? now() : null,
      })
      .run()
    const entry = { id: newId(), eventId: event.id, competitorId: competitor.id, scratched: false, paymentId, late: true }
    ctx.db.insert(t.entries).values(entry).run()
    record(ctx.db, user.id, 'Added late entry', `Event ${event.number}, ${competitor.names.join(' & ')}`, { after: { paidInCash: paid } })
    return lateRow(ctx, entry)
  },

  markPaidAtVenue(ctx: Ctx, paymentId: string): PaymentDetail {
    const payment = getPaymentRow(ctx, paymentId)
    if (payment.status !== PaymentStatus.Unpaid && payment.status !== PaymentStatus.Rejected) {
      return fail('Only unpaid or rejected payments can be paid at the venue.', 409)
    }
    ctx.db
      .update(t.payments)
      .set({ status: PaymentStatus.PaidAtVenue, amountPaid: payment.amountDue, rejectionReason: null, checkedBy: actor(ctx).id, checkedAt: now() })
      .where(eq(t.payments.id, paymentId))
      .run()
    const detail = paymentDetail(ctx, getPaymentRow(ctx, paymentId))
    record(ctx.db, actor(ctx).id, 'Recorded cash payment', detail.clubName, { before: { status: payment.status }, after: { status: PaymentStatus.PaidAtVenue } })
    return detail
  },

  getSchedule: (ctx: Ctx, competitionId: string) => scheduleOf(ctx, competitionId),

  moveScheduledEvent(ctx: Ctx, competitionId: string, eventId: string, direction: 'up' | 'down'): ScheduleItem[] {
    assertNotHeld(ctx, competitionId)
    const order = ctx.db.select().from(t.events).where(eq(t.events.competitionId, competitionId)).orderBy(asc(t.events.position)).all()
    const from = order.findIndex((e) => e.id === eventId)
    const to = direction === 'up' ? from - 1 : from + 1
    if (from < 0 || to < 0 || to >= order.length) return fail('That event cannot move further.')
    const a = order[from]!
    const b = order[to]!
    ctx.db.update(t.events).set({ position: b.position }).where(eq(t.events.id, a.id)).run()
    ctx.db.update(t.events).set({ position: a.position }).where(eq(t.events.id, b.id)).run()
    record(ctx.db, actor(ctx).id, 'Moved event in schedule', `Event ${a.number}`, { before: { position: a.position }, after: { position: b.position } })
    return scheduleOf(ctx, competitionId)
  },

  updateCompetitor(ctx: Ctx, id: string, input: { names: string[]; clubId: string }): CompetitorRow {
    const competitor = getCompetitorRow(ctx, id)
    const names = cleanNames(input?.names)
    getClubRow(ctx, input.clubId)
    const hasEntries = ctx.db.select().from(t.entries).where(eq(t.entries.competitorId, id)).get()
    if ((names.length === 1) !== (competitor.names.length === 1) && hasEntries) {
      return fail('Remove their entries before changing between a solo dancer and a couple.', 409)
    }
    ctx.db.update(t.competitors).set({ names, clubId: input.clubId }).where(eq(t.competitors.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Edited competitor', names.join(' & '), { before: { names: competitor.names, clubId: competitor.clubId }, after: { names, clubId: input.clubId } })
    return competitorRow(ctx, { ...competitor, names, clubId: input.clubId })
  },

  deleteCompetitor(ctx: Ctx, id: string): void {
    const competitor = getCompetitorRow(ctx, id)
    if (ctx.db.select().from(t.entries).where(eq(t.entries.competitorId, id)).get()) {
      return fail('This competitor has entries. Remove or scratch them first.', 409)
    }
    ctx.db.delete(t.competitors).where(eq(t.competitors.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Deleted competitor', competitor.names.join(' & '))
  },

  deleteLateEntry(ctx: Ctx, entryId: string): void {
    const entry = lateEntry(ctx, entryId)
    const event = getEventRow(ctx, entry.eventId)
    assertNotHeld(ctx, event.competitionId)
    checkNotStarted(ctx, event.id)
    const names = entryRow(ctx, entry).names.join(' & ')
    ctx.db.delete(t.entries).where(eq(t.entries.id, entryId)).run()
    if (entry.paymentId) ctx.db.delete(t.payments).where(eq(t.payments.id, entry.paymentId)).run()
    record(ctx.db, actor(ctx).id, 'Removed late entry', `Event ${event.number}, ${names}`)
  },

  // Fixes a wrong event or payment on a late entry; the competitor stays the same
  updateLateEntry(ctx: Ctx, entryId: string, input: { eventId: string; paidInCash: boolean }): LateEntryRow {
    const entry = lateEntry(ctx, entryId)
    const event = getEventRow(ctx, input?.eventId)
    assertNotHeld(ctx, event.competitionId)
    checkNotStarted(ctx, entry.eventId)
    if (event.id !== entry.eventId) {
      checkEligible(ctx, entry.competitorId, event)
      checkNotStarted(ctx, event.id)
      if (ctx.db.select().from(t.entries).where(and(eq(t.entries.eventId, event.id), eq(t.entries.competitorId, entry.competitorId))).get()) {
        return fail('This competitor is already entered in the event.', 409)
      }
    }
    const payment = getPaymentRow(ctx, entry.paymentId ?? '')
    const fee = feeFor(event)
    const paid = Boolean(input.paidInCash)
    ctx.db.update(t.entries).set({ eventId: event.id }).where(eq(t.entries.id, entryId)).run()
    ctx.db
      .update(t.payments)
      .set({
        amountDue: fee,
        amountPaid: paid ? fee : null,
        status: paid ? PaymentStatus.PaidAtVenue : PaymentStatus.Unpaid,
        checkedBy: paid ? actor(ctx).id : null,
        checkedAt: paid ? now() : null,
      })
      .where(eq(t.payments.id, payment.id))
      .run()
    const updated = { ...entry, eventId: event.id }
    record(ctx.db, actor(ctx).id, 'Edited late entry', `Event ${event.number}, ${entryRow(ctx, updated).names.join(' & ')}`, {
      before: { eventId: entry.eventId, status: payment.status },
      after: { eventId: event.id, paidInCash: paid },
    })
    return lateRow(ctx, updated)
  },

  saveEvent(ctx: Ctx, competitionId: string, input: EventInput, id?: string): Event {
    assertNotHeld(ctx, competitionId)
    found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, competitionId)).get(), 'Competition')
    checkEvent(ctx, competitionId, input, id)
    const values = {
      number: input.number,
      ageGroup: input.ageGroup,
      class: input.class,
      discipline: input.discipline,
      dances: input.dances,
      isSolo: Boolean(input.isSolo),
    }
    if (id) {
      const event = getEventRow(ctx, id)
      if (event.isSolo !== values.isSolo && ctx.db.select().from(t.entries).where(eq(t.entries.eventId, id)).get()) {
        return fail('Remove the entries before changing between solo and couple.', 409)
      }
      checkNotStarted(ctx, id)
      ctx.db.update(t.events).set(values).where(eq(t.events.id, id)).run()
      record(ctx.db, actor(ctx).id, 'Edited event', `Event ${event.number}`, { before: toEvent(event), after: values })
      return toEvent({ ...event, ...values })
    }
    const last = ctx.db.select({ p: sql<number>`coalesce(max(${t.events.position}), 0)` }).from(t.events).where(eq(t.events.competitionId, competitionId)).get()
    const row = { id: newId(), competitionId, position: (last?.p ?? 0) + 1, ...values }
    ctx.db.insert(t.events).values(row).run()
    record(ctx.db, actor(ctx).id, 'Created event', `Event ${row.number}`, { after: values })
    return toEvent(row)
  },

  deleteEvent(ctx: Ctx, id: string): void {
    const event = getEventRow(ctx, id)
    assertNotHeld(ctx, event.competitionId)
    if (ctx.db.select().from(t.entries).where(eq(t.entries.eventId, id)).get() || roundsOfEvent(ctx, id).length > 0) {
      return fail('This event has entries or rounds. Remove them first.', 409)
    }
    ctx.db.delete(t.events).where(eq(t.events.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Deleted event', `Event ${event.number}`)
  },
}

function lateEntry(ctx: Ctx, entryId: string) {
  const entry = found(ctx.db.select().from(t.entries).where(eq(t.entries.id, entryId)).get(), 'Entry')
  if (!entry.late) return fail('Only late entries can be changed here.', 409)
  return entry
}
