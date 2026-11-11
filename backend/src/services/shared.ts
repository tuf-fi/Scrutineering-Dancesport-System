import {
  pickCurrentCompetition,
  Role,
  RoundStatus,
  type AdjudicatorPin,
  type AgeGroupDef,
  type Catalog,
  byAge,
  type EventKindDef,
  type Team,
  type Competition,
  type Competitor,
  type CompetitorDetails,
  type Gender,
  type Entry,
  type Event,
  type Heat,
  type Mark,
  type Panel,
  type Payment,
  type PaymentDetail,
  type PointsRow,
  type RankingPoint,
  type Result,
  type Round,
  type StaffUser,
} from '@bis/shared'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { readPaymentSettings } from '../paymentSettings.ts'

export const toCompetition = (r: typeof t.competitions.$inferSelect): Competition => ({
  id: r.id,
  name: r.name,
  date: r.date,
  venue: r.venue,
  organizer: r.organizer,
  ...(r.executor ? { executor: r.executor } : {}),
  ...(r.entryDeadline ? { entryDeadline: r.entryDeadline } : {}),
  ...(r.feeDeadline ? { feeDeadline: r.feeDeadline } : {}),
  ...(r.image ? { image: r.image } : {}),
  usesPoints: r.usesPoints,
  paymentRequired: r.paymentRequired,
})

export const toEvent = (r: typeof t.events.$inferSelect): Event => ({
  id: r.id,
  competitionId: r.competitionId,
  number: r.number,
  ageGroup: r.ageGroup,
  class: r.class,
  discipline: r.discipline,
  dances: r.dances,
  isSolo: r.isSolo,
  kind: r.kind,
  ...(r.province ? { province: r.province } : {}),
  ...(r.syllabus ? { syllabus: r.syllabus } : {}),
})

// The password hash never leaves the server
export const toTeam = (r: typeof t.teams.$inferSelect): Team => ({
  id: r.id,
  name: r.name,
  contactName: r.contactName,
  contactEmail: r.contactEmail,
  contactPhone: r.contactPhone,
})

export const toCompetitor = (r: typeof t.competitors.$inferSelect): Competitor => ({
  id: r.id,
  names: r.names,
  backNumber: r.backNumber,
  teamId: r.teamId,
  ...(r.details ? { details: r.details } : {}),
})

export const toEntry = (r: typeof t.entries.$inferSelect): Entry => ({
  id: r.id,
  eventId: r.eventId,
  competitorId: r.competitorId,
  scratched: r.scratched,
  paymentId: r.paymentId,
  late: r.late,
})

export const toRound = (r: typeof t.rounds.$inferSelect): Round => ({
  id: r.id,
  eventId: r.eventId,
  type: r.type,
  recallNumber: r.recallNumber,
  status: r.status,
})

export const toMark = (r: typeof t.marks.$inferSelect): Mark => {
  const base = {
    id: r.id,
    roundId: r.roundId,
    adjudicatorId: r.adjudicatorId,
    competitorId: r.competitorId,
    dance: r.dance,
    submittedAt: r.submittedAt,
  }
  return r.kind === 'placing' ? { ...base, kind: 'placing', placing: r.placing ?? 0 } : { ...base, kind: 'x' }
}

export const toResult = (r: typeof t.results.$inferSelect): Result => ({
  id: r.id,
  eventId: r.eventId,
  competitorId: r.competitorId,
  place: r.place,
  placeFrom: r.placeFrom,
  placeTo: r.placeTo,
  approvedBy: r.approvedBy,
  approvedAt: r.approvedAt,
})

export const toRankingPoint = (r: typeof t.rankingPoints.$inferSelect): RankingPoint => ({
  id: r.id,
  competitorId: r.competitorId,
  ageGroup: r.ageGroup,
  class: r.class,
  discipline: r.discipline,
  competitionId: r.competitionId,
  points: r.points,
})

export const toStaff = (r: Pick<typeof t.staffUsers.$inferSelect, 'id' | 'name' | 'username' | 'role'> & { totpEnabled?: boolean; photo?: string | null }): StaffUser => ({
  id: r.id,
  name: r.name,
  username: r.username,
  role: r.role,
  twoStep: r.totpEnabled ?? false,
  photo: r.photo ?? null,
})

// Every account has a picture. It must be a JPEG, PNG or WebP that is small enough to keep
export function checkPhoto(photo: unknown): string {
  if (typeof photo !== 'string' || !photo) return fail('Add a photo.')
  if (!PHOTO.test(photo) || photo.length > MAX_PHOTO) return fail('Send the photo as a JPEG, PNG or WebP picture.')
  return photo
}

export const toPin = (r: typeof t.adjudicatorPins.$inferSelect): AdjudicatorPin => ({
  competitionId: r.competitionId,
  adjudicatorId: r.adjudicatorId,
  pin: r.pin,
})

// The organizer's fee for an event; 0 until they have set fees (registration and late entries refuse to start then)
export function feeFor(ctx: Ctx, event: { isSolo: boolean }): number {
  const fees = readPaymentSettings(ctx.sqlite).fees
  return fees ? (event.isSolo ? fees.solo : fees.couple) : 0
}

// Entries of an event whose payment is not settled; only paid entries may dance
export function unpaidEntries(ctx: Ctx, eventId: string): number {
  const row = ctx.sqlite
    .prepare(
      `SELECT count(*) AS n FROM entries e JOIN payments p ON p.id = e.payment_id
       WHERE e.event_id = ? AND e.scratched = 0 AND p.status IN ('unpaid', 'for_checking', 'rejected')`,
    )
    .get(eventId) as { n: number }
  return row.n
}

export function assertFeesSet(ctx: Ctx) {
  if (!readPaymentSettings(ctx.sqlite).fees) fail('The organizer has not set the entry fees yet, so entries are closed.', 409)
}

export const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

// The entry form's details for a competitor, with every field present; null when none were sent
export function cleanDetails(ctx: Ctx, names: string[], input: unknown): CompetitorDetails | null {
  if (input === undefined || input === null) return null
  const d = input as Partial<CompetitorDetails>
  const dancers = names.map((_, i) => {
    const x = d.dancers?.[i]
    const birthDate = clean(x?.birthDate)
    if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return fail('Enter each date of birth as year-month-day.')
    const gender: Gender | '' = x?.gender === 'female' || x?.gender === 'male' ? x.gender : ''
    return { birthDate, gender, address: clean(x?.address), email: clean(x?.email), phone: clean(x?.phone) }
  })
  const coachId = clean(d.coachId) || null
  if (coachId) found(ctx.db.select().from(t.coaches).where(eq(t.coaches.id, coachId)).get(), 'Coach')
  const memberYear = Number.isInteger(d.memberYear) && (d.memberYear as number) > 2000 ? (d.memberYear as number) : null
  const memberMonth = memberYear !== null && Number.isInteger(d.memberMonth) && (d.memberMonth as number) >= 1 && (d.memberMonth as number) <= 12 ? (d.memberMonth as number) : null
  return { province: clean(d.province), coachId, dancers, beginner: Boolean(d.beginner), memberYear, memberMonth }
}

export function cleanNames(names: unknown, what = 'competitor'): string[] {
  const list = Array.isArray(names) ? names.map(clean).filter(Boolean) : []
  if (list.length < 1 || list.length > 2) return fail(`A ${what} is one dancer or a couple.`)
  return list
}

export const getEventRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.events).where(eq(t.events.id, id)).get(), 'Event')

export const getRoundRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.rounds).where(eq(t.rounds.id, id)).get(), 'Round')

export const getCompetitorRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.competitors).where(eq(t.competitors.id, id)).get(), 'Competitor')

export const getTeamRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.teams).where(eq(t.teams.id, id)).get(), 'Team')

export const getPaymentRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.payments).where(eq(t.payments.id, id)).get(), 'Payment')

// The competition happening now (see pickCurrentCompetition): PINs belong to it
export function currentCompetition(ctx: Ctx) {
  return pickCurrentCompetition(ctx.db.select().from(t.competitions).all())
}

export const panelAdjudicatorIds = (ctx: Ctx, eventId: string): string[] =>
  ctx.db
    .select({ id: t.adjudicators.id })
    .from(t.panels)
    .innerJoin(t.panelMembers, eq(t.panelMembers.panelId, t.panels.id))
    .innerJoin(t.adjudicators, eq(t.adjudicators.id, t.panelMembers.adjudicatorId))
    .where(eq(t.panels.eventId, eventId))
    .orderBy(asc(t.adjudicators.letter))
    .all()
    .map((r) => r.id)

export const toPanel = (ctx: Ctx, row: typeof t.panels.$inferSelect): Panel => ({
  id: row.id,
  eventId: row.eventId,
  adjudicatorIds: panelAdjudicatorIds(ctx, row.eventId),
})

export const activeEntryRows = (ctx: Ctx, eventId: string) =>
  ctx.db
    .select()
    .from(t.entries)
    .where(and(eq(t.entries.eventId, eventId), eq(t.entries.scratched, false)))
    .all()

export const roundsOfEvent = (ctx: Ctx, eventId: string) =>
  ctx.db.select().from(t.rounds).where(eq(t.rounds.eventId, eventId)).orderBy(asc(t.rounds.position)).all()

export function heatsOfRound(ctx: Ctx, roundId: string): Heat[] {
  const heats = ctx.db.select().from(t.heats).where(eq(t.heats.roundId, roundId)).orderBy(asc(t.heats.number)).all()
  if (heats.length === 0) return []
  const members = ctx.db
    .select()
    .from(t.heatCompetitors)
    .where(inArray(t.heatCompetitors.heatId, heats.map((h) => h.id)))
    .all()
  return heats.map((h) => ({
    id: h.id,
    roundId: h.roundId,
    number: h.number,
    competitorIds: members.filter((m) => m.heatId === h.id).map((m) => m.competitorId),
  }))
}

export const backNumbers = (ctx: Ctx, ids: string[]): Map<string, number | null> =>
  new Map(
    ids.length === 0
      ? []
      : ctx.db
          .select({ id: t.competitors.id, backNumber: t.competitors.backNumber })
          .from(t.competitors)
          .where(inArray(t.competitors.id, ids))
          .all()
          .map((c) => [c.id, c.backNumber]),
  )

const MAX_HEAT = 12

// Splits a field into the fewest even heats of at most 12, lowest back numbers first
export function splitIntoHeats(ctx: Ctx, ids: string[]): string[][] {
  if (ids.length === 0) return []
  const numbers = backNumbers(ctx, ids)
  const sorted = [...ids].sort((a, b) => (numbers.get(a) ?? Infinity) - (numbers.get(b) ?? Infinity))
  const count = Math.ceil(sorted.length / MAX_HEAT)
  const size = Math.ceil(sorted.length / count)
  return Array.from({ length: count }, (_, i) => sorted.slice(i * size, (i + 1) * size))
}

export function saveHeats(ctx: Ctx, roundId: string, groups: string[][]) {
  ctx.db.delete(t.heats).where(eq(t.heats.roundId, roundId)).run()
  groups.forEach((competitorIds, i) => {
    const id = `${roundId}:h${i + 1}`
    ctx.db.insert(t.heats).values({ id, roundId, number: i + 1 }).run()
    for (const competitorId of competitorIds) ctx.db.insert(t.heatCompetitors).values({ heatId: id, competitorId }).run()
  })
}

export const roundAdvanced = (status: RoundStatus) =>
  status === RoundStatus.Approved || status === RoundStatus.Published

// The competitors in a round: its saved heats; else everyone entered (first round) or whoever the
// previous round recalled, once that round is decided
export function fieldOf(ctx: Ctx, round: typeof t.rounds.$inferSelect): string[] {
  const saved = heatsOfRound(ctx, round.id).flatMap((h) => h.competitorIds)
  if (saved.length > 0) return saved
  const previous = roundsOfEvent(ctx, round.eventId).find((r) => r.position === round.position - 1)
  if (!previous) return activeEntryRows(ctx, round.eventId).map((e) => e.competitorId)
  return []
}

// Which rounds an event of this size needs, and how many each recalls
export function planFor(entryCount: number): Array<{ type: typeof t.rounds.$inferInsert.type; recall: number | null }> {
  const final = { type: 'final' as const, recall: null }
  const semi = { type: 'semi_final' as const, recall: 6 }
  // The client's finals have 6 couples ("select 6"), so 7 entries already need a semi-final
  if (entryCount <= 6) return [final]
  if (entryCount <= 14) return [semi, final]
  if (entryCount <= 24) return [{ type: 'round_1' as const, recall: 12 }, semi, final]
  return [{ type: 'round_1' as const, recall: 24 }, { type: 'round_2' as const, recall: 12 }, semi, final]
}

export function paymentDetail(ctx: Ctx, row: typeof t.payments.$inferSelect): PaymentDetail {
  const lines = ctx.db
    .select({
      entryId: t.entries.id,
      eventId: t.events.id,
      eventNumber: t.events.number,
      dances: t.events.dances,
      isSolo: t.events.isSolo,
      names: t.competitors.names,
    })
    .from(t.entries)
    .innerJoin(t.events, eq(t.events.id, t.entries.eventId))
    .innerJoin(t.competitors, eq(t.competitors.id, t.entries.competitorId))
    .where(eq(t.entries.paymentId, row.id))
    .all()
  const team = ctx.db.select().from(t.teams).where(eq(t.teams.id, row.teamId)).get()
  const payment: Payment = {
    id: row.id,
    teamId: row.teamId,
    entryIds: lines.map((l) => l.entryId),
    amountDue: row.amountDue,
    amountPaid: row.amountPaid,
    referenceNumber: row.referenceNumber,
    receiptUrl: null,
    status: row.status,
    rejectionReason: row.rejectionReason,
    checkedBy: row.checkedBy,
    checkedAt: row.checkedAt,
  }
  return {
    ...payment,
    teamName: team?.name ?? 'Unknown team',
    lines: lines.map((l) => ({
      entryId: l.entryId,
      eventId: l.eventId,
      eventNumber: l.eventNumber,
      dances: l.dances,
      competitorNames: l.names,
      fee: feeFor(ctx, l),
    })),
  }
}

const toKind = (r: typeof t.eventKinds.$inferSelect): EventKindDef => ({
  id: r.id,
  name: r.name,
  feeMode: r.feeMode,
  beginnersOnly: r.beginnersOnly,
  closedToProvince: r.closedToProvince,
  disciplines: r.disciplines,
  requires: r.requires,
})

const toAgeGroup = (r: typeof t.ageGroups.$inferSelect): AgeGroupDef => ({
  id: r.id,
  name: r.name,
  short: r.short,
  bornFrom: r.bornFrom,
  bornTo: r.bornTo,
  juvenileFee: r.juvenileFee,
  ...(r.retired ? { retired: true } : {}),
  family: r.family ?? r.id,
})

// The kinds in the order the admin keeps them, and the age groups from the youngest to the oldest
export const catalogOf = (ctx: Ctx): Catalog => ({
  kinds: ctx.db.select().from(t.eventKinds).orderBy(asc(t.eventKinds.sortOrder)).all().map(toKind),
  classes: ctx.db.select().from(t.eventClasses).orderBy(asc(t.eventClasses.sortOrder)).all().map((c) => ({ name: c.name })),
  ageGroups: ctx.db
    .select()
    .from(t.ageGroups)
    .all()
    .map(toAgeGroup)
    .sort(byAge),
})

export const pointsRows = (ctx: Ctx): PointsRow[] =>
  ctx.db
    .select()
    .from(t.pointsTable)
    .orderBy(asc(t.pointsTable.sortOrder))
    .all()
    .map((r) => ({ place: r.place, ...(r.round ? { round: r.round } : {}), label: r.label, points: r.points }))

// Once a payment is paid, the memberships it covered count for the year
// A membership ID is given once, the first time the membership fee is paid: A-00001 for an athlete, C-00001 for a coach.
// The number runs on from the highest one given.
export function nextMembershipId(ctx: Ctx, kind: 'athlete' | 'coach'): string {
  // An athlete number also counts the records added before an account exists
  const [table, prefix] = kind === 'athlete' ? ['(SELECT membership_id FROM athletes UNION ALL SELECT membership_id FROM athlete_records)', 'A'] : ['coaches', 'C']
  const row = ctx.sqlite.prepare(`SELECT max(CAST(substr(membership_id, 3) AS INTEGER)) AS n FROM ${table} WHERE membership_id LIKE ?`).get(`${prefix}-%`) as { n: number | null }
  return `${prefix}-${String((row.n ?? 0) + 1).padStart(5, '0')}`
}

export function giveAthleteMembershipId(ctx: Ctx, athleteId: string): string | null {
  const row = ctx.db.select().from(t.athletes).where(eq(t.athletes.id, athleteId)).get()
  if (!row || row.memberYear === null) return row?.membershipId ?? null
  if (row.membershipId) return row.membershipId
  const membershipId = nextMembershipId(ctx, 'athlete')
  ctx.db.update(t.athletes).set({ membershipId }).where(eq(t.athletes.id, athleteId)).run()
  return membershipId
}

export function giveCoachMembershipId(ctx: Ctx, coachId: string): string | null {
  const row = ctx.db.select().from(t.coaches).where(eq(t.coaches.id, coachId)).get()
  if (!row || row.memberYear === null) return row?.membershipId ?? null
  if (row.membershipId) return row.membershipId
  const membershipId = nextMembershipId(ctx, 'coach')
  ctx.db.update(t.coaches).set({ membershipId }).where(eq(t.coaches.id, coachId)).run()
  return membershipId
}

export function applySettles(ctx: Ctx, paymentId: string) {
  const settles = getPaymentRow(ctx, paymentId).settles
  if (!settles) return
  if (settles.competitorId) {
    const competitor = ctx.db.select().from(t.competitors).where(eq(t.competitors.id, settles.competitorId)).get()
    if (competitor) {
      const details: CompetitorDetails = competitor.details ?? { province: '', coachId: null, dancers: [], beginner: false, memberYear: null }
      ctx.db.update(t.competitors).set({ details: { ...details, memberYear: settles.year } }).where(eq(t.competitors.id, competitor.id)).run()
    }
  }
  if (settles.coachId) {
    const set: { memberYear?: number; summitYear?: number } = {}
    if (settles.coachMembership) set.memberYear = settles.year
    if (settles.coachSummit) set.summitYear = settles.year
    if (Object.keys(set).length > 0) ctx.db.update(t.coaches).set(set).where(eq(t.coaches.id, settles.coachId)).run()
    if (set.memberYear !== undefined) giveCoachMembershipId(ctx, settles.coachId)
  }
}

const STAFF_ROLES: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Compere, Role.Barker]
export const isStaff = (ctx: Ctx) => ctx.user !== null && STAFF_ROLES.includes(ctx.user.role)

// Events whose final has not been published yet: only staff may see their results
export function hiddenEventIds(ctx: Ctx): Set<string> {
  if (isStaff(ctx)) return new Set()
  return new Set(
    ctx.db
      .select({ eventId: t.rounds.eventId })
      .from(t.rounds)
      .where(and(eq(t.rounds.type, 'final'), inArray(t.rounds.status, ['pending', 'marking', 'review', 'approved'])))
      .all()
      .map((r) => r.eventId),
  )
}

// The shortest password an athlete, coach or team can choose
export const MIN_PASSWORD = 8

// A profile picture: a small JPEG, PNG or WebP as a data URL
export const PHOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/
export const MAX_PHOTO = 400_000

// A payment screenshot, as a data URL
export const MAX_RECEIPT = 1_500_000
