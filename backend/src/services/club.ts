import {
  PaymentStatus,
  Role,
  type AgeGroup,
  type ClubDancer,
  type EntryOption,
  type PaymentDetail,
  type PaymentMethod,
} from '@bis/shared'
import { and, asc, eq } from 'drizzle-orm'
import { fail, found, type Ctx } from '../core/context.ts'
import { record } from '../core/audit.ts'
import * as t from '../db/schema.ts'
import { newId } from '../ids.ts'
import { readPaymentSettings } from '../paymentSettings.ts'
import { assertFeesSet, assertNotHeld, clean, cleanNames, currentCompetition, feeFor, paymentCanBeChanged, paymentDetail, roundsOfEvent } from './shared.ts'

const MAX_RECEIPT_BYTES = 4_000_000

function clubId(ctx: Ctx): string {
  if (ctx.user?.role !== Role.Club) return fail('Sign in as a club.', 403)
  return ctx.user.id
}

function ownDancer(ctx: Ctx, club: string, dancerId: string) {
  const dancer = found(ctx.db.select().from(t.competitors).where(eq(t.competitors.id, String(dancerId))).get(), 'Dancer')
  if (dancer.clubId !== club) return fail('That dancer is not in your club.', 403)
  return dancer
}

const activeEntries = (ctx: Ctx, competitorId: string) =>
  ctx.db.select().from(t.entries).where(and(eq(t.entries.competitorId, competitorId), eq(t.entries.scratched, false))).all()

const view = (ctx: Ctx, c: typeof t.competitors.$inferSelect): ClubDancer => ({
  id: c.id,
  names: c.names,
  ageGroup: c.ageGroup,
  entryCount: activeEntries(ctx, c.id).length,
})

// The club's main payment for the current competition covers every entry made through the portal
function mainPayment(ctx: Ctx, club: string) {
  const competition = currentCompetition(ctx)
  if (!competition) return undefined
  return ctx.db
    .select()
    .from(t.payments)
    .where(and(eq(t.payments.clubId, club), eq(t.payments.competitionId, competition.id), eq(t.payments.late, false)))
    .get()
}

function entryOptionsFor(ctx: Ctx, club: string, dancerId: string): EntryOption[] {
  const dancer = ownDancer(ctx, club, dancerId)
  const competition = currentCompetition(ctx)
  if (!competition) return []
  const solo = dancer.names.length === 1
  return ctx.db
    .select()
    .from(t.events)
    .where(and(eq(t.events.competitionId, competition.id), eq(t.events.isSolo, solo)))
    .orderBy(asc(t.events.number))
    .all()
    .filter((e) => !dancer.ageGroup || e.ageGroup === dancer.ageGroup)
    .map((e) => {
      const entry = ctx.db
        .select()
        .from(t.entries)
        .where(and(eq(t.entries.eventId, e.id), eq(t.entries.competitorId, dancerId), eq(t.entries.scratched, false)))
        .get()
      const payment = entry?.paymentId ? ctx.db.select().from(t.payments).where(eq(t.payments.id, entry.paymentId)).get() : undefined
      return {
        eventId: e.id,
        eventNumber: e.number,
        dances: e.dances,
        ageGroup: e.ageGroup,
        class: e.class,
        discipline: e.discipline,
        fee: feeFor(ctx, e),
        entered: Boolean(entry),
        locked: Boolean(entry) && !paymentCanBeChanged(payment?.status),
      }
    })
}

function recomputeDue(ctx: Ctx, paymentId: string) {
  const rows = ctx.db
    .select({ isSolo: t.events.isSolo })
    .from(t.entries)
    .innerJoin(t.events, eq(t.events.id, t.entries.eventId))
    .where(and(eq(t.entries.paymentId, paymentId), eq(t.entries.scratched, false)))
    .all()
  ctx.db.update(t.payments).set({ amountDue: rows.reduce((sum, e) => sum + feeFor(ctx, e), 0) }).where(eq(t.payments.id, paymentId)).run()
}

export const club = {
  getClubDancers: (ctx: Ctx): ClubDancer[] =>
    ctx.db.select().from(t.competitors).where(eq(t.competitors.clubId, clubId(ctx))).all().map((c) => view(ctx, c)),

  saveClubDancer(ctx: Ctx, input: { names: string[]; ageGroup: AgeGroup }, id?: string): ClubDancer {
    const owner = clubId(ctx)
    const names = cleanNames(input?.names, 'dancer')
    if (id) {
      const dancer = ownDancer(ctx, owner, id)
      if (names.length !== dancer.names.length && activeEntries(ctx, id).length > 0) {
        return fail('Withdraw their entries before changing between a solo dancer and a couple.', 409)
      }
      ctx.db.update(t.competitors).set({ names, ageGroup: input.ageGroup }).where(eq(t.competitors.id, id)).run()
      record(ctx.db, owner, 'Edited dancer', names.join(' & '))
      return view(ctx, { ...dancer, names, ageGroup: input.ageGroup })
    }
    const row = { id: newId(), names, ageGroup: input.ageGroup, birthDate: null, backNumber: null, clubId: owner }
    ctx.db.insert(t.competitors).values(row).run()
    record(ctx.db, owner, 'Added dancer', names.join(' & '))
    return view(ctx, row)
  },

  deleteClubDancer(ctx: Ctx, id: string): void {
    const owner = clubId(ctx)
    const dancer = ownDancer(ctx, owner, id)
    if (ctx.db.select().from(t.entries).where(eq(t.entries.competitorId, id)).get()) {
      return fail('This dancer has entries. Withdraw them first.', 409)
    }
    ctx.db.delete(t.competitors).where(eq(t.competitors.id, id)).run()
    record(ctx.db, owner, 'Deleted dancer', dancer.names.join(' & '))
  },

  getEntryOptions: (ctx: Ctx, dancerId: string): EntryOption[] => entryOptionsFor(ctx, clubId(ctx), dancerId),

  registerClubEntries(ctx: Ctx, dancerId: string, eventIds: string[]): void {
    const owner = clubId(ctx)
    assertNotHeld(ctx, currentCompetition(ctx)?.id)
    assertFeesSet(ctx)
    ownDancer(ctx, owner, dancerId)
    const options = entryOptionsFor(ctx, owner, dancerId)
    const wanted = new Set(Array.isArray(eventIds) ? eventIds : [])
    if ([...wanted].some((id) => !options.some((o) => o.eventId === id))) return fail('One of those events is not open to this dancer.')
    const adding = options.filter((o) => wanted.has(o.eventId) && !o.entered)
    const removing = options.filter((o) => !wanted.has(o.eventId) && o.entered)
    if (removing.some((o) => o.locked)) return fail('An entry that is already paid cannot be withdrawn here. Ask the secretariat.', 409)
    for (const o of [...adding, ...removing]) {
      if (roundsOfEvent(ctx, o.eventId).some((r) => r.status !== 'pending')) return fail(`Event ${o.eventNumber} has started, so its entries are closed.`, 409)
    }

    let payment = mainPayment(ctx, owner)
    if (adding.length > 0 && payment && !paymentCanBeChanged(payment.status)) {
      return fail('Your payment is already with the secretariat. Ask them to add late entries.', 409)
    }
    if (adding.length > 0 && !payment) {
      const competition = found(currentCompetition(ctx), 'Competition')
      payment = { id: newId(), clubId: owner, competitionId: competition.id, late: false, amountDue: 0, amountPaid: null, referenceNumber: null, receipt: null, status: PaymentStatus.Unpaid, rejectionReason: null, checkedBy: null, checkedAt: null }
      ctx.db.insert(t.payments).values(payment).run()
    }

    for (const o of removing) {
      ctx.db.delete(t.entries).where(and(eq(t.entries.eventId, o.eventId), eq(t.entries.competitorId, dancerId))).run()
    }
    for (const o of adding) {
      const old = ctx.db.select().from(t.entries).where(and(eq(t.entries.eventId, o.eventId), eq(t.entries.competitorId, dancerId))).get()
      if (old) ctx.db.update(t.entries).set({ scratched: false, paymentId: payment!.id }).where(eq(t.entries.id, old.id)).run()
      else ctx.db.insert(t.entries).values({ id: newId(), eventId: o.eventId, competitorId: dancerId, scratched: false, paymentId: payment!.id, late: false }).run()
    }
    if (payment) recomputeDue(ctx, payment.id)
    record(ctx.db, owner, 'Changed entries', ownDancer(ctx, owner, dancerId).names.join(' & '), { after: { added: adding.length, removed: removing.length } })
  },

  getClubPayments(ctx: Ctx): PaymentDetail[] {
    const owner = clubId(ctx)
    return ctx.db.select().from(t.payments).where(eq(t.payments.clubId, owner)).all().map((p) => paymentDetail(ctx, p))
  },

  getPaymentMethods: (ctx: Ctx): PaymentMethod[] => readPaymentSettings(ctx.sqlite).methods,

  submitClubPayment(ctx: Ctx, input: { amountPaid: number; referenceNumber: string; receiptUrl: string }): void {
    const owner = clubId(ctx)
    const payment = found(mainPayment(ctx, owner), 'Payment')
    assertNotHeld(ctx, payment.competitionId)
    if (!paymentCanBeChanged(payment.status)) return fail('Your payment has already been sent for checking.', 409)
    if (payment.amountDue <= 0) return fail('Register dancers to events before paying.')
    if (!Number.isFinite(input?.amountPaid) || input.amountPaid <= 0) return fail('Enter the amount you sent.')
    const reference = clean(input.referenceNumber)
    if (!reference) return fail('Enter the reference number from your receipt.')
    if (typeof input.receiptUrl !== 'string' || !input.receiptUrl.startsWith('data:image/')) return fail('Upload a screenshot of your receipt.')
    if (input.receiptUrl.length > MAX_RECEIPT_BYTES) return fail('That screenshot is too large. Use one under 3 MB.')
    ctx.db
      .update(t.payments)
      .set({ amountPaid: input.amountPaid, referenceNumber: reference, receipt: input.receiptUrl, status: PaymentStatus.ForChecking, rejectionReason: null })
      .where(eq(t.payments.id, payment.id))
      .run()
    record(ctx.db, owner, 'Sent payment for checking', payment.id, { after: { amountPaid: input.amountPaid, referenceNumber: reference } })
  },
}
