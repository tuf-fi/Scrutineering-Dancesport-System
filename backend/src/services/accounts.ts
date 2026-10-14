import type { MessengerLink, PaymentMethod, PaymentSettings } from '@bis/shared'
import { eq } from 'drizzle-orm'
import { hashPassword, temporaryPassword, verifyPassword } from '../auth/password.ts'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { linkUrl, messengerEnabled } from '../messenger.ts'
import { readPaymentSettings, writePaymentSettings } from '../paymentSettings.ts'
import { clean } from './shared.ts'

// Payment proof screenshots are kept for this long after the competition, then removed
export const RECEIPT_KEEP_DAYS = 90
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

const wholePesos = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000

export const accountFunctions = {
  getPaymentSettings: (ctx: Ctx): PaymentSettings => readPaymentSettings(ctx.sqlite),

  savePaymentSettings(ctx: Ctx, input: PaymentSettings): PaymentSettings {
    const user = actor(ctx)
    if (!input?.fees || !wholePesos(input.fees.solo) || !wholePesos(input.fees.couple)) return fail('Enter both fees as whole pesos.')
    const before = readPaymentSettings(ctx.sqlite)
    const next: PaymentSettings = { fees: { solo: input.fees.solo, couple: input.fees.couple }, methods: cleanMethods(input.methods) }
    writePaymentSettings(ctx.sqlite, next)
    record(ctx.db, user.id, 'Changed fees and payment details', 'Payment settings', { before, after: next })
    return next
  },

  getMessengerLink(ctx: Ctx): MessengerLink {
    const club = found(ctx.db.select().from(t.clubs).where(eq(t.clubs.id, actor(ctx).id)).get(), 'Club')
    const available = messengerEnabled(ctx.config)
    return { available, linked: Boolean(club.messengerId), url: available && !club.messengerId ? linkUrl(ctx.config, club.id) : null }
  },

  unlinkMessenger(ctx: Ctx): void {
    const user = actor(ctx)
    ctx.db.update(t.clubs).set({ messengerId: null }).where(eq(t.clubs.id, user.id)).run()
    record(ctx.db, user.id, 'Club unlinked Messenger', user.name)
  },

  // A club changes its own password
  changeClubPassword(ctx: Ctx, current: string, next: string): void {
    const user = actor(ctx)
    const club = found(ctx.db.select().from(t.clubs).where(eq(t.clubs.id, user.id)).get(), 'Club')
    if (!verifyPassword(String(current ?? ''), club.passwordHash)) return fail('The current password is not right.', 403)
    if (String(next ?? '').length < 8) return fail('Use a password of at least 8 characters.')
    ctx.db.update(t.clubs).set({ passwordHash: hashPassword(String(next)) }).where(eq(t.clubs.id, club.id)).run()
    record(ctx.db, user.id, 'Club changed its password', club.name)
  },

  // The club forgot its password: the admin gives a temporary one, to be passed on outside BIS
  resetClubPassword(ctx: Ctx, id: string): { tempPassword: string } {
    const club = found(ctx.db.select().from(t.clubs).where(eq(t.clubs.id, String(id))).get(), 'Club')
    const tempPassword = temporaryPassword()
    ctx.db.update(t.clubs).set({ passwordHash: hashPassword(tempPassword) }).where(eq(t.clubs.id, club.id)).run()
    record(ctx.db, actor(ctx).id, 'Reset a club password', club.name)
    return { tempPassword }
  },

  // A club asks to be forgotten: its contact person, email, phone, login and payment proofs go. Its name and its dancers
  // stay, because published results and rankings refer to them.
  eraseClubAccount(ctx: Ctx, id: string): void {
    const club = found(ctx.db.select().from(t.clubs).where(eq(t.clubs.id, String(id))).get(), 'Club')
    const waiting = ctx.db.select().from(t.payments).where(eq(t.payments.clubId, club.id)).all().some((p) => p.status === 'for_checking')
    if (waiting) return fail('This club has a payment waiting to be checked. Decide it first.', 409)
    ctx.db
      .update(t.clubs)
      .set({ contactName: 'Removed', contactEmail: `removed-${club.id}@removed.invalid`, contactPhone: '', passwordHash: null, consentAt: null, messengerId: null })
      .where(eq(t.clubs.id, club.id))
      .run()
    ctx.db.update(t.payments).set({ receipt: null }).where(eq(t.payments.clubId, club.id)).run()
    record(ctx.db, actor(ctx).id, 'Erased a club account', club.name)
  },

  // Removes payment proofs of competitions that ended more than RECEIPT_KEEP_DAYS ago; returns how many
  clearOldReceipts(ctx: Ctx): number {
    return removeOldReceipts(ctx, actor(ctx).id)
  },
}

export function removeOldReceipts(ctx: Pick<Ctx, 'db' | 'sqlite'>, who: string): number {
  const cutoff = new Date(Date.now() - RECEIPT_KEEP_DAYS * 86_400_000).toISOString().slice(0, 10)
  const info = ctx.sqlite
    .prepare('UPDATE payments SET receipt = NULL WHERE receipt IS NOT NULL AND competition_id IN (SELECT id FROM competitions WHERE date < ?)')
    .run(cutoff)
  if (info.changes > 0) record(ctx.db, who, 'Removed old payment proofs', `${info.changes} proofs`, { after: { cutoff } })
  return info.changes
}
