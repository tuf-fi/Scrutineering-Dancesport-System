import type { StaffUser, TotpSetup, TotpStatus } from '@bis/shared'
import { eq } from 'drizzle-orm'
import { checkSecondStep, saveSecondStep } from '../auth/signin.ts'
import { decryptSecret, encryptSecret } from '../auth/vault.ts'
import { hashPassword, verifyPassword } from '../auth/password.ts'
import { hashRecovery, newRecoveryCodes, newSecret, otpauthUri, verifyCode } from '../auth/totp.ts'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { bumpSessionVersion } from '../auth/signin.ts'

const ISSUER = 'BIS'

const mine = (ctx: Ctx) => found(ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, actor(ctx).id)).get(), 'Account')

// Two-step sign-in for staff: after the password, a code from an authenticator app. Each person turns it on for
// themselves; an admin can switch it off for someone who lost their phone.
export const security = {
  // Staff change their own password by giving the current one, so someone at an unlocked laptop cannot
  changeMyStaffPassword(ctx: Ctx, current: string, next: string): void {
    const row = mine(ctx)
    if (!verifyPassword(String(current ?? ''), row.passwordHash)) return fail('Your current password is not right.')
    const password = typeof next === 'string' ? next : ''
    if (password.length < 8 || password.length > 128) return fail('Use a password of at least 8 characters.')
    if (password === current) return fail('Choose a password you have not used just now.')
    ctx.db.update(t.staffUsers).set({ passwordHash: hashPassword(password) }).where(eq(t.staffUsers.id, row.id)).run()
    record(ctx.db, row.id, 'Changed their password', row.name)
  },

  // The only detail staff may change about themselves; the username and role are the admin's to set
  saveMyStaffName(ctx: Ctx, name: string): StaffUser {
    const row = mine(ctx)
    const clean = String(name ?? '').replace(/\s+/g, ' ').trim()
    if (!clean || clean.length > 100) return fail('Enter your name.')
    ctx.db.update(t.staffUsers).set({ name: clean }).where(eq(t.staffUsers.id, row.id)).run()
    record(ctx.db, row.id, 'Changed their name', clean, { before: { name: row.name }, after: { name: clean } })
    return { id: row.id, name: clean, username: row.username, role: row.role, twoStep: row.totpEnabled }
  },

  getTotpStatus(ctx: Ctx): TotpStatus {
    const row = mine(ctx)
    return { enabled: row.totpEnabled, recoveryLeft: row.totpRecovery.length }
  },

  // Makes a secret to add to the app. Nothing is asked at sign-in until a code from it has been confirmed.
  startTotpSetup(ctx: Ctx): TotpSetup {
    const row = mine(ctx)
    if (row.totpEnabled) return fail('Two-step sign-in is already on.', 409)
    const secret = newSecret()
    ctx.db.update(t.staffUsers).set({ totpSecret: encryptSecret(secret, ctx.config.dataKey) }).where(eq(t.staffUsers.id, row.id)).run()
    return { secret, uri: otpauthUri(secret, row.username, ISSUER) }
  },

  // The code proves the app has the secret. Recovery codes are shown now, once.
  confirmTotpSetup(ctx: Ctx, code: string): { recoveryCodes: string[] } {
    const row = mine(ctx)
    if (row.totpEnabled) return fail('Two-step sign-in is already on.', 409)
    if (!row.totpSecret) return fail('Start the set-up first.', 409)
    const secret = decryptSecret(row.totpSecret, ctx.config.dataKey)
    const step = secret ? verifyCode(secret, String(code ?? ''), 0) : null
    if (step === null) return fail('That code is not right. Check the app and try again.')
    const recoveryCodes = newRecoveryCodes()
    ctx.db
      .update(t.staffUsers)
      .set({ totpEnabled: true, totpLastStep: step, totpRecovery: recoveryCodes.map(hashRecovery) })
      .where(eq(t.staffUsers.id, row.id))
      .run()
    record(ctx.db, row.id, 'Turned on two-step sign-in', row.name)
    return { recoveryCodes }
  },

  // Turning it off asks for the password and a code, so someone at an unlocked laptop cannot just switch it off
  disableTotp(ctx: Ctx, password: string, code: string): void {
    const row = mine(ctx)
    if (!row.totpEnabled) return fail('Two-step sign-in is not on.', 409)
    if (!verifyPassword(String(password ?? ''), row.passwordHash)) return fail('The password is not right.')
    const used = checkSecondStep(row, String(code ?? '').trim(), ctx.config.dataKey)
    if (!used.ok) return fail('That code is not right.')
    saveSecondStep(ctx, row, used)
    ctx.db.update(t.staffUsers).set({ totpEnabled: false, totpSecret: null, totpLastStep: 0, totpRecovery: [] }).where(eq(t.staffUsers.id, row.id)).run()
    record(ctx.db, row.id, 'Turned off two-step sign-in', row.name)
  },

  // For someone who lost their phone and their recovery codes: it goes off, and they are signed out everywhere
  resetTotp(ctx: Ctx, id: string): void {
    const row = found(ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, String(id))).get(), 'Staff account')
    if (!row.totpEnabled) return fail('Two-step sign-in is not on for this account.', 409)
    ctx.db.update(t.staffUsers).set({ totpEnabled: false, totpSecret: null, totpLastStep: 0, totpRecovery: [] }).where(eq(t.staffUsers.id, row.id)).run()
    bumpSessionVersion(ctx, 'staff', row.id)
    record(ctx.db, actor(ctx).id, 'Reset two-step sign-in', row.name)
  },
}
