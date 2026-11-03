import { PayMethod, Role, type AthleteNotification, type PaymentMethod, type EntryRequest, type EntryRequestInput, type MemberRosterRow, type RegistrationQuote } from '@bis/shared'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { readPaymentSettings } from '../paymentSettings.ts'
import { enterCompetitor, quote } from './registration.ts'
import { checkEligible, checkNotStarted } from './secretariat.ts'
import { MAX_RECEIPT, PHOTO, clean, getCompetitorRow, getEventRow } from './shared.ts'

const ONLINE: PayMethod[] = [PayMethod.GCash, PayMethod.Maya, PayMethod.Bank]
const normal = (name: string) => name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()

type Requester = { id: string; role: 'team' | 'athlete'; name: string }

// Who is asking, and which dancers they may enter: a team its team's dancers, an athlete the couples and solos that carry their name
function requester(ctx: Ctx): Requester {
  const user = actor(ctx)
  if (user.role === Role.Team) return { id: user.id, role: 'team', name: user.name }
  if (user.role === Role.Athlete) return { id: user.id, role: 'athlete', name: user.name }
  return fail('Only a team or an athlete can send an entry request.', 403)
}

function mayEnter(ctx: Ctx, who: Requester, competitor: typeof t.competitors.$inferSelect): boolean {
  if (who.role === 'athlete') {
    const me = normal(ctx.db.select({ name: t.athletes.name }).from(t.athletes).where(eq(t.athletes.id, who.id)).get()?.name ?? who.name)
    return competitor.names.some((n) => normal(n) === me)
  }
  const member = ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.id, who.id)).get()
  return Boolean(member?.linkedId) && competitor.teamId === member?.linkedId
}

function mine(ctx: Ctx, competitorId: string) {
  const who = requester(ctx)
  const competitor = getCompetitorRow(ctx, competitorId)
  if (!mayEnter(ctx, who, competitor)) return fail('You can only enter your own dancers.', 403)
  return { who, competitor }
}

const toRow = (ctx: Ctx, r: typeof t.entryRequests.$inferSelect, withReceipt: boolean): EntryRequest => {
  const competitor = ctx.db.select({ names: t.competitors.names }).from(t.competitors).where(eq(t.competitors.id, r.competitorId)).get()
  const competition = ctx.db.select({ name: t.competitions.name }).from(t.competitions).where(eq(t.competitions.id, r.competitionId)).get()
  const events = r.eventIds.length === 0 ? [] : ctx.db.select({ number: t.events.number }).from(t.events).where(inArray(t.events.id, r.eventIds)).all()
  return {
    id: r.id,
    competitorId: r.competitorId,
    names: competitor?.names ?? [],
    competitionId: r.competitionId,
    competitionName: competition?.name ?? '',
    eventNumbers: events.map((e) => e.number).sort((a, b) => a - b),
    total: r.total,
    warnings: r.warnings,
    method: r.method,
    reference: r.reference,
    status: r.status,
    rejectedReason: r.rejectedReason,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
    requesterRole: r.requesterRole,
    requesterName: r.requesterName,
    ...(withReceipt ? { receipt: r.receipt } : {}),
  }
}

// Tells whoever sent the request what was decided: a team through its account, an athlete through theirs
function tell(ctx: Ctx, r: typeof t.entryRequests.$inferSelect, note: Pick<AthleteNotification, 'kind' | 'title' | 'detail' | 'link'>) {
  const row = { id: newId(), ...note, createdAt: now(), readAt: null }
  if (r.requesterRole === 'team') ctx.db.insert(t.memberNotifications).values({ ...row, memberId: r.requesterId }).run()
  else ctx.db.insert(t.notifications).values({ ...row, athleteId: r.requesterId }).run()
  ctx.defer(() => ctx.hub.notify(r.requesterId))
}

const base = (r: { requesterRole: 'team' | 'athlete' }) => (r.requesterRole === 'team' ? '/team' : '/athlete')

export const entryRequests = {
  // The dancers and couples the signed-in team or athlete may enter
  getMyEntrants(ctx: Ctx): MemberRosterRow[] {
    const who = requester(ctx)
    const teams = new Map(ctx.db.select().from(t.teams).all().map((c) => [c.id, c.name]))
    const counts = new Map<string, number>()
    for (const e of ctx.db.select().from(t.entries).where(eq(t.entries.scratched, false)).all()) counts.set(e.competitorId, (counts.get(e.competitorId) ?? 0) + 1)
    return ctx.db
      .select()
      .from(t.competitors)
      .all()
      .filter((c) => mayEnter(ctx, who, c))
      .map((c) => ({ competitorId: c.id, names: c.names, ageGroup: c.ageGroup, backNumber: c.backNumber, teamName: teams.get(c.teamId) ?? '', entries: counts.get(c.id) ?? 0 }))
      .sort((a, b) => (a.names[0] ?? '').localeCompare(b.names[0] ?? ''))
  },

  // Where to send the money, as the organizer set it
  getEntryPaymentMethods(ctx: Ctx): PaymentMethod[] {
    requester(ctx)
    return readPaymentSettings(ctx.sqlite).methods
  },

  quoteMyEntries(ctx: Ctx, competitorId: string, eventIds: string[]): RegistrationQuote {
    mine(ctx, competitorId)
    const { lines, total, warnings } = quote(ctx, competitorId, eventIds)
    return { lines, total, warnings }
  },

  submitEntryRequest(ctx: Ctx, input: EntryRequestInput): EntryRequest {
    const { who, competitor } = mine(ctx, input?.competitorId)
    if (!ONLINE.includes(input.method)) return fail('Choose GCash, Maya or bank. Cash is paid at the venue.')
    const receipt = typeof input.receipt === 'string' ? input.receipt : ''
    if (!receipt) return fail('Send a screenshot of your payment.')
    if (!PHOTO.test(receipt) || receipt.length > MAX_RECEIPT) return fail('Send the screenshot as a JPEG, PNG or WebP picture.')
    const reference = clean(input.reference).slice(0, 60)
    const eventIds = [...new Set(Array.isArray(input.eventIds) ? input.eventIds.map(String) : [])]
    const priced = quote(ctx, competitor.id, eventIds)
    for (const id of eventIds) {
      const event = getEventRow(ctx, id)
      checkEligible(ctx, competitor.id, event)
      if (ctx.db.select().from(t.entries).where(and(eq(t.entries.eventId, id), eq(t.entries.competitorId, competitor.id))).get()) {
        return fail(`Already entered in E${event.number}.`, 409)
      }
      checkNotStarted(ctx, id)
    }
    const waiting = ctx.db.select().from(t.entryRequests).where(and(eq(t.entryRequests.competitorId, competitor.id), eq(t.entryRequests.status, 'waiting'))).all()
    if (waiting.some((r) => r.eventIds.some((id) => eventIds.includes(id)))) return fail('An entry request for one of these events is already waiting.', 409)

    const row: typeof t.entryRequests.$inferInsert = {
      id: newId(),
      requesterId: who.id,
      requesterRole: who.role,
      requesterName: who.name,
      competitorId: competitor.id,
      competitionId: getEventRow(ctx, eventIds[0]!).competitionId,
      eventIds,
      total: priced.total,
      warnings: priced.warnings,
      method: input.method,
      reference,
      receipt,
      status: 'waiting',
      rejectedReason: null,
      createdAt: now(),
      decidedAt: null,
      decidedBy: null,
    }
    ctx.db.insert(t.entryRequests).values(row).run()
    ctx.defer(() => ctx.hub.alert([Role.Secretariat], { title: 'New entry request', detail: `${competitor.names.join(' & ')} · ${who.name}`, link: '/secretariat/entry-requests' }))
    record(ctx.db, who.id, 'Sent an entry request', competitor.names.join(' & '), { after: { events: eventIds.length, total: priced.total } })
    return toRow(ctx, row as typeof t.entryRequests.$inferSelect, false)
  },

  // Their own requests, newest first; the screenshot stays out of the list
  getMyEntryRequests(ctx: Ctx): EntryRequest[] {
    const who = requester(ctx)
    return ctx.db
      .select()
      .from(t.entryRequests)
      .where(eq(t.entryRequests.requesterId, who.id))
      .orderBy(desc(t.entryRequests.createdAt))
      .all()
      .map((r) => toRow(ctx, r, false))
  },

  cancelEntryRequest(ctx: Ctx, id: string): void {
    const who = requester(ctx)
    const row = found(ctx.db.select().from(t.entryRequests).where(and(eq(t.entryRequests.id, id), eq(t.entryRequests.requesterId, who.id))).get(), 'Entry request')
    if (row.status !== 'waiting') return fail('This request was already decided.', 409)
    ctx.db.delete(t.entryRequests).where(eq(t.entryRequests.id, row.id)).run()
  },

  // ---- The secretariat's side ----

  getEntryRequests(ctx: Ctx): EntryRequest[] {
    return ctx.db
      .select()
      .from(t.entryRequests)
      .orderBy(desc(t.entryRequests.createdAt))
      .all()
      .map((r) => toRow(ctx, r, true))
      .sort((a, b) => Number(b.status === 'waiting') - Number(a.status === 'waiting'))
  },

  // The screenshot checks out: the entries and the payment are made, with the receipt kept on the payment
  approveEntryRequest(ctx: Ctx, id: string): EntryRequest[] {
    const row = found(ctx.db.select().from(t.entryRequests).where(eq(t.entryRequests.id, id)).get(), 'Entry request')
    if (row.status !== 'waiting') return fail('This request was already decided.', 409)
    const result = enterCompetitor(ctx, { competitorId: row.competitorId, eventIds: row.eventIds, method: row.method, reference: row.reference }, row.receipt)
    ctx.db.update(t.entryRequests).set({ status: 'approved', decidedAt: now(), decidedBy: actor(ctx).id }).where(eq(t.entryRequests.id, row.id)).run()
    record(ctx.db, actor(ctx).id, 'Approved an entry request', row.requesterName, { after: { paymentId: result.paymentId, total: result.total } })
    tell(ctx, row, { kind: 'entry_approved', title: 'Your entry was approved', detail: `${row.eventIds.length} ${row.eventIds.length === 1 ? 'event' : 'events'} entered. Your payment was received.`, link: `${base(row)}/entries` })
    return entryRequests.getEntryRequests(ctx)
  },

  rejectEntryRequest(ctx: Ctx, id: string, reason: string): EntryRequest[] {
    const row = found(ctx.db.select().from(t.entryRequests).where(eq(t.entryRequests.id, id)).get(), 'Entry request')
    if (row.status !== 'waiting') return fail('This request was already decided.', 409)
    const rejectedReason = clean(reason).slice(0, 200)
    if (!rejectedReason) return fail('Say why it is turned down, so they can fix it.')
    ctx.db.update(t.entryRequests).set({ status: 'rejected', rejectedReason, decidedAt: now(), decidedBy: actor(ctx).id }).where(eq(t.entryRequests.id, row.id)).run()
    record(ctx.db, actor(ctx).id, 'Turned down an entry request', row.requesterName, { before: { rejectedReason } })
    tell(ctx, row, { kind: 'entry_rejected', title: 'Your entry was not approved', detail: rejectedReason, link: `${base(row)}/register` })
    return entryRequests.getEntryRequests(ctx)
  },
}
