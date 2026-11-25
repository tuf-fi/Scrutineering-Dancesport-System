import { checkFee, isPesoAmount, type FeeItem, type FeeItemInput, type MembershipFees, type PaymentMethod, type PaymentSettings } from '@bis/shared'
import { eq, sql } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { newId } from '../ids.ts'
import { readPaymentSettings, writePaymentSettings } from '../paymentSettings.ts'
import { clean, feesOf } from './shared.ts'

const MAX_METHODS = 8

function cleanMethods(input: unknown): PaymentMethod[] {
  const list = Array.isArray(input) ? input : []
  if (list.length > MAX_METHODS) return fail(`Add at most ${MAX_METHODS} ways to pay.`)
  return list.map((m: Partial<PaymentMethod>) => {
    const method = { name: clean(m?.name), accountName: clean(m?.accountName), number: clean(m?.number), note: clean(m?.note) }
    if (!method.name || !method.accountName || !method.number) return fail('Each way to pay needs a name, an account name and a number.')
    return method.note ? method : { name: method.name, accountName: method.accountName, number: method.number }
  })
}

function cleanMemberships(input: MembershipFees | undefined): MembershipFees {
  if (!input || ![input.athlete, input.coach, input.summit].every(isPesoAmount)) return fail('Enter every membership fee as whole pesos.')
  return { athlete: input.athlete, coach: input.coach, summit: input.summit }
}

// Puts the events named on this fee, and takes it off every other event it priced
function assignEvents(ctx: Ctx, competitionId: string, feeId: string, eventIds: string[]) {
  const events = ctx.db.select().from(t.events).where(eq(t.events.competitionId, competitionId)).all()
  const wanted = new Set(eventIds)
  if ([...wanted].some((id) => !events.some((e) => e.id === id))) return fail('Choose events of this competition.')
  for (const e of events) {
    if (wanted.has(e.id) === (e.feeId === feeId)) continue
    ctx.db.update(t.events).set({ feeId: wanted.has(e.id) ? feeId : null }).where(eq(t.events.id, e.id)).run()
  }
}

const getCompetition = (ctx: Ctx, id: string) => found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, id)).get(), 'Competition')

export const accountFunctions = {
  getCompetitionFees: (ctx: Ctx, competitionId: string): FeeItem[] => feesOf(ctx, getCompetition(ctx, competitionId).id),

  // A change of price applies to entries made from now on; what was already charged stays
  saveCompetitionFee(ctx: Ctx, competitionId: string, input: FeeItemInput, id?: string): FeeItem {
    const competition = getCompetition(ctx, competitionId)
    const fees = feesOf(ctx, competition.id)
    const before = id ? found(fees.find((f) => f.id === id), 'Fee') : undefined
    const checked = checkFee(input, fees.filter((f) => f.id !== id))
    if ('error' in checked) return fail(checked.error, checked.status)
    const fee: FeeItem = { id: before?.id ?? newId(), competitionId: competition.id, ...checked.values }
    if (before) ctx.db.update(t.competitionFees).set(checked.values).where(eq(t.competitionFees.id, fee.id)).run()
    else {
      const last = ctx.db.select({ n: sql<number>`coalesce(max(${t.competitionFees.sortOrder}), 0)` }).from(t.competitionFees).where(eq(t.competitionFees.competitionId, competition.id)).get()
      ctx.db.insert(t.competitionFees).values({ ...fee, sortOrder: (last?.n ?? 0) + 1 }).run()
    }
    assignEvents(ctx, competition.id, fee.id, input.eventIds)
    record(ctx.db, actor(ctx).id, before ? 'Edited fee' : 'Added fee', `${fee.name}, ${competition.name}`, { before, after: fee })
    return fee
  },

  // Its events are left without a fee, so they cannot be entered until another is set
  deleteCompetitionFee(ctx: Ctx, id: string): { id: string } {
    const row = found(ctx.db.select().from(t.competitionFees).where(eq(t.competitionFees.id, id)).get(), 'Fee')
    const competition = getCompetition(ctx, row.competitionId)
    ctx.db.delete(t.competitionFees).where(eq(t.competitionFees.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Deleted fee', `${row.name}, ${competition.name}`, { before: row })
    return { id }
  },

  getPaymentSettings: (ctx: Ctx): PaymentSettings => readPaymentSettings(ctx.sqlite),

  savePaymentSettings(ctx: Ctx, input: PaymentSettings): PaymentSettings {
    const user = actor(ctx)
    const before = readPaymentSettings(ctx.sqlite)
    const next: PaymentSettings = { memberships: cleanMemberships(input?.memberships), methods: cleanMethods(input.methods) }
    writePaymentSettings(ctx.sqlite, next)
    record(ctx.db, user.id, 'Changed fees and payment details', 'Payment settings', { before, after: next })
    return next
  },
}
