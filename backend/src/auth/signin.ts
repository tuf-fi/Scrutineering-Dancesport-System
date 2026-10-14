import { Role, type ClubSignUp, type SessionUser } from '@bis/shared'
import { and, eq } from 'drizzle-orm'
import { fail, type Ctx } from '../core/context.ts'
import { record } from '../core/audit.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { currentCompetition } from '../services/shared.ts'
import { hashPassword, verifyPassword } from './password.ts'

// Checked even when the account does not exist, so a wrong username takes as long as a wrong password
const DUMMY_HASH = hashPassword('not-a-real-password')

const STAFF_ROLES: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Mc]

export function staffSession(ctx: Ctx, username: string, password: string): SessionUser {
  const row = ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.username, username.trim().toLowerCase())).get()
  const ok = verifyPassword(password, row?.passwordHash ?? DUMMY_HASH)
  if (!row || !ok || row.disabled) return fail('Wrong username or password.', 401)
  return { id: row.id, name: row.name, role: row.role }
}

export function clubSession(ctx: Ctx, email: string, password: string): SessionUser {
  const row = ctx.db.select().from(t.clubs).where(eq(t.clubs.contactEmail, email.trim().toLowerCase())).get()
  const ok = verifyPassword(password, row?.passwordHash ?? DUMMY_HASH)
  if (!row || !ok) return fail('Wrong email or password.', 401)
  return { id: row.id, name: row.name, role: Role.Club }
}

// A PIN is valid for the competition happening now
export function adjudicatorSession(ctx: Ctx, pin: string): SessionUser {
  const competition = currentCompetition(ctx)
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

export function signUpClub(ctx: Ctx, input: ClubSignUp): SessionUser {
  const name = String(input?.name ?? '').trim()
  const contactName = String(input?.contactName ?? '').trim()
  const email = String(input?.contactEmail ?? '').trim().toLowerCase()
  const password = String(input?.password ?? '')
  if (!name || !contactName) return fail('Enter the club name and a contact person.')
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail('Enter a valid email address.')
  if (password.length < 8) return fail('Use a password of at least 8 characters.')
  if (input?.agreed !== true) return fail('Agree to the privacy notice to sign up.')
  const clubs = ctx.db.select().from(t.clubs).all()
  if (clubs.some((c) => c.contactEmail === email)) return fail('A club with this email already exists. Sign in instead.', 409)
  if (clubs.some((c) => c.name.toLowerCase() === name.toLowerCase())) return fail('A club with this name already exists.', 409)
  const row = {
    id: newId(),
    name,
    contactName,
    contactEmail: email,
    contactPhone: String(input?.contactPhone ?? '').trim(),
    passwordHash: hashPassword(password),
    consentAt: now(),
  }
  ctx.db.insert(t.clubs).values(row).run()
  record(ctx.db, row.id, 'Club signed up', name)
  return { id: row.id, name, role: Role.Club }
}

// Who a signed token belongs to right now: an account that was deleted or disabled stops working at once
export function resolveSession(ctx: Ctx, claims: Pick<SessionUser, 'id' | 'role'>): SessionUser | null {
  if (STAFF_ROLES.includes(claims.role)) {
    const row = ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, claims.id)).get()
    return row && !row.disabled ? { id: row.id, name: row.name, role: row.role } : null
  }
  if (claims.role === Role.Adjudicator) {
    const row = ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.id, claims.id)).get()
    return row ? { id: row.id, name: row.name, role: Role.Adjudicator, letter: row.letter } : null
  }
  if (claims.role === Role.Club) {
    const row = ctx.db.select().from(t.clubs).where(eq(t.clubs.id, claims.id)).get()
    return row ? { id: row.id, name: row.name, role: Role.Club } : null
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
