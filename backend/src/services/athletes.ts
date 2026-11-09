import { DEFAULT_FEE_SCHEDULE, Role, type AthleteInput, type AthletePage, type AthleteProfile, type AthleteRow, type AthleteSignUp, type AthleteNotification, type MembershipEvent, type MyActivity, type SessionUser } from '@bis/shared'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { hashPassword, verifyPassword } from '../auth/password.ts'
import { bumpSessionVersion } from '../auth/signin.ts'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { readPaymentSettings } from '../paymentSettings.ts'
import { confirmCascade, removeCascade } from './cascade.ts'
import { claimOf } from './athleteRecords.ts'
import { reads } from './reads.ts'
import { changeMemberPassword, isMember, markMemberNotificationsRead, memberCompetitors, memberNotifications, signOutMember } from './members.ts'
import { MIN_PASSWORD, checkPhoto, clean, giveAthleteMembershipId } from './shared.ts'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

type AthleteRowDb = typeof t.athletes.$inferSelect

const toProfile = (r: AthleteRowDb): AthleteProfile => ({
  id: r.id,
  email: r.email,
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
  request: r.request ?? null,
  photo: r.photo ?? null,
  history: r.membershipHistory ?? [],
  changeRequest: r.changeRequest ?? null,
  emailVerified: r.emailVerified,
})

// A name compared without case, dots or extra spaces, so "Ana  M. Cruz" matches "ana m cruz"
const normal = (name: string) => name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()


// Tells an athlete something: kept for their Notifications page and pushed to the screens they have open
function notifyAthlete(ctx: Ctx, athleteId: string, note: Pick<AthleteNotification, 'kind' | 'title' | 'detail' | 'link'>) {
  ctx.db.insert(t.notifications).values({ id: newId(), athleteId, ...note, createdAt: now(), readAt: null }).run()
  ctx.defer(() => ctx.hub.notify(athleteId))
}

const withEvent = (row: AthleteRowDb, event: MembershipEvent): MembershipEvent[] => [...(row.membershipHistory ?? []), event]

// The year a membership paid now covers: this calendar year in the Philippines, ending December 31
function membershipYear(): number {
  return Number(new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 4))
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
  const photo = checkPhoto(input?.photo)
  if (ctx.db.select().from(t.athletes).where(eq(t.athletes.email, email)).get()) {
    return fail('An account with this email already exists. Sign in instead.', 409)
  }
  // With a mail provider the address is confirmed from the link in the email; without one it cannot be
  const row = { id: newId(), name, email, photo, passwordHash: hashPassword(password), emailVerified: !ctx.mailer.enabled }
  ctx.db.insert(t.athletes).values(row).run()
  record(ctx.db, row.id, 'Athlete signed up', name)
  return { id: row.id, name, role: Role.Athlete }
}

// The results and entries of some competitors, read straight from the database
function activityOf(ctx: Ctx, competitorRows: Array<typeof t.competitors.$inferSelect>): MyActivity {
  const competitorIds = competitorRows.map((c) => c.id)
  const results = competitorIds.flatMap((id) => reads.getCompetitorHistory(ctx, id))
  const entries =
    competitorIds.length === 0
      ? []
      : ctx.db
          .select({ entry: t.entries, event: t.events, competition: t.competitions })
          .from(t.entries)
          .innerJoin(t.events, eq(t.events.id, t.entries.eventId))
          .innerJoin(t.competitions, eq(t.competitions.id, t.events.competitionId))
          .where(inArray(t.entries.competitorId, competitorIds))
          .all()
          .map(({ entry, event, competition }) => ({
            entryId: entry.id,
            eventId: event.id,
            competitionId: competition.id,
            competitionName: competition.name,
            competitionDate: competition.date,
            eventNumber: event.number,
            dances: event.dances,
            ageGroup: event.ageGroup,
            class: event.class,
            discipline: event.discipline,
            scratched: entry.scratched,
            names: competitorRows.find((c) => c.id === entry.competitorId)?.names ?? [],
          }))
          .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate) || a.eventNumber - b.eventNumber)
  return { competitorIds, results, entries }
}

export const athletes = {
  getMyAthlete(ctx: Ctx): AthletePage {
    const settings = readPaymentSettings(ctx.sqlite)
    return {
      profile: { ...toProfile(mine(ctx)), claim: claimOf(ctx, mine(ctx)) },
      year: membershipYear(),
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
    const teamId = clean(input.teamId) || null
    const coachId = clean(input.coachId) || null
    if (teamId && !ctx.db.select().from(t.teams).where(eq(t.teams.id, teamId)).get()) return fail('Choose a team from the list.')
    if (coachId && !ctx.db.select().from(t.coaches).where(eq(t.coaches.id, coachId)).get()) return fail('Choose a coach from the list.')
    // A first team or coach is set straight away; changing one that is already there goes to the secretariat
    const nextTeam = row.teamId === null ? teamId : row.teamId
    const nextCoach = row.coachId === null ? coachId : row.coachId
    // Results and ranking points follow the name, and the birth date decides the age group, so changing either on file
    // goes to the secretariat too; a first birth date is set straight away
    const teamAsk = teamId !== nextTeam || coachId !== nextCoach
    const nameAsk = name !== row.name
    const birthAsk = Boolean(row.birthDate) && Boolean(birthDate) && birthDate !== row.birthDate
    const asksForChange = teamAsk || nameAsk || birthAsk
    const pending = row.changeRequest && !row.changeRequest.rejectedReason ? row.changeRequest : null
    const asked = {
      ...(nameAsk ? { name } : pending?.name ? { name: pending.name } : {}),
      ...(birthAsk ? { birthDate } : pending?.birthDate ? { birthDate: pending.birthDate } : {}),
    }
    const changeRequest = asksForChange
      ? {
          teamId: teamAsk ? teamId : (pending?.teamId ?? nextTeam),
          coachId: teamAsk ? coachId : (pending?.coachId ?? nextCoach),
          ...asked,
          requestedAt: now(),
        }
      : (row.changeRequest ?? null)
    const values = {
      name: row.name,
      birthDate: row.birthDate || birthDate,
      phone: clean(input.phone).slice(0, 40),
      address: clean(input.address).slice(0, 300),
      province: clean(input.province).slice(0, 100),
      teamId: nextTeam,
      coachId: nextCoach,
      changeRequest,
    }
    ctx.db.update(t.athletes).set(values).where(eq(t.athletes.id, row.id)).run()
    if (asksForChange) {
      const what = [teamAsk && 'team or coach', nameAsk && 'name', birthAsk && 'date of birth'].filter(Boolean).join(', ')
      record(ctx.db, row.id, `Asked to change ${what}`, row.name, { after: { teamId, coachId, ...asked } })
      ctx.defer(() => ctx.hub.alert([Role.Secretariat, Role.Admin], { title: 'Profile change', detail: `${row.name} asks to change ${what}`, link: '/secretariat/profile-changes' }))
    }
    return toProfile({ ...row, ...values })
  },

  // Asks for the current password so someone at an unlocked phone cannot change it
  changeMyPassword(ctx: Ctx, current: string, next: string): void {
    if (isMember(ctx)) return changeMemberPassword(ctx, current, next)
    const row = mine(ctx)
    if (!verifyPassword(String(current ?? ''), row.passwordHash)) return fail('Your current password is not right.')
    const password = typeof next === 'string' ? next : ''
    if (password.length < MIN_PASSWORD || password.length > 128) return fail(`Use a password of at least ${MIN_PASSWORD} characters.`)
    if (password === current) return fail('Choose a password you have not used just now.')
    ctx.db.update(t.athletes).set({ passwordHash: hashPassword(password) }).where(eq(t.athletes.id, row.id)).run()
    record(ctx.db, row.id, 'Changed their password', row.name)
  },

  saveMyPhoto(ctx: Ctx, photo: string | null): AthleteProfile {
    const row = mine(ctx)
    // A picture can be replaced but not taken away
    const value = checkPhoto(photo)
    ctx.db.update(t.athletes).set({ photo: value }).where(eq(t.athletes.id, row.id)).run()
    return toProfile({ ...row, photo: value })
  },

  getMyNotifications(ctx: Ctx): AthleteNotification[] {
    if (isMember(ctx)) return memberNotifications(ctx)
    const row = mine(ctx)
    return ctx.db.select().from(t.notifications).where(eq(t.notifications.athleteId, row.id)).orderBy(desc(t.notifications.createdAt)).limit(50).all()
  },

  // Marks the given ones as seen, or every unseen one when none are given
  markNotificationsRead(ctx: Ctx, ids?: string[]): void {
    if (isMember(ctx)) return markMemberNotificationsRead(ctx, ids)
    const row = mine(ctx)
    const own = and(eq(t.notifications.athleteId, row.id), isNull(t.notifications.readAt))
    const where = Array.isArray(ids) && ids.length > 0 ? and(own, inArray(t.notifications.id, ids.map(String))) : own
    ctx.db.update(t.notifications).set({ readAt: now() }).where(where).run()
  },

  // Raises the session version, so every phone and laptop signed in as this athlete has to sign in again
  signOutEverywhere(ctx: Ctx): void {
    if (isMember(ctx)) return signOutMember(ctx)
    const row = mine(ctx)
    bumpSessionVersion(ctx, 'athlete', row.id)
    record(ctx.db, row.id, 'Signed out everywhere', row.name)
  },

  // Everything the database holds for the competitors that carry this athlete's name: no claim, no approval
  getMyActivity(ctx: Ctx): MyActivity {
    // A coach or team sees the activity of their own dancers
    if (isMember(ctx)) return activityOf(ctx, memberCompetitors(ctx))
    const me = normal(mine(ctx).name)
    const competitorRows = ctx.db.select().from(t.competitors).all().filter((c) => c.names.some((n) => normal(n) === me))
    return activityOf(ctx, competitorRows)
  },

  // The same for one competitor, for the staff looking at a row of the competitors list
  getCompetitorActivity(ctx: Ctx, competitorId: string): MyActivity {
    const row = found(ctx.db.select().from(t.competitors).where(eq(t.competitors.id, competitorId)).get(), 'Competitor')
    return activityOf(ctx, [row])
  },

  getAthletes(ctx: Ctx): AthleteRow[] {
    const teams = new Map(ctx.db.select().from(t.teams).all().map((c) => [c.id, c.name]))
    const coaches = new Map(ctx.db.select().from(t.coaches).all().map((c) => [c.id, c.name]))
    return ctx.db
      .select()
      .from(t.athletes)
      .orderBy(desc(sql`rowid`))
      .all()
      .map((r) => ({
        id: r.id,
        name: r.name,
        birthDate: r.birthDate,
        email: r.email,
        phone: r.phone,
        teamName: (r.teamId && teams.get(r.teamId)) || '',
        coachName: (r.coachId && coaches.get(r.coachId)) || '',
        memberYear: r.memberYear,
        memberMonth: r.memberMonth,
        membershipId: r.membershipId ?? null,
        request: r.request ?? null,
        changeRequest: r.changeRequest ?? null,
        requestedName: r.changeRequest?.name ?? '',
        requestedBirthDate: r.changeRequest?.birthDate ?? '',
        requestedTeamName: (r.changeRequest?.teamId && teams.get(r.changeRequest.teamId)) || '',
        requestedCoachName: (r.changeRequest?.coachId && coaches.get(r.changeRequest.coachId)) || '',
      }))
  },

  approveProfileChange(ctx: Ctx, id: string): void {
    const row = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get(), 'Athlete')
    const change = row.changeRequest
    if (!change || change.rejectedReason) return fail('This athlete has no change waiting.', 409)
    ctx.db
      .update(t.athletes)
      .set({ teamId: change.teamId, coachId: change.coachId, ...(change.name ? { name: change.name } : {}), ...(change.birthDate ? { birthDate: change.birthDate } : {}), changeRequest: null })
      .where(eq(t.athletes.id, id))
      .run()
    record(ctx.db, actor(ctx).id, 'Approved a profile change', row.name, { before: { name: row.name, birthDate: row.birthDate }, after: { teamId: change.teamId, coachId: change.coachId, name: change.name, birthDate: change.birthDate } })
    notifyAthlete(ctx, id, { kind: 'change_approved', title: 'Your change was approved', detail: '', link: '/athlete' })
  },

  rejectProfileChange(ctx: Ctx, id: string, reason: string): void {
    const row = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get(), 'Athlete')
    if (!row.changeRequest || row.changeRequest.rejectedReason) return fail('This athlete has no change waiting.', 409)
    const rejectedReason = clean(reason)
    if (!rejectedReason) return fail('Say why it was turned down.')
    ctx.db.update(t.athletes).set({ changeRequest: { ...row.changeRequest, rejectedReason: rejectedReason.slice(0, 200) } }).where(eq(t.athletes.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Turned down a profile change', row.name, { after: { reason: rejectedReason } })
    notifyAthlete(ctx, id, { kind: 'change_rejected', title: 'Your change was turned down', detail: rejectedReason.slice(0, 200), link: '/athlete/edit' })
  },

  confirmMembership(ctx: Ctx, id: string): void {
    const row = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get(), 'Athlete')
    if (!row.request) return fail('This athlete has no payment waiting.', 409)
    if (row.request.rejectedReason) return fail('This payment was already turned down. The athlete has to send it again.', 409)
    const membershipHistory = withEvent(row, { at: now(), kind: 'confirmed', year: row.request.year, method: row.request.method })
    ctx.db.update(t.athletes).set({ memberYear: row.request.year, memberMonth: new Date().getMonth() + 1, request: null, membershipHistory }).where(eq(t.athletes.id, id)).run()
    const membershipId = giveAthleteMembershipId(ctx, id)
    record(ctx.db, actor(ctx).id, 'Confirmed membership', row.name, { after: { year: row.request.year, membershipId } })
    notifyAthlete(ctx, id, { kind: 'membership_confirmed', title: `Your ${row.request.year} membership was confirmed`, detail: `Your ${row.request.method} payment was received. You are a member until December 31, ${row.request.year}.${membershipId ? ` Your membership ID is ${membershipId}.` : ''}`, link: '/athlete/membership' })
  },

  rejectMembership(ctx: Ctx, id: string, reason: string): void {
    const row = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get(), 'Athlete')
    if (!row.request) return fail('This athlete has no payment waiting.', 409)
    const rejectedReason = clean(reason)
    if (!rejectedReason) return fail('Say why it could not be confirmed.')
    const membershipHistory = withEvent(row, { at: now(), kind: 'rejected', year: row.request.year, method: row.request.method, reason: rejectedReason.slice(0, 200) })
    ctx.db.update(t.athletes).set({ request: { ...row.request, rejectedReason: rejectedReason.slice(0, 200) }, membershipHistory }).where(eq(t.athletes.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Turned down a membership payment', row.name, { after: { reason: rejectedReason } })
    notifyAthlete(ctx, id, { kind: 'membership_rejected', title: 'Your membership payment was not confirmed', detail: rejectedReason.slice(0, 200), link: '/athlete/membership' })
  },

  // The one way to fix a wrong name or birth date
  correctAthlete(ctx: Ctx, id: string, input: { name: string; birthDate: string }): AthleteRow {
    const row = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get(), 'Athlete')
    const name = clean(input?.name)
    if (!name || name.length > 100) return fail('Enter the name.')
    const birthDate = clean(input?.birthDate)
    if (birthDate && (!DATE.test(birthDate) || Number.isNaN(Date.parse(birthDate)) || birthDate > now().slice(0, 10) || birthDate < '1900-01-01')) return fail('Enter a valid date of birth.')
    ctx.db.update(t.athletes).set({ name, birthDate }).where(eq(t.athletes.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Corrected an athlete', name, { before: { name: row.name, birthDate: row.birthDate }, after: { name, birthDate } })
    return athletes.getAthletes(ctx).find((a) => a.id === id)!
  },

  deleteAthlete(ctx: Ctx, id: string, cascade?: boolean): void {
    const row = found(ctx.db.select().from(t.athletes).where(eq(t.athletes.id, id)).get(), 'Athlete')
    confirmCascade(ctx, 'athlete', id, cascade)
    removeCascade(ctx, 'athlete', id)
    record(ctx.db, actor(ctx).id, 'Deleted an athlete account', row.name)
  },
}
