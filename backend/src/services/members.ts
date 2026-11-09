import { Role, type AthleteNotification, type AthleteSignUp, type MemberAccount, type MemberInput, type MemberChangeRow, type MemberClaimRow, type MemberRoster, type SessionUser } from '@bis/shared'
import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import { hashPassword, verifyPassword } from '../auth/password.ts'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import { requireVerified } from './emailLinks.ts'
import { approveAthleteClaim, athleteClaims, isAthleteAccount, rejectAthleteClaim } from './athleteRecords.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { bumpSessionVersion } from '../auth/signin.ts'
import { MIN_PASSWORD, checkPhoto, clean } from './shared.ts'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Makes a coach's or a team's account and returns who it is, so the caller can sign them in
export function createMember(ctx: Ctx, role: 'coach' | 'team', input: AthleteSignUp): SessionUser {
  const name = clean(input?.name)
  const email = clean(input?.email).toLowerCase()
  const password = typeof input?.password === 'string' ? input.password : ''
  if (!name || name.length > 100) return fail(role === 'team' ? 'Enter the name of your team.' : 'Enter your name.')
  if (!EMAIL.test(email) || email.length > 200) return fail('Enter a valid email address.')
  if (password.length < MIN_PASSWORD || password.length > 128) return fail(`Use a password of at least ${MIN_PASSWORD} characters.`)
  const photo = checkPhoto(input?.photo)
  if (ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.email, email)).get()) {
    return fail('An account with this email already exists. Sign in instead.', 409)
  }
  const id = newId()
  ctx.db.insert(t.memberAccounts).values({ id, role, name, email, photo, passwordHash: hashPassword(password), emailVerified: !ctx.mailer.enabled }).run()
  record(ctx.db, id, role === 'team' ? 'Team signed up' : 'Coach signed up', name)
  return { id, name, role: role === 'team' ? Role.Team : Role.Coach }
}

const mine = (ctx: Ctx) => found(ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.id, actor(ctx).id)).get(), 'Account')

// The name of the coach or team record an account of this kind can stand for
function recordName(ctx: Ctx, role: 'coach' | 'team', id: string): string | null {
  const row =
    role === 'coach'
      ? ctx.db.select({ name: t.coaches.name }).from(t.coaches).where(eq(t.coaches.id, id)).get()
      : ctx.db.select({ name: t.teams.name }).from(t.teams).where(eq(t.teams.id, id)).get()
  return row?.name ?? null
}

function toAccount(ctx: Ctx, row: typeof t.memberAccounts.$inferSelect): MemberAccount {
  const linked = row.linkedId ? recordName(ctx, row.role, row.linkedId) : null
  const claim = row.claimId ? recordName(ctx, row.role, row.claimId) : null
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    email: row.email,
    phone: row.phone,
    birthDate: row.birthDate,
    province: row.province,
    address: row.address,
    photo: row.photo,
    linked: row.linkedId && linked !== null ? { id: row.linkedId, name: linked } : null,
    claim: row.claimId && claim !== null ? { id: row.claimId, name: claim, requestedAt: row.claimedAt ?? '' } : null,
    changeRequest: row.changeRequest ?? null,
    emailVerified: row.emailVerified,
  }
}

export const getMyMember = (ctx: Ctx): MemberAccount => toAccount(ctx, mine(ctx))

// Asks to be linked to a coach or team record; the secretariat decides
export function claimRecord(ctx: Ctx, targetId: string): MemberAccount {
  requireVerified(ctx)
  const row = mine(ctx)
  if (row.linkedId) return fail('Your account is already linked.', 409)
  const name = typeof targetId === 'string' ? recordName(ctx, row.role, targetId) : null
  if (name === null) return fail(row.role === 'team' ? 'Choose your team from the list.' : 'Choose your name from the list of coaches.')
  const values = { claimId: targetId, claimedAt: now() }
  ctx.db.update(t.memberAccounts).set(values).where(eq(t.memberAccounts.id, row.id)).run()
  record(ctx.db, row.id, 'Asked to be linked to a record', row.name, { after: { claimId: targetId } })
  ctx.defer(() => ctx.hub.alert([Role.Secretariat, Role.Admin], { title: 'Account link request', detail: `${row.name} wants to be linked to ${name}`, link: '/secretariat/account-links' }))
  return toAccount(ctx, { ...row, ...values })
}

export function cancelClaim(ctx: Ctx): MemberAccount {
  const row = mine(ctx)
  const values = { claimId: null, claimedAt: null }
  ctx.db.update(t.memberAccounts).set(values).where(eq(t.memberAccounts.id, row.id)).run()
  return toAccount(ctx, { ...row, ...values })
}

// Their dancers, and for a team its payments, for a coach the membership years. Nothing until the account is linked.
export function getMyRoster(ctx: Ctx): MemberRoster {
  const row = mine(ctx)
  const empty: MemberRoster = { rows: [], payments: [], membership: null }
  if (!row.linkedId) return empty

  const teams = new Map(ctx.db.select().from(t.teams).all().map((c) => [c.id, c.name]))
  const competitors = memberCompetitors(ctx)
  const ids = competitors.map((c) => c.id)
  const entryCounts = new Map<string, number>()
  if (ids.length > 0) {
    for (const e of ctx.db.select().from(t.entries).where(inArray(t.entries.competitorId, ids)).all()) {
      if (!e.scratched) entryCounts.set(e.competitorId, (entryCounts.get(e.competitorId) ?? 0) + 1)
    }
  }
  const rows = competitors
    .map((c) => ({ competitorId: c.id, names: c.names, backNumber: c.backNumber, teamName: teams.get(c.teamId) ?? '', entries: entryCounts.get(c.id) ?? 0 }))
    .sort((a, b) => (a.names[0] ?? '').localeCompare(b.names[0] ?? ''))

  if (row.role === 'coach') {
    const coach = ctx.db.select().from(t.coaches).where(eq(t.coaches.id, row.linkedId)).get()
    return { rows, payments: [], membership: coach ? { memberYear: coach.memberYear, summitYear: coach.summitYear, membershipId: coach.membershipId ?? null, summits: coach.summits ?? [] } : null }
  }
  const competitions = new Map(ctx.db.select({ id: t.competitions.id, name: t.competitions.name, date: t.competitions.date }).from(t.competitions).all().map((c) => [c.id, c]))
  const payments = ctx.db
    .select()
    .from(t.payments)
    .where(and(eq(t.payments.teamId, row.linkedId), isNotNull(t.payments.competitionId)))
    .all()
        .map((p) => ({ id: p.id, competitionName: competitions.get(p.competitionId ?? '')?.name ?? '', date: competitions.get(p.competitionId ?? '')?.date ?? '', amountDue: p.amountDue, amountPaid: p.amountPaid, status: p.status }))
    // Newest competition first
    .sort((a, b) => b.date.localeCompare(a.date))
  return { rows, payments, membership: null }
}

// ---- What the system tells them ----

function notifyMember(ctx: Ctx, memberId: string, note: Pick<AthleteNotification, 'kind' | 'title' | 'detail' | 'link'>) {
  ctx.db.insert(t.memberNotifications).values({ id: newId(), memberId, ...note, createdAt: now(), readAt: null }).run()
  ctx.defer(() => ctx.hub.notify(memberId))
}

export function memberNotifications(ctx: Ctx): AthleteNotification[] {
  return ctx.db.select().from(t.memberNotifications).where(eq(t.memberNotifications.memberId, mine(ctx).id)).orderBy(desc(t.memberNotifications.createdAt)).limit(50).all()
}

export function markMemberNotificationsRead(ctx: Ctx, ids?: string[]): void {
  const own = and(eq(t.memberNotifications.memberId, mine(ctx).id), isNull(t.memberNotifications.readAt))
  const where = Array.isArray(ids) && ids.length > 0 ? and(own, inArray(t.memberNotifications.id, ids.map(String))) : own
  ctx.db.update(t.memberNotifications).set({ readAt: now() }).where(where).run()
}

// ---- The secretariat's side ----

export function getMemberClaims(ctx: Ctx): MemberClaimRow[] {
  return [...memberClaims(ctx), ...athleteClaims(ctx)].sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
}

function memberClaims(ctx: Ctx): MemberClaimRow[] {
  return ctx.db
    .select()
    .from(t.memberAccounts)
    .where(isNotNull(t.memberAccounts.claimId))
    .all()
    .flatMap((m) => {
      const targetName = m.claimId ? recordName(ctx, m.role, m.claimId) : null
      return m.claimId && targetName !== null
        ? [{ memberId: m.id, role: m.role, name: m.name, email: m.email, targetId: m.claimId, targetName, requestedAt: m.claimedAt ?? '' }]
        : []
    })
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))
}

function waiting(ctx: Ctx, memberId: string) {
  const row = found(ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.id, memberId)).get(), 'Account')
  if (!row.claimId) return fail('This account has no request waiting.', 409)
  return row
}

export function approveMemberClaim(ctx: Ctx, memberId: string): MemberClaimRow[] {
  if (isAthleteAccount(ctx, memberId)) {
    approveAthleteClaim(ctx, memberId)
    return getMemberClaims(ctx)
  }
  const row = waiting(ctx, memberId)
  const taken = ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.linkedId, row.claimId!)).get()
  if (taken && taken.id !== row.id) return fail('That record is already linked to another account.', 409)
  ctx.db.update(t.memberAccounts).set({ linkedId: row.claimId, claimId: null, claimedAt: null }).where(eq(t.memberAccounts.id, row.id)).run()
  record(ctx.db, actor(ctx).id, 'Linked an account to a record', row.name, { after: { linkedId: row.claimId } })
  const target = recordName(ctx, row.role, row.claimId!) ?? ''
  notifyMember(ctx, row.id, { kind: 'link_approved', title: `You are linked to ${target}`, detail: row.role === 'team' ? 'Your dancers and payments are on your page now.' : 'Your athletes are on your page now.', link: `/${row.role}/dancers` })
  return getMemberClaims(ctx)
}

export function rejectMemberClaim(ctx: Ctx, memberId: string): MemberClaimRow[] {
  if (isAthleteAccount(ctx, memberId)) {
    rejectAthleteClaim(ctx, memberId)
    return getMemberClaims(ctx)
  }
  const row = waiting(ctx, memberId)
  ctx.db.update(t.memberAccounts).set({ claimId: null, claimedAt: null }).where(eq(t.memberAccounts.id, row.id)).run()
  record(ctx.db, actor(ctx).id, 'Turned down a request to link an account', row.name, { before: { claimId: row.claimId } })
  notifyMember(ctx, row.id, { kind: 'link_rejected', title: 'Your request to be linked was turned down', detail: 'Check that you chose the right record and ask again.', link: `/${row.role}` })
  return getMemberClaims(ctx)
}

// ---- Their own account ----

export const isMember = (ctx: Ctx) => ctx.user?.role === Role.Coach || ctx.user?.role === Role.Team

export function saveMyMember(ctx: Ctx, input: MemberInput): MemberAccount {
  const row = mine(ctx)
  const name = clean(input?.name)
  if (!name || name.length > 100) return fail(row.role === 'team' ? 'Enter the name of your team.' : 'Enter your name.')
  const birthDate = clean(input?.birthDate)
  if (birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(Date.parse(birthDate)) || birthDate > new Date().toISOString().slice(0, 10))) return fail('Enter a valid date of birth.')
  // A team renames itself. A coach's name, and a birth date already on file, go to the secretariat to approve
  const coach = row.role === 'coach'
  const nameAsk = coach && name !== row.name
  const birthAsk = coach && Boolean(row.birthDate) && Boolean(birthDate) && birthDate !== row.birthDate
  const pending = row.changeRequest && !row.changeRequest.rejectedReason ? row.changeRequest : null
  const asked = {
    ...(nameAsk ? { name } : pending?.name ? { name: pending.name } : {}),
    ...(birthAsk ? { birthDate } : pending?.birthDate ? { birthDate: pending.birthDate } : {}),
  }
  const changeRequest = nameAsk || birthAsk ? { ...asked, requestedAt: now() } : (row.changeRequest ?? null)
  const values = {
    name: coach ? row.name : name,
    phone: clean(input?.phone).slice(0, 40),
    birthDate: coach ? row.birthDate || birthDate : birthDate,
    province: clean(input?.province).slice(0, 100),
    address: clean(input?.address).slice(0, 300),
    changeRequest,
  }
  ctx.db.update(t.memberAccounts).set(values).where(eq(t.memberAccounts.id, row.id)).run()
  record(ctx.db, row.id, 'Changed their account details', row.name)
  if (nameAsk || birthAsk) {
    const what = [nameAsk && 'name', birthAsk && 'date of birth'].filter(Boolean).join(' and ')
    record(ctx.db, row.id, `Asked to change ${what}`, row.name, { after: asked })
    ctx.defer(() => ctx.hub.alert([Role.Secretariat, Role.Admin], { title: 'Profile change', detail: `${row.name} asks to change ${what}`, link: '/secretariat/profile-changes' }))
  }
  return toAccount(ctx, { ...row, ...values })
}

const waitingChange = (r: typeof t.memberAccounts.$inferSelect) => r.changeRequest !== null && !r.changeRequest.rejectedReason

export function getMemberChanges(ctx: Ctx): MemberChangeRow[] {
  return ctx.db
    .select()
    .from(t.memberAccounts)
    .where(isNotNull(t.memberAccounts.changeRequest))
    .all()
    .filter(waitingChange)
    .map((r) => ({
      memberId: r.id,
      role: r.role,
      name: r.name,
      birthDate: r.birthDate,
      requestedName: r.changeRequest?.name ?? '',
      requestedBirthDate: r.changeRequest?.birthDate ?? '',
      requestedAt: r.changeRequest?.requestedAt ?? '',
    }))
}

export function approveMemberChange(ctx: Ctx, memberId: string): MemberChangeRow[] {
  const row = found(ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.id, memberId)).get(), 'Account')
  const change = row.changeRequest
  if (!change || change.rejectedReason) return fail('This account has no change waiting.', 409)
  ctx.db
    .update(t.memberAccounts)
    .set({ ...(change.name ? { name: change.name } : {}), ...(change.birthDate ? { birthDate: change.birthDate } : {}), changeRequest: null })
    .where(eq(t.memberAccounts.id, memberId))
    .run()
  record(ctx.db, actor(ctx).id, 'Approved a profile change', row.name, { before: { name: row.name, birthDate: row.birthDate }, after: { name: change.name, birthDate: change.birthDate } })
  notifyMember(ctx, memberId, { kind: 'change_approved', title: 'Your change was approved', detail: '', link: `/${row.role}` })
  return getMemberChanges(ctx)
}

export function rejectMemberChange(ctx: Ctx, memberId: string, reason: string): MemberChangeRow[] {
  const row = found(ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.id, memberId)).get(), 'Account')
  if (!row.changeRequest || row.changeRequest.rejectedReason) return fail('This account has no change waiting.', 409)
  const rejectedReason = clean(reason).slice(0, 200)
  if (!rejectedReason) return fail('Say why it was turned down.')
  ctx.db.update(t.memberAccounts).set({ changeRequest: { ...row.changeRequest, rejectedReason } }).where(eq(t.memberAccounts.id, memberId)).run()
  record(ctx.db, actor(ctx).id, 'Turned down a profile change', row.name, { after: { reason: rejectedReason } })
  notifyMember(ctx, memberId, { kind: 'change_rejected', title: 'Your change was turned down', detail: rejectedReason, link: `/${row.role}/edit` })
  return getMemberChanges(ctx)
}

// The one way to fix a wrong name or birth date on a coach or team account
export function correctMember(ctx: Ctx, id: string, input: { name: string; birthDate: string }): void {
  const row = found(ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.id, id)).get(), 'Account')
  const name = clean(input?.name)
  if (!name || name.length > 100) return fail('Enter the name.')
  const birthDate = clean(input?.birthDate)
  if (birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(Date.parse(birthDate)) || birthDate > new Date().toISOString().slice(0, 10))) return fail('Enter a valid date of birth.')
  ctx.db.update(t.memberAccounts).set({ name, birthDate }).where(eq(t.memberAccounts.id, id)).run()
  record(ctx.db, actor(ctx).id, 'Corrected an account', name, { before: { name: row.name, birthDate: row.birthDate }, after: { name, birthDate } })
}

export function saveMyMemberPhoto(ctx: Ctx, photo: string | null): MemberAccount {
  const row = mine(ctx)
  // A picture can be replaced but not taken away
  const value = checkPhoto(photo)
  ctx.db.update(t.memberAccounts).set({ photo: value }).where(eq(t.memberAccounts.id, row.id)).run()
  return toAccount(ctx, { ...row, photo: value })
}

export function changeMemberPassword(ctx: Ctx, current: string, next: string): void {
  const row = mine(ctx)
  if (!verifyPassword(String(current ?? ''), row.passwordHash)) return fail('Your current password is not right.')
  const password = typeof next === 'string' ? next : ''
  if (password.length < MIN_PASSWORD || password.length > 128) return fail(`Use a password of at least ${MIN_PASSWORD} characters.`)
  if (password === current) return fail('Choose a password you have not used just now.')
  ctx.db.update(t.memberAccounts).set({ passwordHash: hashPassword(password) }).where(eq(t.memberAccounts.id, row.id)).run()
  record(ctx.db, row.id, 'Changed their password', row.name)
}

export function signOutMember(ctx: Ctx): void {
  const row = mine(ctx)
  bumpSessionVersion(ctx, 'member', row.id)
  record(ctx.db, row.id, 'Signed out everywhere', row.name)
}

// The competitors a linked account stands for: a team's team, or the dancers who name the coach
export function memberCompetitors(ctx: Ctx) {
  const row = mine(ctx)
  if (!row.linkedId) return []
  return ctx.db
    .select()
    .from(t.competitors)
    .all()
    .filter((c) => (row.role === 'team' ? c.teamId === row.linkedId : c.details?.coachId === row.linkedId))
}
