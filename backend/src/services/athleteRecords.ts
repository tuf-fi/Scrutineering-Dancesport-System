import { Role, type AthleteRecord, type AthleteRecordInput, type MemberClaimRow } from '@bis/shared'
import { eq, isNotNull } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { clean, giveAthleteMembershipId, nextMembershipId } from './shared.ts'

const DATE = /^\d{4}-\d{2}-\d{2}$/

const toRecord = (r: typeof t.athleteRecords.$inferSelect): AthleteRecord => ({
  id: r.id,
  name: r.name,
  birthDate: r.birthDate,
  phone: r.phone,
  address: r.address,
  province: r.province,
  teamId: r.teamId,
  coachId: r.coachId,
  memberYear: r.memberYear,
  memberMonth: r.memberMonth,
  membershipId: r.membershipId ?? null,
})

const mine = (ctx: Ctx) => found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, actor(ctx).id)).get(), 'Account')
const recordRow = (ctx: Ctx, id: string) => ctx.db.select().from(t.athleteRecords).where(eq(t.athleteRecords.id, id)).get()

// Staff see everything; an athlete choosing their name sees names only
export function getAthleteRecords(ctx: Ctx): AthleteRecord[] {
  const all = ctx.db.select().from(t.athleteRecords).all().map(toRecord).sort((a, b) => a.name.localeCompare(b.name))
  if (ctx.user?.role !== Role.Athlete) return all
  return all.map((r) => ({ id: r.id, name: r.name, birthDate: '', phone: '', address: '', province: '', teamId: null, coachId: null, memberYear: null, memberMonth: null, membershipId: null }))
}

export function saveAthleteRecord(ctx: Ctx, input: AthleteRecordInput, id?: string): AthleteRecord {
  const name = clean(input?.name)
  if (!name) return fail('Enter the athlete’s name.')
  const birthDate = clean(input.birthDate)
  if (birthDate && !DATE.test(birthDate)) return fail('Enter a valid date of birth.')
  const teamId = input.teamId || null
  const coachId = input.coachId || null
  if (teamId && !ctx.db.select().from(t.teams).where(eq(t.teams.id, teamId)).get()) return fail('Choose a team from the list.')
  if (coachId && !ctx.db.select().from(t.coaches).where(eq(t.coaches.id, coachId)).get()) return fail('Choose a coach from the list.')
  const memberYear = Number.isInteger(input.memberYear) && (input.memberYear as number) > 2000 ? (input.memberYear as number) : null
  const memberMonth = memberYear !== null && Number.isInteger(input.memberMonth) && (input.memberMonth as number) >= 1 && (input.memberMonth as number) <= 12 ? (input.memberMonth as number) : null
  const values = { name, birthDate, phone: clean(input.phone), address: clean(input.address), province: clean(input.province), teamId, coachId, memberYear, memberMonth }
  const give = (rowId: string, before: string | null) => {
    if (memberYear === null || before) return
    ctx.db.update(t.athleteRecords).set({ membershipId: nextMembershipId(ctx, 'athlete') }).where(eq(t.athleteRecords.id, rowId)).run()
  }
  if (id) {
    const before = found(recordRow(ctx, id), 'Athlete')
    ctx.db.update(t.athleteRecords).set(values).where(eq(t.athleteRecords.id, id)).run()
    give(id, before.membershipId)
    record(ctx.db, actor(ctx).id, 'Edited athlete', name)
    return toRecord(found(recordRow(ctx, id), 'Athlete'))
  }
  const rowId = newId()
  ctx.db.insert(t.athleteRecords).values({ id: rowId, ...values }).run()
  give(rowId, null)
  record(ctx.db, actor(ctx).id, 'Added athlete', name)
  return toRecord(found(recordRow(ctx, rowId), 'Athlete'))
}

export function deleteAthleteRecord(ctx: Ctx, id: string): void {
  const row = found(recordRow(ctx, id), 'Athlete')
  ctx.db.update(t.athletes).set({ claimId: null, claimedAt: null }).where(eq(t.athletes.claimId, id)).run()
  ctx.db.delete(t.athleteRecords).where(eq(t.athleteRecords.id, id)).run()
  record(ctx.db, actor(ctx).id, 'Deleted athlete', row.name)
}

// ---- The athlete's side

export function claimAthleteRecord(ctx: Ctx, targetId: string): void {
  const row = mine(ctx)
  const target = typeof targetId === 'string' ? recordRow(ctx, targetId) : undefined
  if (!target) return fail('Choose your name from the list of athletes.')
  ctx.db.update(t.athletes).set({ claimId: target.id, claimedAt: now() }).where(eq(t.athletes.id, row.id)).run()
  record(ctx.db, row.id, 'Asked to be linked to a record', row.name, { after: { claimId: target.id } })
  ctx.defer(() => ctx.hub.alert([Role.Secretariat, Role.Admin], { title: 'Account link request', detail: `${row.name} wants to be linked to ${target.name}`, link: '/secretariat/account-links' }))
}

export function cancelAthleteClaim(ctx: Ctx): void {
  ctx.db.update(t.athletes).set({ claimId: null, claimedAt: null }).where(eq(t.athletes.id, mine(ctx).id)).run()
}

export function claimOf(ctx: Ctx, row: { claimId: string | null; claimedAt: string | null }) {
  const target = row.claimId ? recordRow(ctx, row.claimId) : undefined
  return row.claimId && target ? { id: row.claimId, name: target.name, requestedAt: row.claimedAt ?? '' } : null
}

// ---- The secretariat's side

export function athleteClaims(ctx: Ctx): MemberClaimRow[] {
  return ctx.db
    .select()
    .from(t.athletes)
    .where(isNotNull(t.athletes.claimId))
    .all()
    .flatMap((a) => {
      const target = a.claimId ? recordRow(ctx, a.claimId) : undefined
      return a.claimId && target ? [{ memberId: a.id, role: 'athlete' as const, name: a.name, email: a.email, targetId: a.claimId, targetName: target.name, requestedAt: a.claimedAt ?? '' }] : []
    })
}

function notify(ctx: Ctx, athleteId: string, kind: 'link_approved' | 'link_rejected', title: string, detail: string) {
  ctx.db.insert(t.notifications).values({ id: newId(), athleteId, kind, title, detail, link: '/athlete', createdAt: now(), readAt: null }).run()
  ctx.defer(() => ctx.hub.notify(athleteId))
}

export const isAthleteAccount = (ctx: Ctx, id: string) => Boolean(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get())

// The record's details join the account, and the record is gone
export function approveAthleteClaim(ctx: Ctx, athleteId: string): void {
  const account = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, athleteId)).get(), 'Account')
  const target = account.claimId ? recordRow(ctx, account.claimId) : undefined
  if (!target) return fail('This account has no request waiting.', 409)
  const memberYear = Math.max(account.memberYear ?? 0, target.memberYear ?? 0) || null
  // The month goes with whichever payment is the later one
  const memberMonth = (target.memberYear ?? 0) >= (account.memberYear ?? 0) ? target.memberMonth : account.memberMonth
  ctx.db.update(t.athletes).set({ claimId: null, claimedAt: null }).where(eq(t.athletes.claimId, target.id)).run()
  ctx.db.delete(t.athleteRecords).where(eq(t.athleteRecords.id, target.id)).run()
  ctx.db
    .update(t.athletes)
    .set({
      name: target.name,
      birthDate: target.birthDate || account.birthDate,
      phone: account.phone || target.phone,
      address: account.address || target.address,
      province: account.province || target.province,
      teamId: target.teamId ?? account.teamId,
      coachId: target.coachId ?? account.coachId,
      memberYear,
      memberMonth: memberYear === null ? null : memberMonth,
      membershipId: account.membershipId ?? target.membershipId,
    })
    .where(eq(t.athletes.id, account.id))
    .run()
  giveAthleteMembershipId(ctx, account.id)
  record(ctx.db, actor(ctx).id, 'Linked an account to a record', target.name, { after: { linkedId: target.id } })
  notify(ctx, account.id, 'link_approved', `You are linked to ${target.name}`, 'Your details, team and membership are on your account now.')
}

export function rejectAthleteClaim(ctx: Ctx, athleteId: string): void {
  const account = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, athleteId)).get(), 'Account')
  if (!account.claimId) return fail('This account has no request waiting.', 409)
  ctx.db.update(t.athletes).set({ claimId: null, claimedAt: null }).where(eq(t.athletes.id, account.id)).run()
  record(ctx.db, actor(ctx).id, 'Turned down a request to link an account', account.name, { before: { claimId: account.claimId } })
  notify(ctx, account.id, 'link_rejected', 'Your request to be linked was turned down', 'Check that you chose the right record and ask again.')
}
