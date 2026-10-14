import { PaymentStatus, Role, type Adjudicator, type AdjudicatorPin, type Competition, type CompetitionInput, type PaymentDetail, type PointsRow, type StaffUser } from '@bis/shared'
import { and, eq, inArray } from 'drizzle-orm'
import { randomInt } from 'node:crypto'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import { record } from '../core/audit.ts'
import { hashPassword, temporaryPassword } from '../auth/password.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { recomputeAllPoints } from './ranking.ts'
import { clean, getPaymentRow, paymentDetail, pointsRows, toCompetition, toPin, toStaff } from './shared.ts'

const STAFF_ROLES: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Mc]

function staffRole(role: unknown): Role {
  return STAFF_ROLES.includes(role as Role) ? (role as Role) : fail('Choose a staff role.')
}

const adminCount = (ctx: Ctx) =>
  ctx.db.select().from(t.staffUsers).where(and(eq(t.staffUsers.role, Role.Admin), eq(t.staffUsers.disabled, false))).all().length

export const admin = {
  saveCompetition(ctx: Ctx, input: CompetitionInput, id?: string): Competition {
    const values = {
      name: clean(input?.name),
      date: clean(input?.date),
      venue: clean(input?.venue),
      organizer: clean(input?.organizer),
    }
    if (!values.name || !values.date || !values.venue || !values.organizer) return fail('Fill in every field.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)) return fail('Enter the date as year-month-day.')
    const user = actor(ctx)
    if (id) {
      const before = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, id)).get(), 'Competition')
      ctx.db.update(t.competitions).set(values).where(eq(t.competitions.id, id)).run()
      record(ctx.db, user.id, 'Edited competition', values.name, { before: toCompetition(before), after: values })
      return { id, ...values }
    }
    const created = { id: newId(), ...values }
    ctx.db.insert(t.competitions).values(created).run()
    record(ctx.db, user.id, 'Created competition', values.name, { after: created })
    return created
  },

  deleteCompetition(ctx: Ctx, id: string): { id: string } {
    const competition = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, id)).get(), 'Competition')
    const eventTotal = ctx.db.select().from(t.events).where(eq(t.events.competitionId, id)).all().length
    if (eventTotal > 0) return fail(`${competition.name} has ${eventTotal} events, so it can't be deleted.`, 409)
    ctx.db.delete(t.competitions).where(eq(t.competitions.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Deleted competition', competition.name, { before: toCompetition(competition) })
    return { id }
  },

  createStaffUser(ctx: Ctx, input: { name: string; username: string; role: Role }): { user: StaffUser; tempPassword: string } {
    const username = clean(input?.username).toLowerCase()
    const name = clean(input?.name)
    if (!name || !username) return fail('Enter a name and a username.')
    const role = staffRole(input.role)
    if (ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.username, username)).get()) return fail('That username is taken.', 409)
    const tempPassword = temporaryPassword()
    const row = { id: newId(), name, username, role, passwordHash: hashPassword(tempPassword), disabled: false }
    ctx.db.insert(t.staffUsers).values(row).run()
    record(ctx.db, actor(ctx).id, 'Added staff account', name, { after: { username, role } })
    return { user: toStaff(row), tempPassword }
  },

  updateStaffUser(ctx: Ctx, id: string, input: { name: string; role: Role }): StaffUser {
    const user = found(ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, id)).get(), 'Staff account')
    const name = clean(input?.name)
    if (!name) return fail('Enter a name.')
    const role = staffRole(input.role)
    if (user.role === Role.Admin && role !== Role.Admin && adminCount(ctx) === 1) return fail('There must be at least one admin.', 409)
    ctx.db.update(t.staffUsers).set({ name, role }).where(eq(t.staffUsers.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Edited staff account', name, { before: { name: user.name, role: user.role }, after: { name, role } })
    return toStaff({ ...user, name, role })
  },

  deleteStaffUser(ctx: Ctx, id: string): { id: string } {
    if (id === actor(ctx).id) return fail("You can't delete your own account.", 409)
    const user = found(ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, id)).get(), 'Staff account')
    if (user.role === Role.Admin && adminCount(ctx) === 1) return fail('There must be at least one admin.', 409)
    ctx.db.delete(t.staffUsers).where(eq(t.staffUsers.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Deleted staff account', user.name, { before: { username: user.username, role: user.role } })
    return { id }
  },

  resetStaffPassword(ctx: Ctx, id: string): { tempPassword: string } {
    const user = found(ctx.db.select().from(t.staffUsers).where(eq(t.staffUsers.id, id)).get(), 'Staff account')
    const tempPassword = temporaryPassword()
    ctx.db.update(t.staffUsers).set({ passwordHash: hashPassword(tempPassword) }).where(eq(t.staffUsers.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Reset password', user.name)
    return { tempPassword }
  },

  createAdjudicator(ctx: Ctx, input: { name: string; letter: string }): Adjudicator {
    const letter = clean(input?.letter).toUpperCase()
    const name = clean(input?.name)
    if (!name) return fail('Enter a name.')
    if (!/^[A-J]$/.test(letter)) return fail('Pick a letter from A to J.')
    if (ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.letter, letter)).get()) {
      return fail(`Letter ${letter} is already taken.`, 409)
    }
    const row = { id: newId(), name, letter }
    ctx.db.insert(t.adjudicators).values(row).run()
    record(ctx.db, actor(ctx).id, 'Added adjudicator', `${letter} ${name}`)
    return row
  },

  updateAdjudicator(ctx: Ctx, id: string, input: { name: string }): Adjudicator {
    const adjudicator = found(ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.id, id)).get(), 'Adjudicator')
    const name = clean(input?.name)
    if (!name) return fail('Enter a name.')
    ctx.db.update(t.adjudicators).set({ name }).where(eq(t.adjudicators.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Edited adjudicator', `${adjudicator.letter} ${name}`, { before: { name: adjudicator.name }, after: { name } })
    return { id, name, letter: adjudicator.letter }
  },

  deleteAdjudicator(ctx: Ctx, id: string): { id: string } {
    const adjudicator = found(ctx.db.select().from(t.adjudicators).where(eq(t.adjudicators.id, id)).get(), 'Adjudicator')
    const onPanels = ctx.db.select().from(t.panelMembers).where(eq(t.panelMembers.adjudicatorId, id)).all().length
    if (onPanels > 0) return fail(`${adjudicator.name} is on ${onPanels} panels, so can't be deleted.`, 409)
    if (ctx.db.select().from(t.submissions).where(eq(t.submissions.adjudicatorId, id)).get()) {
      return fail(`${adjudicator.name} has submitted marks, so can't be deleted.`, 409)
    }
    ctx.db.delete(t.adjudicators).where(eq(t.adjudicators.id, id)).run()
    record(ctx.db, actor(ctx).id, 'Deleted adjudicator', `${adjudicator.letter} ${adjudicator.name}`)
    return { id }
  },

  // Without an adjudicatorId, creates PINs for everyone who has none; with one, replaces that PIN
  generatePins(ctx: Ctx, competitionId: string, adjudicatorId?: string): AdjudicatorPin[] {
    const competition = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, competitionId)).get(), 'Competition')
    const inCompetition = () => ctx.db.select().from(t.adjudicatorPins).where(eq(t.adjudicatorPins.competitionId, competitionId)).all()
    const taken = new Set(inCompetition().map((p) => p.pin))
    const nextPin = () => {
      for (;;) {
        const pin = String(randomInt(1000, 10000))
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

  approvePayment(ctx: Ctx, id: string): PaymentDetail {
    const payment = checkable(ctx, id)
    ctx.db
      .update(t.payments)
      .set({ status: PaymentStatus.Approved, rejectionReason: null, checkedBy: actor(ctx).id, checkedAt: now() })
      .where(eq(t.payments.id, id))
      .run()
    const detail = paymentDetail(ctx, getPaymentRow(ctx, id))
    record(ctx.db, actor(ctx).id, 'Approved payment', detail.clubName, { before: { status: payment.status }, after: { status: PaymentStatus.Approved } })
    return detail
  },

  rejectPayment(ctx: Ctx, id: string, reason: string): PaymentDetail {
    const payment = checkable(ctx, id)
    const trimmed = clean(reason)
    if (!trimmed) return fail('Give a reason so the club knows what to fix.')
    ctx.db
      .update(t.payments)
      .set({ status: PaymentStatus.Rejected, rejectionReason: trimmed, checkedBy: actor(ctx).id, checkedAt: now() })
      .where(eq(t.payments.id, id))
      .run()
    const detail = paymentDetail(ctx, getPaymentRow(ctx, id))
    record(ctx.db, actor(ctx).id, 'Rejected payment', detail.clubName, { before: { status: payment.status }, after: { status: PaymentStatus.Rejected, reason: trimmed } })
    return detail
  },
}

function checkable(ctx: Ctx, id: string) {
  const payment = getPaymentRow(ctx, id)
  if (payment.status !== PaymentStatus.ForChecking) return fail('Only payments waiting to be checked can be decided.', 409)
  return payment
}
