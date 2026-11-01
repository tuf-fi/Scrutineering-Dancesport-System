import { DEFAULT_FEE_SCHEDULE, Role, type AthleteInput, type AthletePage, type AthleteProfile, type AthleteRow, type AthleteSignUp, type SessionUser } from '@bis/shared'
import { asc, eq } from 'drizzle-orm'
import { hashPassword, temporaryPassword } from '../auth/password.ts'
import { bumpSessionVersion } from '../auth/signin.ts'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { readPaymentSettings } from '../paymentSettings.ts'
import { clean, currentCompetition } from './shared.ts'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
export const MIN_PASSWORD = 8

type AthleteRowDb = typeof t.athletes.$inferSelect

const toProfile = (r: AthleteRowDb): AthleteProfile => ({
  id: r.id,
  email: r.email,
  name: r.name,
  birthDate: r.birthDate,
  phone: r.phone,
  address: r.address,
  province: r.province,
  clubId: r.clubId,
  coachId: r.coachId,
  memberYear: r.memberYear,
  request: r.request ?? null,
})

// The year a membership paid now covers: the year of the competition coming up or on now
function membershipYear(ctx: Ctx): number {
  const competition = currentCompetition(ctx)
  return Number((competition?.date ?? new Date(Date.now() + 8 * 3_600_000).toISOString()).slice(0, 4))
}

const mine = (ctx: Ctx): AthleteRowDb => found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, actor(ctx).id)).get(), 'Athlete')

// Makes the account and returns who it is, so the caller can sign them in
export function createAthlete(ctx: Ctx, input: AthleteSignUp): SessionUser {
  const name = clean(input?.name)
  const email = clean(input?.email).toLowerCase()
  const password = typeof input?.password === 'string' ? input.password : ''
  if (!name || name.length > 100) return fail('Enter your name.')
  if (!EMAIL.test(email) || email.length > 200) return fail('Enter a valid email address.')
  if (password.length < MIN_PASSWORD || password.length > 128) return fail(`Use a password of at least ${MIN_PASSWORD} characters.`)
  if (ctx.db.select().from(t.athletes).where(eq(t.athletes.email, email)).get()) {
    return fail('An account with this email already exists. Sign in instead.', 409)
  }
  const row = { id: newId(), name, email, passwordHash: hashPassword(password) }
  ctx.db.insert(t.athletes).values(row).run()
  record(ctx.db, row.id, 'Athlete signed up', name)
  return { id: row.id, name, role: Role.Athlete }
}

export const athletes = {
  getMyAthlete(ctx: Ctx): AthletePage {
    const settings = readPaymentSettings(ctx.sqlite)
    return {
      profile: toProfile(mine(ctx)),
      year: membershipYear(ctx),
      fee: (settings.schedule ?? DEFAULT_FEE_SCHEDULE).athleteMembership,
      methods: settings.methods,
    }
  },

  saveMyAthlete(ctx: Ctx, input: AthleteInput): AthleteProfile {
    const row = mine(ctx)
    const name = clean(input?.name)
    if (!name || name.length > 100) return fail('Enter your name.')
    const birthDate = clean(input.birthDate)
    if (birthDate && (!DATE.test(birthDate) || Number.isNaN(Date.parse(birthDate)) || birthDate > now().slice(0, 10) || birthDate < '1900-01-01')) {
      return fail('Enter a valid date of birth.')
    }
    const clubId = clean(input.clubId) || null
    const coachId = clean(input.coachId) || null
    if (clubId && !ctx.db.select().from(t.clubs).where(eq(t.clubs.id, clubId)).get()) return fail('Choose a club from the list.')
    if (coachId && !ctx.db.select().from(t.coaches).where(eq(t.coaches.id, coachId)).get()) return fail('Choose a coach from the list.')
    const values = { name, birthDate, phone: clean(input.phone).slice(0, 40), address: clean(input.address).slice(0, 300), province: clean(input.province).slice(0, 100), clubId, coachId }
    ctx.db.update(t.athletes).set(values).where(eq(t.athletes.id, row.id)).run()
    return toProfile({ ...row, ...values })
  },

  // The athlete says they paid; the secretariat checks it against the money received
  requestMembership(ctx: Ctx, input: { method: string; reference: string }): AthleteProfile {
    const row = mine(ctx)
    const year = membershipYear(ctx)
    if (row.memberYear === year) return fail(`Your ${year} membership is already paid.`, 409)
    if (row.request && !row.request.rejectedReason) return fail('You already sent a payment. Wait for the secretariat to confirm it.', 409)
    const method = clean(input?.method)
    const reference = clean(input?.reference)
    if (!method || method.length > 40) return fail('Say how you paid.')
    if (!reference || reference.length > 60) return fail('Enter the reference number of your payment.')
    const request = { year, method, reference, requestedAt: now() }
    ctx.db.update(t.athletes).set({ request }).where(eq(t.athletes.id, row.id)).run()
    record(ctx.db, row.id, 'Sent a membership payment', row.name, { after: { year, method, reference } })
    return toProfile({ ...row, request })
  },

  getAthletes(ctx: Ctx): AthleteRow[] {
    const clubs = new Map(ctx.db.select().from(t.clubs).all().map((c) => [c.id, c.name]))
    const coaches = new Map(ctx.db.select().from(t.coaches).all().map((c) => [c.id, c.name]))
    return ctx.db
      .select()
      .from(t.athletes)
      .orderBy(asc(t.athletes.name))
      .all()
      .map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        clubName: (r.clubId && clubs.get(r.clubId)) || '',
        coachName: (r.coachId && coaches.get(r.coachId)) || '',
        memberYear: r.memberYear,
        request: r.request ?? null,
      }))
  },

  confirmMembership(ctx: Ctx, id: string): void {
    const row = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get(), 'Athlete')
    if (!row.request) return fail('This athlete has no payment waiting.', 409)
    if (row.request.rejectedReason) return fail('This payment was already turned down. The athlete has to send it again.', 409)
    ctx.db.update(t.athletes).set({ memberYear: row.request.year, request: null }).where(eq(t.athletes.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Confirmed membership', row.name, { after: { year: row.request.year, reference: row.request.reference } })
  },

  rejectMembership(ctx: Ctx, id: string, reason: string): void {
    const row = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get(), 'Athlete')
    if (!row.request) return fail('This athlete has no payment waiting.', 409)
    const rejectedReason = clean(reason)
    if (!rejectedReason) return fail('Say why it could not be confirmed.')
    ctx.db.update(t.athletes).set({ request: { ...row.request, rejectedReason: rejectedReason.slice(0, 200) } }).where(eq(t.athletes.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Turned down a membership payment', row.name, { after: { reason: rejectedReason } })
  },

  resetAthletePassword(ctx: Ctx, id: string): { tempPassword: string } {
    const row = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get(), 'Athlete')
    const tempPassword = temporaryPassword()
    ctx.db.update(t.athletes).set({ passwordHash: hashPassword(tempPassword) }).where(eq(t.athletes.id, id)).run()
    bumpSessionVersion(ctx, 'athlete', id)
    record(ctx.db, actor(ctx).id, 'Reset an athlete password', row.name)
    return { tempPassword }
  },

  deleteAthlete(ctx: Ctx, id: string): void {
    const row = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get(), 'Athlete')
    ctx.db.delete(t.athletes).where(eq(t.athletes.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Deleted an athlete account', row.name)
  },
}
