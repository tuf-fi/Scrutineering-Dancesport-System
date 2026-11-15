import type { SheetSignatures, SheetSigner } from '@bis/shared'
import { and, asc, eq } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { MAX_SIGNATURE, PNG_PREFIX } from './shared.ts'

const mine = (ctx: Ctx) => found(ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, actor(ctx).id)).get(), 'Account')

const signer = (row: Pick<typeof t.staffUsers.$inferSelect, 'name' | 'signature'> | undefined): SheetSigner | null =>
  row ? { name: row.name, signature: row.signature ?? null } : null

// A staff member keeps one signature on their account. It is printed on the final results and the certificates of the
// events they approved or confirmed, so nobody has to draw it again for every sheet.
export const signatures = {
  getMySignature(ctx: Ctx): string | null {
    return mine(ctx).signature ?? null
  },

  saveMyStaffSignature(ctx: Ctx, signature: string | null): string | null {
    const row = mine(ctx)
    if (signature !== null && (typeof signature !== 'string' || !signature.startsWith(PNG_PREFIX) || signature.length > MAX_SIGNATURE)) {
      return fail('Send the signature as a PNG picture under 150 KB.')
    }
    ctx.db.update(t.staffUsers).set({ signature }).where(eq(t.staffUsers.id, row.id)).run()
    record(ctx.db, row.id, signature ? 'Saved their signature' : 'Removed their signature', row.name)
    return signature
  },

  // The scrutineer who approved the event's results, and the chairperson who confirmed its final; with no confirmation
  // the chairperson who has a signature saved (first by name), so a sheet is not left without one
  getSheetSignatures(ctx: Ctx, eventId: string): SheetSignatures {
    found(ctx.db.select().from(t.events).where(eq(t.events.id, String(eventId))).get(), 'Event')
    const approvedBy = ctx.db.select({ by: t.results.approvedBy }).from(t.results).where(eq(t.results.eventId, eventId)).get()?.by
    const approver = approvedBy ? ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, approvedBy)).get() : undefined
    const finalRound = ctx.db.select().from(t.rounds).where(and(eq(t.rounds.eventId, eventId), eq(t.rounds.type, 'final'))).get()
    const decision = finalRound ? ctx.db.select().from(t.finalTieDecisions).where(eq(t.finalTieDecisions.roundId, finalRound.id)).get() : undefined
    const confirmer = decision?.confirmedBy ? ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, decision.confirmedBy)).get() : undefined
    const chairs = ctx.db.select().from(t.staffUsers).where(and(eq(t.staffUsers.role, 'chairperson'), eq(t.staffUsers.disabled, false))).orderBy(asc(t.staffUsers.name)).all()
    const chair = confirmer?.role === 'chairperson' ? confirmer : (chairs.find((c) => c.signature) ?? chairs[0])
    return { scrutineer: signer(approver?.role === 'scrutineer' ? approver : undefined), chairperson: signer(chair) }
  },
}
