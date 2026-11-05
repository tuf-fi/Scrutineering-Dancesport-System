import { competitionIsNear, Role, type AccountKind, type SessionUser } from '@bis/shared'
import { and, eq, sql } from 'drizzle-orm'
import { fail, type Ctx } from '../core/context.ts'
import { record } from '../core/audit.ts'
import * as t from '../db/schema.ts'
import { currentCompetition } from '../services/shared.ts'
import { hashPassword, verifyPassword } from './password.ts'
import { hashRecovery, verifyCode } from './totp.ts'
import { decryptSecret } from './vault.ts'

// Checked even when the account does not exist, so a wrong username takes as long as a wrong password
const DUMMY_HASH = hashPassword('not-a-real-password')

const STAFF_ROLES: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Compere]

type StaffRow = typeof t.staffUsers.$inferSelect

// Whether a typed code is one of the account's one-time codes (an authenticator app's, or an unused recovery code), and
// what using it changes. Nothing is saved here: the caller saves it only once everything else has passed.
export type SecondStep = { ok: false } | { ok: true; step?: number; recovery?: string[] }
export function checkSecondStep(row: StaffRow, typed: string, dataKey: string): SecondStep {
  const secret = row.totpSecret ? decryptSecret(row.totpSecret, dataKey) : null
  const step = secret ? verifyCode(secret, typed, row.totpLastStep) : null
  if (step !== null) return { ok: true, step }
  const hash = hashRecovery(typed)
  if (row.totpRecovery.includes(hash)) return { ok: true, recovery: row.totpRecovery.filter((h) => h !== hash) }
  return { ok: false }
}

export function saveSecondStep(ctx: Ctx, row: StaffRow, used: Extract<SecondStep, { ok: true }>) {
  if (used.step !== undefined) ctx.db.update(t.staffUsers).set({ totpLastStep: used.step }).where(eq(t.staffUsers.id, row.id)).run()
  if (used.recovery) {
    ctx.db.update(t.staffUsers).set({ totpRecovery: used.recovery }).where(eq(t.staffUsers.id, row.id)).run()
    record(ctx.db, row.id, 'Signed in with a recovery code', row.name)
    // A recovery code is used once; the admin should know someone lost their phone
    ctx.hub.alert([Role.Admin], { title: 'Recovery code used', detail: `${row.name} signed in with a recovery code`, link: '/admin/staff' })
  }
}

const SECOND_STEP_NEEDED = 'Enter the 6-digit code from your authenticator app, or a recovery code.'

export function staffSession(ctx: Ctx, username: string, password: string, code?: string): SessionUser {
  const row = ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.username, username.trim().toLowerCase())).get()
  const ok = verifyPassword(password, row?.passwordHash ?? DUMMY_HASH)
  if (!row || !ok || row.disabled) return fail('Wrong email or password.', 401)
  if (row.totpEnabled) {
    // 428 asks for the code and is not counted as a wrong guess; a wrong code (401) is
    const typed = String(code ?? '').trim()
    if (!typed) return fail(SECOND_STEP_NEEDED, 428)
    const used = checkSecondStep(row, typed, ctx.config.dataKey)
    if (!used.ok) return fail('That code is not right.', 401)
    saveSecondStep(ctx, row, used)
  }
  return { id: row.id, name: row.name, role: row.role }
}

// A PIN is valid for the competition happening now, and only around its date: a PIN found after the event is no use
export function adjudicatorSession(ctx: Ctx, pin: string): SessionUser {
  const found = currentCompetition(ctx)
  const days = ctx.config.pinWindowDays
  const competition = found && (days === null || competitionIsNear(found.date, days)) ? found : undefined
  const entry = competition
    ? ctx.db
        .select()
        .from(t.adjudicatorPins)
        .where(and(eq(t.adjudicatorPins.competitionId, competition.id), eq(t.adjudicatorPins.pin, pin.trim())))
        .get()
    : undefined
  const adjudicator = entry ? ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.id, entry.adjudicatorId)).get() : undefined
  if (!adjudicator) return fail("That PIN isn't registered for this competition.", 401)
  return { id: adjudicator.id, name: adjudicator.name, role: Role.Adjudicator, letter: adjudicator.letter }
}

export function athleteSession(ctx: Ctx, email: string, password: string): SessionUser {
  const row = ctx.db.select().from(t.athletes).where(eq(t.athletes.email, email.trim().toLowerCase())).get()
  const ok = verifyPassword(password, row?.passwordHash ?? DUMMY_HASH)
  if (!row || !ok) return fail('Wrong email or password.', 401)
  return { id: row.id, name: row.name, role: Role.Athlete }
}

export function memberSession(ctx: Ctx, role: 'coach' | 'team', email: string, password: string): SessionUser {
  const row = ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.email, email.trim().toLowerCase())).get()
  const ok = verifyPassword(password, row?.passwordHash ?? DUMMY_HASH)
  if (!row || !ok || row.role !== role) return fail('Wrong email or password.', 401)
  return { id: row.id, name: row.name, role }
}

const accountKind = (role: Role): AccountKind =>
  STAFF_ROLES.includes(role) ? 'staff' : role === Role.Athlete ? 'athlete' : role === Role.Coach || role === Role.Team ? 'member' : 'adjudicator'

// Raises an account's session version, which signs that person out everywhere: tokens carry the version they were made at
export function bumpSessionVersion(ctx: Ctx, kind: AccountKind, id: string) {
  if (kind === 'staff') ctx.db.update(t.staffUsers).set({ sessionVersion: sql`${t.staffUsers.sessionVersion} + 1` }).where(eq(t.staffUsers.id, id)).run()
  else if (kind === 'athlete') ctx.db.update(t.athletes).set({ sessionVersion: sql`${t.athletes.sessionVersion} + 1` }).where(eq(t.athletes.id, id)).run()
  else if (kind === 'member') ctx.db.update(t.memberAccounts).set({ sessionVersion: sql`${t.memberAccounts.sessionVersion} + 1` }).where(eq(t.memberAccounts.id, id)).run()
  else ctx.db.update(t.adjudicators).set({ sessionVersion: sql`${t.adjudicators.sessionVersion} + 1` }).where(eq(t.adjudicators.id, id)).run()
}

function sessionVersionOf(ctx: Ctx, kind: AccountKind, id: string): number {
  const row =
    kind === 'staff'
      ? ctx.db.select({ v: t.staffUsers.sessionVersion }).from(t.staffUsers).where(eq(t.staffUsers.id, id)).get()
      : kind === 'athlete'
        ? ctx.db.select({ v: t.athletes.sessionVersion }).from(t.athletes).where(eq(t.athletes.id, id)).get()
        : kind === 'member'
          ? ctx.db.select({ v: t.memberAccounts.sessionVersion }).from(t.memberAccounts).where(eq(t.memberAccounts.id, id)).get()
          : ctx.db.select({ v: t.adjudicators.sessionVersion }).from(t.adjudicators).where(eq(t.adjudicators.id, id)).get()
  return row?.v ?? 0
}

// The version a new token is made at. An adjudicator's PIN sign-in raises it first, so the phone signed in before is
// signed out: one phone at a time per adjudicator.
export function startVersion(ctx: Ctx, user: SessionUser): number {
  const kind = accountKind(user.role)
  if (kind === 'adjudicator') bumpSessionVersion(ctx, kind, user.id)
  return sessionVersionOf(ctx, kind, user.id)
}

// Who a signed token belongs to right now: an account that was deleted or disabled stops working at once
export function resolveSession(ctx: Ctx, given: Pick<SessionUser, 'id' | 'role'> & { sv?: number }): SessionUser | null {
  // A token made before the compere was renamed still says "mc"
  const claims = (given.role as string) === 'mc' ? { ...given, role: Role.Compere } : given
  const version = claims.sv ?? 0
  if (STAFF_ROLES.includes(claims.role)) {
    const row = ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, claims.id)).get()
    return row && !row.disabled && row.sessionVersion === version ? { id: row.id, name: row.name, role: row.role } : null
  }
  if (claims.role === Role.Adjudicator) {
    const row = ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.id, claims.id)).get()
    return row && row.sessionVersion === version ? { id: row.id, name: row.name, role: Role.Adjudicator, letter: row.letter } : null
  }
  if (claims.role === Role.Athlete) {
    const row = ctx.db.select().from(t.athletes).where(eq(t.athletes.id, claims.id)).get()
    return row && row.sessionVersion === version ? { id: row.id, name: row.name, role: Role.Athlete } : null
  }
  if (claims.role === Role.Coach || claims.role === Role.Team) {
    const row = ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.id, claims.id)).get()
    return row && row.role === claims.role && row.sessionVersion === version ? { id: row.id, name: row.name, role: row.role } : null
  }
  return null
}

// Counts wrong guesses per person and address, so a PIN or password cannot be tried over and over
export class AttemptLimiter {
  private readonly tries = new Map<string, { count: number; since: number }>()
  private readonly max: number
  private readonly windowMs: number

  constructor(max = 8, windowMs = 5 * 60_000) {
    this.max = max
    this.windowMs = windowMs
  }

  check(key: string) {
    const entry = this.tries.get(key)
    if (entry && Date.now() - entry.since > this.windowMs) this.tries.delete(key)
    if ((this.tries.get(key)?.count ?? 0) >= this.max) fail('Too many wrong attempts. Wait a few minutes and try again.', 429)
  }

  failed(key: string) {
    const entry = this.tries.get(key)
    this.tries.set(key, { count: (entry?.count ?? 0) + 1, since: entry?.since ?? Date.now() })
  }

  succeeded(key: string) {
    this.tries.delete(key)
  }
}
