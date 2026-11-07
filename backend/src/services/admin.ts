import { PIN_LENGTH, Role, checkAgeGroup, checkEventKind, freshId, type AccountKind, type Adjudicator, type AdjudicatorPin, type AgeGroupDef, type AgeGroupInput, type Competition, type CompetitionInput, type EventKindDef, type EventKindInput, type PointsRow, type StaffUser } from '@bis/shared'
import { and, eq, inArray, ne } from 'drizzle-orm'
import { randomInt } from 'node:crypto'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import { confirmCascade, impactSummary, removeCascade } from './cascade.ts'
import { record } from '../core/audit.ts'
import { hashPassword, temporaryPassword } from '../auth/password.ts'
import { bumpSessionVersion } from '../auth/signin.ts'
import * as t from '../db/schema.ts'
import { newId } from '../ids.ts'
import { recomputeAllPoints, recomputeCompetitionPoints } from './ranking.ts'
import { MAX_PHOTO, PHOTO, catalogOf, checkPhoto, clean, pointsRows, toCompetition, toPin, toStaff } from './shared.ts'

const STAFF_ROLES: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Compere, Role.Barker]

function staffRole(role: unknown): Role {
  return STAFF_ROLES.includes(role as Role) ? (role as Role) : fail('Choose a staff role.')
}

const adminCount = (ctx: Ctx) =>
  ctx.db.select().from(t.staffUsers).where(and(eq(t.staffUsers.role, Role.Admin), eq(t.staffUsers.disabled, false))).all().length

// The events in an age group whose first round has started, so what the group meant is part of their record
function startedEventIds(ctx: Ctx, ageGroup: string): Set<string> {
  const ids = ctx.db.select({ id: t.events.id }).from(t.events).where(eq(t.events.ageGroup, ageGroup)).all().map((e) => e.id)
  if (ids.length === 0) return new Set()
  const rounds = ctx.db.select({ eventId: t.rounds.eventId }).from(t.rounds).where(and(inArray(t.rounds.eventId, ids), ne(t.rounds.status, 'pending'))).all()
  return new Set(rounds.map((r) => r.eventId))
}

export const admin = {
  saveCompetition(ctx: Ctx, input: CompetitionInput, id?: string): Competition {
    const values = {
      name: clean(input?.name),
      date: clean(input?.date),
      venue: clean(input?.venue),
      organizer: clean(input?.organizer),
      executor: clean(input?.executor).slice(0, 100),
      entryDeadline: clean(input?.entryDeadline) || null,
      feeDeadline: clean(input?.feeDeadline) || null,
    }
    if (!values.name || !values.date || !values.venue || !values.organizer) return fail('Fill in every field.')
    if (input?.usesPoints !== undefined && typeof input.usesPoints !== 'boolean') return fail('Choose whether the competition uses points.')
    // A missing image keeps the one already there; a competition always has one
    const image = input?.image === undefined ? undefined : typeof input.image === 'string' && input.image ? input.image : null
    if (image && (!PHOTO.test(image) || image.length > MAX_PHOTO)) return fail('Send the photo as a JPEG, PNG or WebP picture under 400 KB.')
    for (const day of [values.date, values.entryDeadline, values.feeDeadline]) {
      if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail('Enter dates as year-month-day.')
    }
    const user = actor(ctx)
    // A competition that is over cannot be added, or moved into the past; one already past can still have its other details corrected
    const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
    const PAST = 'A competition cannot be dated before today. A finished competition cannot be added.'
    if (id) {
      const before = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, id)).get(), 'Competition')
      if (values.date < today && values.date !== before.date) return fail(PAST)
      if (!(image === undefined ? before.image : image)) return fail('Add the photo for its card.')
      const changes = { ...values, ...(image === undefined ? {} : { image }), ...(input.usesPoints === undefined ? {} : { usesPoints: input.usesPoints }) }
      ctx.db.update(t.competitions).set(changes).where(eq(t.competitions.id, id)).run()
      // Turning points off removes what its events awarded; turning them on awards them from the results already approved
      if (changes.usesPoints !== undefined && changes.usesPoints !== before.usesPoints) recomputeCompetitionPoints(ctx, id)
      record(ctx.db, user.id, 'Edited competition', values.name, { before: toCompetition(before), after: changes })
      return toCompetition({ ...before, ...changes })
    }
    if (values.date < today) return fail(PAST)
    if (!image) return fail('Add the photo for its card.')
    if (ctx.db.select().from(t.competitions).all().some((c) => c.name.toLowerCase() === values.name.toLowerCase() && c.date === values.date)) {
      return fail('A competition with this name and date already exists.', 409)
    }
    const created = { id: newId(), floorRoundId: null, ...values, image, usesPoints: input?.usesPoints ?? true }
    ctx.db.insert(t.competitions).values(created).run()
    record(ctx.db, user.id, 'Created competition', values.name, { after: values })
    return toCompetition(created)
  },

  saveEventKind(ctx: Ctx, input: EventKindInput, id?: string): EventKindDef {
    const kinds = catalogOf(ctx).kinds
    const checked = checkEventKind(input, kinds.filter((k) => k.id !== id))
    if ('error' in checked) return fail(checked.error, checked.status)
    const values = checked.values
    const user = actor(ctx)
    if (id) {
      const before = found(kinds.find((k) => k.id === id), 'Kind')
      ctx.db.update(t.eventKinds).set(values).where(eq(t.eventKinds.id, id)).run()
      record(ctx.db, user.id, 'Edited event kind', values.name, { before: { ...before, id: undefined }, after: values })
      return { id, ...values }
    }
    const created = { id: freshId(values.name, kinds.map((k) => k.id)), ...values, sortOrder: kinds.length }
    ctx.db.insert(t.eventKinds).values(created).run()
    record(ctx.db, user.id, 'Created event kind', values.name, { after: values })
    return { id: created.id, ...values }
  },

  deleteEventKind(ctx: Ctx, id: string, cascade?: boolean): { id: string } {
    const row = found(ctx.db.select().from(t.eventKinds).where(eq(t.eventKinds.id, id)).get(), 'Kind')
    const impact = confirmCascade(ctx, 'eventKind', id, cascade)
    removeCascade(ctx, 'eventKind', id)
    record(ctx.db, actor(ctx).id, 'Deleted event kind', row.name, { before: { id, removed: impactSummary(impact) } })
    return { id }
  },

  saveAgeGroup(ctx: Ctx, input: AgeGroupInput, id?: string): AgeGroupDef {
    const groups = catalogOf(ctx).ageGroups
    const checked = checkAgeGroup(input, groups.filter((g) => g.id !== id && !g.retired))
    if ('error' in checked) return fail(checked.error, checked.status)
    const values = checked.values
    const user = actor(ctx)
    if (id) {
      const before = found(groups.find((g) => g.id === id), 'Age group')
      if (before.retired) return fail(`${before.name} was replaced by a newer version. Edit that one.`, 409)
      const unchanged = before.name === values.name && before.short === values.short && before.oldestAge === values.oldestAge && before.juvenileFee === values.juvenileFee
      if (unchanged) return { id, ...values }
      const started = startedEventIds(ctx, id)
      if (started.size === 0) {
        ctx.db.update(t.ageGroups).set(values).where(eq(t.ageGroups.id, id)).run()
        record(ctx.db, user.id, 'Edited age group', values.name, { before: { ...before, id: undefined }, after: values })
        return { id, ...values }
      }
      // Events have run in it: they keep this version, and the events still to run move to the new one
      const family = before.family ?? id
      const next = { id: freshId(values.name, groups.map((g) => g.id)), family, retired: false, ...values }
      ctx.db.transaction((tx) => {
        tx.insert(t.ageGroups).values(next).run()
        tx.update(t.ageGroups).set({ retired: true }).where(eq(t.ageGroups.id, id)).run()
        const upcoming = tx.select({ id: t.events.id }).from(t.events).where(eq(t.events.ageGroup, id)).all().filter((e) => !started.has(e.id))
        if (upcoming.length > 0) tx.update(t.events).set({ ageGroup: next.id }).where(inArray(t.events.id, upcoming.map((e) => e.id))).run()
        tx.update(t.competitors).set({ ageGroup: next.id }).where(eq(t.competitors.ageGroup, id)).run()
      })
      record(ctx.db, user.id, 'Edited age group', values.name, { before: { ...before, id: undefined }, after: { ...values, newVersion: next.id, retired: id } })
      return { id: next.id, family, ...values }
    }
    const created = { id: freshId(values.name, groups.map((g) => g.id)), ...values }
    ctx.db.insert(t.ageGroups).values(created).run()
    record(ctx.db, user.id, 'Created age group', values.name, { after: values })
    return created
  },

  deleteAgeGroup(ctx: Ctx, id: string, cascade?: boolean): { id: string } {
    const row = found(ctx.db.select().from(t.ageGroups).where(eq(t.ageGroups.id, id)).get(), 'Age group')
    const impact = confirmCascade(ctx, 'ageGroup', id, cascade)
    removeCascade(ctx, 'ageGroup', id)
    record(ctx.db, actor(ctx).id, 'Deleted age group', row.name, { before: { id, removed: impactSummary(impact) } })
    return { id }
  },

  deleteCompetition(ctx: Ctx, id: string, cascade?: boolean): { id: string } {
    const row = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, id)).get(), 'Competition')
    const impact = confirmCascade(ctx, 'competition', id, cascade)
    removeCascade(ctx, 'competition', id)
    record(ctx.db, actor(ctx).id, 'Deleted competition', row.name, { before: { id, removed: impactSummary(impact) } })
    return { id }
  },

  createStaffUser(ctx: Ctx, input: { name: string; username: string; role: Role; photo: string }): { user: StaffUser; tempPassword: string } {
    const username = clean(input?.username).toLowerCase()
    const name = clean(input?.name)
    if (!name || !username) return fail('Enter a name and an email.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) return fail('Enter a valid email address.')
    const role = staffRole(input.role)
    const photo = checkPhoto(input?.photo)
    if (ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.username, username)).get()) return fail('That email is already used by another account.', 409)
    const tempPassword = temporaryPassword()
    const row = { id: newId(), name, username, role, photo, passwordHash: hashPassword(tempPassword), disabled: false }
    ctx.db.insert(t.staffUsers).values(row).run()
    record(ctx.db, actor(ctx).id, 'Added staff account', name, { after: { username, role } })
    return { user: toStaff(row), tempPassword }
  },

  updateStaffUser(ctx: Ctx, id: string, input: { name: string; role: Role; photo?: string }): StaffUser {
    const user = found(ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, id)).get(), 'Staff account')
    const name = clean(input?.name)
    if (!name) return fail('Enter a name.')
    const role = staffRole(input.role)
    if (user.role === Role.Admin && role !== Role.Admin && adminCount(ctx) === 1) return fail('There must be at least one admin.', 409)
    // A missing photo keeps the one already there; an account is never left without one
    const photo = input?.photo === undefined ? user.photo : checkPhoto(input.photo)
    if (!photo) return fail('Add a photo.')
    ctx.db.update(t.staffUsers).set({ name, role, photo }).where(eq(t.staffUsers.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Edited staff account', name, { before: { name: user.name, role: user.role }, after: { name, role } })
    return toStaff({ ...user, name, role, photo })
  },

  deleteStaffUser(ctx: Ctx, id: string, cascade?: boolean): { id: string } {
    const user = found(ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, id)).get(), 'Staff account')
    confirmCascade(ctx, 'staff', id, cascade)
    removeCascade(ctx, 'staff', id)
    record(ctx.db, actor(ctx).id, 'Deleted staff account', user.name, { before: { username: user.username, role: user.role } })
    return { id }
  },

  // Signs a person out of every device: their tokens stop working at once
  revokeSessions(ctx: Ctx, kind: AccountKind, id: string): void {
    if (kind !== 'staff' && kind !== 'adjudicator') return fail('Choose staff or an adjudicator.')
    const name =
      kind === 'staff'
        ? found(ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, String(id))).get(), 'Staff account').name
        : found(ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.id, String(id))).get(), 'Adjudicator').name
    bumpSessionVersion(ctx, kind, String(id))
    record(ctx.db, actor(ctx).id, 'Signed out everywhere', name)
  },

  resetStaffPassword(ctx: Ctx, id: string): { tempPassword: string } {
    const user = found(ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, id)).get(), 'Staff account')
    const tempPassword = temporaryPassword()
    ctx.db.update(t.staffUsers).set({ passwordHash: hashPassword(tempPassword) }).where(eq(t.staffUsers.id, id)).run()
    bumpSessionVersion(ctx, 'staff', id)
    record(ctx.db, actor(ctx).id, 'Reset password', user.name)
    return { tempPassword }
  },

  createAdjudicator(ctx: Ctx, input: { name: string; letter: string; photo: string }): Adjudicator {
    const letter = clean(input?.letter).toUpperCase()
    const name = clean(input?.name)
    if (!name) return fail('Enter a name.')
    if (!/^[A-J]$/.test(letter)) return fail('Pick a letter from A to J.')
    const photo = checkPhoto(input?.photo)
    if (ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.letter, letter)).get()) {
      return fail(`Letter ${letter} is already taken.`, 409)
    }
    const row = { id: newId(), name, letter, photo }
    ctx.db.insert(t.adjudicators).values(row).run()
    record(ctx.db, actor(ctx).id, 'Added adjudicator', `${letter} ${name}`)
    return row
  },

  updateAdjudicator(ctx: Ctx, id: string, input: { name: string; photo?: string }): Adjudicator {
    const adjudicator = found(ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.id, id)).get(), 'Adjudicator')
    const name = clean(input?.name)
    if (!name) return fail('Enter a name.')
    // A missing photo keeps the one already there; an adjudicator is never left without one
    const photo = input?.photo === undefined ? adjudicator.photo : checkPhoto(input.photo)
    if (!photo) return fail('Add a photo.')
    ctx.db.update(t.adjudicators).set({ name, photo }).where(eq(t.adjudicators.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Edited adjudicator', `${adjudicator.letter} ${name}`, { before: { name: adjudicator.name }, after: { name } })
    return { id, name, letter: adjudicator.letter, photo }
  },

  deleteAdjudicator(ctx: Ctx, id: string, cascade?: boolean): { id: string } {
    const row = found(ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.id, id)).get(), 'Adjudicator')
    const impact = confirmCascade(ctx, 'adjudicator', id, cascade)
    removeCascade(ctx, 'adjudicator', id)
    record(ctx.db, actor(ctx).id, 'Deleted adjudicator', `${row.letter} ${row.name}`, { before: { id, removed: impactSummary(impact) } })
    return { id }
  },

  // Without an adjudicatorId, creates PINs for everyone who has none; with one, replaces that PIN
  generatePins(ctx: Ctx, competitionId: string, adjudicatorId?: string): AdjudicatorPin[] {
    const competition = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, competitionId)).get(), 'Competition')
    const inCompetition = () => ctx.db.select().from(t.adjudicatorPins).where(eq(t.adjudicatorPins.competitionId, competitionId)).all()
    const taken = new Set(inCompetition().map((p) => p.pin))
    const nextPin = () => {
      for (;;) {
        const pin = String(randomInt(10 ** (PIN_LENGTH - 1), 10 ** PIN_LENGTH))
        if (!taken.has(pin)) {
          taken.add(pin)
          return pin
        }
      }
    }
    const targets = adjudicatorId
      ? [found(ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.id, adjudicatorId)).get(), 'Adjudicator')]
      : ctx.db.select().from(t.adjudicators).all()
    for (const a of targets) {
      const existing = inCompetition().find((p) => p.adjudicatorId === a.id)
      if (existing && !adjudicatorId) continue
      if (existing) {
        taken.delete(existing.pin)
        ctx.db
          .update(t.adjudicatorPins)
          .set({ pin: nextPin() })
          .where(and(eq(t.adjudicatorPins.competitionId, competitionId), eq(t.adjudicatorPins.adjudicatorId, a.id)))
          .run()
        // Whoever held the old PIN is signed out
        bumpSessionVersion(ctx, 'adjudicator', a.id)
      } else {
        ctx.db.insert(t.adjudicatorPins).values({ competitionId, adjudicatorId: a.id, pin: nextPin() }).run()
      }
    }
    record(ctx.db, actor(ctx).id, adjudicatorId ? 'Changed PIN' : 'Generated PINs', competition.name)
    return inCompetition().map(toPin)
  },

  setPanel(ctx: Ctx, eventId: string, adjudicatorIds: string[]) {
    const event = found(ctx.db.select().from(t.events).where(eq(t.events.id, eventId)).get(), 'Event')
    const ids = Array.isArray(adjudicatorIds)
      ? ctx.db.select({ id: t.adjudicators.id }).from(t.adjudicators).where(inArray(t.adjudicators.id, adjudicatorIds)).all().map((a) => a.id)
      : []
    if (ids.length === 0) return fail('Choose at least one adjudicator.')
    // A round that has started keeps the panel it started with
    const started = ctx.db.select().from(t.rounds).where(and(eq(t.rounds.eventId, eventId), inArray(t.rounds.status, ['marking', 'review', 'approved', 'published']))).get()
    if (started) return fail('This event has started, so its panel can no longer change.', 409)
    let panel = ctx.db.select().from(t.panels).where(eq(t.panels.eventId, eventId)).get()
    if (!panel) {
      panel = { id: newId(), eventId }
      ctx.db.insert(t.panels).values(panel).run()
    }
    ctx.db.delete(t.panelMembers).where(eq(t.panelMembers.panelId, panel.id)).run()
    for (const adjudicatorId of ids) ctx.db.insert(t.panelMembers).values({ panelId: panel.id, adjudicatorId }).run()
    record(ctx.db, actor(ctx).id, 'Changed panel', `Event ${event.number}`, { after: { adjudicatorIds: ids } })
    return { id: panel.id, eventId, adjudicatorIds: ids }
  },

  // Points already earned are worked out again from the new table
  savePointsTable(ctx: Ctx, rows: PointsRow[]): PointsRow[] {
    const current = ctx.db.select().from(t.pointsTable).orderBy(t.pointsTable.sortOrder).all()
    if (!Array.isArray(rows) || rows.length !== current.length) return fail('Send every row of the points table.')
    if (rows.some((r) => !Number.isInteger(r.points) || r.points < 0)) return fail('Points must be whole numbers, zero or more.')
    const before = pointsRows(ctx)
    rows.forEach((row, i) => {
      ctx.db.update(t.pointsTable).set({ points: row.points }).where(eq(t.pointsTable.id, current[i]!.id)).run()
    })
    recomputeAllPoints(ctx)
    record(ctx.db, actor(ctx).id, 'Edited points table', 'Points table', { before, after: pointsRows(ctx) })
    ctx.defer(() => ctx.hub.rankings())
    return pointsRows(ctx)
  },
}
