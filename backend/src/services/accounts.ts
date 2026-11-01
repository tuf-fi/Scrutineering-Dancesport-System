import { DEFAULT_FEE_SCHEDULE, type FeeSchedule, type FeeTier, type PaymentMethod, type PaymentSettings } from '@bis/shared'
import { record } from '../core/audit.ts'
import { actor, fail, type Ctx } from '../core/context.ts'
import { readPaymentSettings, writePaymentSettings } from '../paymentSettings.ts'
import { clean } from './shared.ts'

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

const SCHEDULE_NUMBERS = ['fixed', 'athleteMembership', 'coachMembership', 'coachesSummit'] as const

// Every price in the schedule is whole pesos
function cleanSchedule(input: FeeSchedule): FeeSchedule {
  const bad = () => fail('Enter every registration fee as whole pesos.')
  const tier = (t: FeeTier | undefined): FeeTier => {
    if (!t || !wholePesos(t.first) || !wholePesos(t.additional)) return bad()
    return { first: t.first, additional: t.additional }
  }
  for (const key of SCHEDULE_NUMBERS) if (!wholePesos(input?.[key])) return bad()
  return {
    soloJuvenile: tier(input.soloJuvenile),
    soloOlder: tier(input.soloOlder),
    coupleJuvenile: tier(input.coupleJuvenile),
    coupleOlder: tier(input.coupleOlder),
    fixed: input.fixed,
    athleteMembership: input.athleteMembership,
    coachMembership: input.coachMembership,
    coachesSummit: input.coachesSummit,
  }
}
const wholePesos = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000

export const accountFunctions = {
  // The fee schedule always shows: the saved one, or the organizer's 2026 entry form
  getPaymentSettings: (ctx: Ctx): PaymentSettings => {
    const saved = readPaymentSettings(ctx.sqlite)
    return { ...saved, schedule: saved.schedule ?? DEFAULT_FEE_SCHEDULE }
  },

  savePaymentSettings(ctx: Ctx, input: PaymentSettings): PaymentSettings {
    const user = actor(ctx)
    const before = readPaymentSettings(ctx.sqlite)
    if (input?.fees && (!wholePesos(input.fees.solo) || !wholePesos(input.fees.couple))) return fail('Enter both fees as whole pesos.')
    if (!input?.fees && !input?.schedule) return fail('Enter both fees as whole pesos.')
    const fees = input.fees ? { solo: input.fees.solo, couple: input.fees.couple } : before.fees
    const schedule = input.schedule ? cleanSchedule(input.schedule) : before.schedule
    const next: PaymentSettings = { fees, methods: cleanMethods(input.methods), ...(schedule ? { schedule } : {}) }
    writePaymentSettings(ctx.sqlite, next)
    record(ctx.db, user.id, 'Changed fees and payment details', 'Payment settings', { before, after: next })
    return next
  },
}
