import { Role } from '@bis/shared'
import { createHash, randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { RequestLimiter } from '../auth/ratelimit.ts'
import { hashPassword } from '../auth/password.ts'
import { bumpSessionVersion } from '../auth/signin.ts'
import { record } from '../core/audit.ts'
import { actor, fail, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { newId } from '../ids.ts'
import { resetMessage, verifyMessage, type MailMessage } from '../mail.ts'
import { MIN_PASSWORD } from './shared.ts'

// Links sent by email: confirming an address after sign-up, and choosing a new password. Only athletes, coaches and
// teams have these; staff passwords are reset by an admin because staff sign-in also has a second step.

type Account = 'athlete' | 'member'
type Purpose = 'verify' | 'reset'

// A person can ask for the confirmation email again only so often
const resends = new RequestLimiter(3, 10 * 60_000)

const HOURS = { verify: 24, reset: 1 } as const
const hash = (token: string) => createHash('sha256').update(token).digest('hex')

const send = (ctx: Ctx, message: MailMessage) =>
  ctx.defer(() => void ctx.mailer.send(message).catch((error) => console.error(`Could not send "${message.subject}" to ${message.to}:`, error)))

// A fresh token replaces any link of the same kind that was not used yet
function issue(ctx: Ctx, purpose: Purpose, account: Account, accountId: string): string {
  const token = randomBytes(32).toString('base64url')
  ctx.db.delete(t.emailTokens).where(and(eq(t.emailTokens.purpose, purpose), eq(t.emailTokens.account, account), eq(t.emailTokens.accountId, accountId), isNull(t.emailTokens.usedAt))).run()
  ctx.db.insert(t.emailTokens).values({ id: newId(), purpose, account, accountId, tokenHash: hash(token), expiresAt: new Date(Date.now() + HOURS[purpose] * 3_600_000).toISOString() }).run()
  return token
}

// The unused, unexpired token for this link, or a message that says why not
function claim(ctx: Ctx, purpose: Purpose, token: unknown) {
  const row = typeof token === 'string' && token ? ctx.db.select().from(t.emailTokens).where(eq(t.emailTokens.tokenHash, hash(token))).get() : undefined
  if (!row || row.purpose !== purpose) return fail('This link is not valid. Ask for a new one.', 400)
  if (row.usedAt) return fail('This link was already used. Ask for a new one if you need it.', 400)
  if (row.expiresAt < new Date().toISOString()) return fail('This link has expired. Ask for a new one.', 400)
  return row
}

const spend = (ctx: Ctx, id: string) => ctx.db.update(t.emailTokens).set({ usedAt: new Date().toISOString() }).where(eq(t.emailTokens.id, id)).run()

function accountOf(ctx: Ctx, account: Account, id: string) {
  const row =
    account === 'athlete'
      ? ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get()
      : ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.id, id)).get()
  return row ? { name: row.name, email: row.email, verified: row.emailVerified } : null
}

// Sent when an account is made. Without a mail provider nothing can be sent, so the address counts as confirmed.
export function sendVerification(ctx: Ctx, account: Account, accountId: string) {
  const who = accountOf(ctx, account, accountId)
  if (!who || !ctx.mailer.enabled || who.verified) return
  send(ctx, verifyMessage(who.email, who.name, `${ctx.config.mail.publicUrl}/verify-email?token=${issue(ctx, 'verify', account, accountId)}`))
}

export function verifyEmail(ctx: Ctx, token: string): void {
  const row = claim(ctx, 'verify', token)
  const table = row.account === 'athlete' ? t.athletes : t.memberAccounts
  ctx.db.update(table).set({ emailVerified: true }).where(eq(table.id, row.accountId)).run()
  spend(ctx, row.id)
  record(ctx.db, row.accountId, 'Confirmed their email address', accountOf(ctx, row.account, row.accountId)?.name ?? '')
}

// The signed-in person asks for the confirmation email again
export function resendVerification(ctx: Ctx): void {
  const user = actor(ctx)
  const account: Account = user.role === Role.Athlete ? 'athlete' : 'member'
  const who = accountOf(ctx, account, user.id)
  if (!who) return fail('Account not found', 404)
  if (who.verified) return fail('Your email address is already confirmed.', 409)
  if (!ctx.mailer.enabled) return fail('Email is not set up on this server.', 503)
  if (!resends.take(user.id)) return fail('You asked a moment ago. Check your inbox, including the spam folder, and try again in a few minutes.', 429)
  sendVerification(ctx, account, user.id)
}

// Said once and the same for every email, so nobody can tell which addresses have an account
export function requestPasswordReset(ctx: Ctx, role: unknown, email: unknown): void {
  const address = typeof email === 'string' ? email.trim().toLowerCase() : ''
  if (role !== 'athlete' && role !== 'coach' && role !== 'team') return fail('Choose athlete, coach or team.')
  if (!address) return fail('Enter your email address.')
  const row =
    role === 'athlete'
      ? ctx.db.select().from(t.athletes).where(eq(t.athletes.email, address)).get()
      : ctx.db.select().from(t.memberAccounts).where(and(eq(t.memberAccounts.email, address), eq(t.memberAccounts.role, role))).get()
  if (!row) return
  const account: Account = role === 'athlete' ? 'athlete' : 'member'
  send(ctx, resetMessage(row.email, row.name, `${ctx.config.mail.publicUrl}/reset-password?token=${issue(ctx, 'reset', account, row.id)}`))
  record(ctx.db, row.id, 'Asked to reset their password', row.name)
}

// Choosing the new password signs the account out everywhere, and the link works once
export function resetPassword(ctx: Ctx, token: string, password: unknown): { role: 'athlete' | 'coach' | 'team' } {
  const row = claim(ctx, 'reset', token)
  const next = typeof password === 'string' ? password : ''
  if (next.length < MIN_PASSWORD || next.length > 128) return fail(`Use a password of at least ${MIN_PASSWORD} characters.`)
  const who = accountOf(ctx, row.account, row.accountId)
  if (!who) return fail('This link is not valid. Ask for a new one.')
  let role: 'athlete' | 'coach' | 'team' = 'athlete'
  if (row.account === 'athlete') {
    // Using the link proves the address is theirs
    ctx.db.update(t.athletes).set({ passwordHash: hashPassword(next), emailVerified: true }).where(eq(t.athletes.id, row.accountId)).run()
    bumpSessionVersion(ctx, 'athlete', row.accountId)
  } else {
    ctx.db.update(t.memberAccounts).set({ passwordHash: hashPassword(next), emailVerified: true }).where(eq(t.memberAccounts.id, row.accountId)).run()
    bumpSessionVersion(ctx, 'member', row.accountId)
    role = ctx.db.select({ role: t.memberAccounts.role }).from(t.memberAccounts).where(eq(t.memberAccounts.id, row.accountId)).get()?.role ?? 'coach'
  }
  spend(ctx, row.id)
  // Any other reset link still waiting is no longer wanted
  ctx.db.delete(t.emailTokens).where(and(eq(t.emailTokens.purpose, 'reset'), eq(t.emailTokens.accountId, row.accountId), isNull(t.emailTokens.usedAt))).run()
  record(ctx.db, row.accountId, 'Reset their password from an email link', who.name)
  return { role }
}

// Actions that need a confirmed address: linking to a record, entering events and paying
export function requireVerified(ctx: Ctx): void {
  const user = ctx.user
  if (!user || !ctx.mailer.enabled) return
  const account: Account | null = user.role === Role.Athlete ? 'athlete' : user.role === Role.Coach || user.role === Role.Team ? 'member' : null
  if (account && accountOf(ctx, account, user.id)?.verified === false) {
    return fail('Confirm your email address first. Open the link we sent you, or ask for it again from your account page.', 403)
  }
}
