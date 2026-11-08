import type {
  AgeGroup,
  Adjudicator,
  AdjudicatorPin,
  AuditEntry,
  Team,
  Competition,
  Class,
  Competitor,
  Dance,
  Discipline,
  Entry,
  Event,
  Heat,
  Mark,
  Panel,
  Payment,
  PointsRow,
  RankingPoint,
  Result,
  Round,
  RoundType,
  StaffUser,
} from '@bis/shared'
import { DEFAULT_FEE_SCHEDULE, ageGroupForBirthYears, registrationFee, samplePhoto } from '@bis/shared'
import { eq } from 'drizzle-orm'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from '../auth/password.ts'
import { newId } from '../ids.ts'
import type { Db } from './client.ts'
import * as t from './schema.ts'

interface SampleData {
  currentCompetitionId: string
  liveRoundId: string
  competitions: Competition[]
  teams: Team[]
  competitors: Array<Competitor & { ageGroup: (typeof t.competitors.$inferInsert)['ageGroup'] }>
  events: Event[]
  entries: Entry[]
  payments: Payment[]
  adjudicators: Adjudicator[]
  adjudicatorPins: AdjudicatorPin[]
  panels: Panel[]
  rounds: Round[]
  heats: Heat[]
  marks: Mark[]
  results: Result[]
  pointsTable: PointsRow[]
  rankingPoints: RankingPoint[]
  staffUsers: StaffUser[]
  auditLog: AuditEntry[]
}

// Every competition has a card photo. The sample ones use the website's dance photo, or a plain picture if it is not there.
const DANCE_PHOTO = join(import.meta.dirname, '..', '..', '..', 'frontend', 'public', 'auth-dance.jpg')
export const sampleCompetitionImage = () =>
  existsSync(DANCE_PHOTO) ? `data:image/jpeg;base64,${readFileSync(DANCE_PHOTO).toString('base64')}` : samplePhoto('competition')

// Everyone who signs in to the sample data uses this password. For demos and development only.
export const SAMPLE_PASSWORD = 'bis2026'

// The sample athlete account, so the athlete screens can be tried without signing up
export const SAMPLE_ATHLETE_EMAIL = 'athlete@sample.example'

const snapshotPath = join(import.meta.dirname, '..', '..', 'seed', 'sample-data.json')

// SQLite allows about 32,000 values in one statement
function insertAll<T>(rows: T[], insert: (batch: T[]) => void, size = 400) {
  for (let i = 0; i < rows.length; i += size) insert(rows.slice(i, i + size))
}

export function hasData(db: Db): boolean {
  return db.select().from(t.competitions).limit(1).all().length > 0
}

// Loads the same sample competition the frontend shows, so the real app can be tried before real data exists
const SAMPLE_PAYMENT_SETTINGS = {
  fees: { solo: 500, couple: 800 },
  methods: [
    { name: 'GCash', accountName: 'BIS', number: '0917 000 0000' },
    { name: 'Maya', accountName: 'BIS', number: '0918 000 0000' },
    { name: 'Bank transfer', accountName: 'BIS', number: '0000 0000 0000', note: 'BDO Savings, Sorsogon branch' },
  ],
}

// The sample coach and team accounts, so their screens can be tried without signing up
export const SAMPLE_COACH_EMAIL = 'coach@sample.example'
export const SAMPLE_TEAM_EMAIL = 'team@sample.example'

export function addSampleMembers(db: Pick<Db, 'insert'>, passwordHash: string) {
  db.insert(t.memberAccounts)
    .values([
      { id: 'member-sample-coach', role: 'coach', name: 'Rico Bautista', email: SAMPLE_COACH_EMAIL, photo: samplePhoto('Rico Bautista'), passwordHash },
      { id: 'member-sample-team', role: 'team', name: 'Sample Dance Team', email: SAMPLE_TEAM_EMAIL, photo: samplePhoto('Sample Dance Team'), passwordHash },
    ])
    .onConflictDoNothing()
    .run()
}

// Also used on a database that was seeded before the sample athlete existed
export function addSampleAthlete(db: Pick<Db, 'insert'>, passwordHash: string, teamId: string | null) {
  db.insert(t.athletes)
    .values({ id: 'athlete-sample', name: 'Ana Cruz', email: SAMPLE_ATHLETE_EMAIL, photo: samplePhoto('Ana Cruz'), passwordHash, teamId })
    .onConflictDoNothing()
    .run()
}

// Future dates so the home page has upcoming events to show. The seed command adds them; the tests' seed leaves them out.
const SAMPLE_UPCOMING = [
  { id: 'comp-bicol-2026', name: 'Bicol Dancesport Championships 2026', date: '2026-12-05', venue: 'Albay Astrodome, Legazpi City', organizer: 'BN IT Scrutineer' },
  { id: 'comp-naga-2027', name: 'Naga Dancesport Invitational 2027', date: '2027-02-20', venue: 'Naga City Coliseum, Naga City', organizer: 'Camarines Sur Dancesport Association' },
  { id: 'comp-sorsogon-2027', name: 'Sorsogon Dancesport Open 2027', date: '2027-10-09', venue: 'Sorsogon Provincial Gymnasium, Sorsogon City', organizer: 'BN IT Scrutineer' },
]

// A handful of events per upcoming competition, so the events list and the program are not empty
const SAMPLE_UPCOMING_EVENTS: Array<{ ageGroup: AgeGroup; class: Class; discipline: Discipline; dances: Dance[] }> = [
  { ageGroup: 'juvenile_1', class: 'E1', discipline: 'latin', dances: ['samba', 'cha_cha_cha'] },
  { ageGroup: 'juvenile_2', class: 'D', discipline: 'latin', dances: ['cha_cha_cha', 'rumba', 'jive'] },
  { ageGroup: 'junior_1', class: 'D', discipline: 'standard', dances: ['waltz', 'quickstep'] },
  { ageGroup: 'junior_2', class: 'C', discipline: 'latin', dances: ['samba', 'cha_cha_cha', 'rumba', 'jive'] },
  { ageGroup: 'youth', class: 'C', discipline: 'standard', dances: ['waltz', 'tango', 'quickstep'] },
  { ageGroup: 'adult', class: 'B', discipline: 'latin', dances: ['samba', 'cha_cha_cha', 'rumba', 'paso_doble', 'jive'] },
  { ageGroup: 'adult', class: 'A', discipline: 'standard', dances: ['waltz', 'tango', 'viennese_waltz', 'foxtrot', 'quickstep'] },
  { ageGroup: 'senior', class: 'B', discipline: 'standard', dances: ['waltz', 'foxtrot', 'quickstep'] },
]

export function addSampleUpcoming(db: Pick<Db, 'insert'>) {
  db.insert(t.competitions).values(SAMPLE_UPCOMING.map((c) => ({ ...c, image: sampleCompetitionImage() }))).onConflictDoNothing().run()

  for (const c of SAMPLE_UPCOMING) {
    const events = SAMPLE_UPCOMING_EVENTS.map((e, i) => ({
      ...e,
      id: `${c.id}:e${i + 1}`,
      competitionId: c.id,
      number: i + 1,
      position: i + 1,
      isSolo: false,
    }))
    db.insert(t.events).values(events).onConflictDoNothing().run()

    // Each event's final, with lunch halfway and the awarding last
    const lines = [
      ...events.slice(0, 4).map((e) => ({ eventId: e.id, roundType: 'final' as const, label: null, kind: 'round' as const, minutes: 15 })),
      { eventId: null, roundType: null, label: 'Lunch', kind: 'break' as const, minutes: 45 },
      ...events.slice(4).map((e) => ({ eventId: e.id, roundType: 'final' as const, label: null, kind: 'round' as const, minutes: 20 })),
      { eventId: null, roundType: null, label: 'Awarding', kind: 'awarding' as const, minutes: 30 },
    ]
    db.insert(t.programSlots)
      .values(lines.map((l, i) => ({ ...l, id: `${c.id}:slot${i + 1}`, competitionId: c.id, sequence: i + 1 })))
      .onConflictDoNothing()
      .run()
    db.insert(t.programStarts).values({ competitionId: c.id, start: '08:00' }).onConflictDoNothing().run()
  }
}

export function seedSampleData(db: Db) {
  const data = JSON.parse(readFileSync(snapshotPath, 'utf8')) as SampleData
  const passwordHash = hashPassword(SAMPLE_PASSWORD)
  const competition = (id: string) => data.competitions.find((c) => c.id === id)

  // Sample fees and accounts; a real server has the organizer enter their own
  db.insert(t.settings).values({ key: 'payment_settings', value: JSON.stringify(SAMPLE_PAYMENT_SETTINGS) }).onConflictDoNothing().run()

  db.transaction((tx) => {
    insertAll(data.competitions, (batch) =>
      tx.insert(t.competitions).values(batch.map((c) => ({ ...c, image: sampleCompetitionImage(), floorRoundId: c.id === data.currentCompetitionId ? data.liveRoundId : null }))).run(),
    )
    insertAll(data.teams, (batch) => tx.insert(t.teams).values(batch).run())
    insertAll(data.competitors, (batch) => tx.insert(t.competitors).values(batch).run())

    // Events run in event-number order until the secretariat moves them
    const position = new Map<string, number>()
    const eventRows = [...data.events]
      .sort((a, b) => a.competitionId.localeCompare(b.competitionId) || a.number - b.number)
      .map((e) => {
        const next = (position.get(e.competitionId) ?? 0) + 1
        position.set(e.competitionId, next)
        return { ...e, position: next }
      })
    insertAll(eventRows, (batch) => tx.insert(t.events).values(batch).run())

    insertAll(data.payments, (batch) =>
      tx
        .insert(t.payments)
        .values(
          batch.map((p) => ({
            id: p.id,
            teamId: p.teamId,
            competitionId: data.currentCompetitionId,
            late: p.id.startsWith('pay-late-'),
            amountDue: p.amountDue,
            amountPaid: p.amountPaid,
            referenceNumber: p.referenceNumber,
            receipt: p.receiptUrl,
            status: p.status,
            rejectionReason: p.rejectionReason,
            checkedBy: p.checkedBy,
            checkedAt: p.checkedAt,
          })),
        )
        .run(),
    )
    insertAll(data.entries, (batch) =>
      tx.insert(t.entries).values(batch.map((e) => ({ id: e.id, eventId: e.eventId, competitorId: e.competitorId, scratched: e.scratched, paymentId: e.paymentId, late: e.late ?? false }))).run(),
    )

    insertAll(data.adjudicators, (batch) => tx.insert(t.adjudicators).values(batch).run())
    insertAll(data.adjudicatorPins, (batch) => tx.insert(t.adjudicatorPins).values(batch).run())
    insertAll(data.panels, (batch) => tx.insert(t.panels).values(batch.map((p) => ({ id: p.id, eventId: p.eventId }))).run())
    insertAll(data.panels.flatMap((p) => p.adjudicatorIds.map((adjudicatorId) => ({ panelId: p.id, adjudicatorId }))), (batch) =>
      tx.insert(t.panelMembers).values(batch).run(),
    )

    // Rounds are numbered within their event in the order the sample lists them
    const place = new Map<string, number>()
    const eventNumber = new Map(data.events.map((e) => [e.id, e.number]))
    const roundRows = data.rounds.map((r) => {
      const next = (place.get(r.eventId) ?? 0) + 1
      place.set(r.eventId, next)
      const publishedAt =
        r.status === 'published'
          ? new Date(Date.UTC(2026, 9, 10, 1, 0) + ((eventNumber.get(r.eventId) ?? 0) * 10 + next) * 60_000).toISOString()
          : null
      return { ...r, position: next, publishedAt }
    })
    insertAll(roundRows, (batch) => tx.insert(t.rounds).values(batch).run())

    // A round that has marks always has saved heats; finals are one group of whoever was marked
    const heatsByRound = new Map<string, Heat[]>()
    for (const h of data.heats) heatsByRound.set(h.roundId, [...(heatsByRound.get(h.roundId) ?? []), h])
    const allHeats: Heat[] = [...data.heats]
    for (const r of data.rounds) {
      if (heatsByRound.has(r.id)) continue
      const marked = [...new Set(data.marks.filter((m) => m.roundId === r.id).map((m) => m.competitorId))]
      if (marked.length > 0) {
        const heat = { id: `${r.id}:h1`, roundId: r.id, number: 1, competitorIds: marked }
        allHeats.push(heat)
        heatsByRound.set(r.id, [heat])
      }
    }
    insertAll(allHeats, (batch) => tx.insert(t.heats).values(batch.map((h) => ({ id: h.id, roundId: h.roundId, number: h.number }))).run())
    insertAll(allHeats.flatMap((h) => h.competitorIds.map((competitorId) => ({ heatId: h.id, competitorId }))), (batch) =>
      tx.insert(t.heatCompetitors).values(batch).run(),
    )

    insertAll(data.marks, (batch) =>
      tx
        .insert(t.marks)
        .values(
          batch.map((m) => ({
            id: m.id,
            roundId: m.roundId,
            adjudicatorId: m.adjudicatorId,
            competitorId: m.competitorId,
            dance: m.dance,
            kind: m.kind,
            placing: m.kind === 'placing' ? m.placing : null,
            submittedAt: m.submittedAt,
          })),
        )
        .run(),
    )
    const submitted = new Map<string, { roundId: string; adjudicatorId: string; submittedAt: string }>()
    for (const m of data.marks) {
      const key = `${m.roundId}|${m.adjudicatorId}`
      const seen = submitted.get(key)
      if (!seen || m.submittedAt < seen.submittedAt) submitted.set(key, { roundId: m.roundId, adjudicatorId: m.adjudicatorId, submittedAt: m.submittedAt })
    }
    insertAll([...submitted.values()], (batch) => tx.insert(t.submissions).values(batch).run())

    // Where each competitor went out: the final, or the last round they danced
    const roundsOf = new Map<string, Round[]>()
    for (const r of data.rounds) roundsOf.set(r.eventId, [...(roundsOf.get(r.eventId) ?? []), r])
    const sharing = new Map<string, number>()
    for (const r of data.results) sharing.set(`${r.eventId}|${r.place}`, (sharing.get(`${r.eventId}|${r.place}`) ?? 0) + 1)
    const stageOf = (r: Result): RoundType => {
      const rounds = roundsOf.get(r.eventId) ?? []
      if (rounds.length === 0) return r.place <= 6 ? 'final' : r.place === 7 ? 'semi_final' : 'round_1'
      const inFinal = rounds.find((x) => x.type === 'final')
      if ((heatsByRound.get(inFinal?.id ?? '') ?? []).some((h) => h.competitorIds.includes(r.competitorId))) return 'final'
      const last = [...rounds].reverse().find((x) => (heatsByRound.get(x.id) ?? []).some((h) => h.competitorIds.includes(r.competitorId)))
      return last?.type ?? 'round_1'
    }
    insertAll(data.results, (batch) =>
      tx
        .insert(t.results)
        .values(
          batch.map((r) => ({
            id: r.id,
            eventId: r.eventId,
            competitorId: r.competitorId,
            place: r.place,
            placeFrom: r.place,
            placeTo: r.place + (sharing.get(`${r.eventId}|${r.place}`) ?? 1) - 1,
            stage: stageOf(r),
            approvedBy: r.approvedBy,
            approvedAt: r.approvedAt,
          })),
        )
        .run(),
    )

    // Replaces the default table with the sample's
    tx.delete(t.pointsTable).run()
    insertAll(data.pointsTable, (batch) =>
      tx.insert(t.pointsTable).values(batch.map((p, i) => ({ id: newId(), place: p.place, round: p.round ?? null, label: p.label, points: p.points, sortOrder: i }))).run(),
    )
    const eventOfResult = new Map(data.results.map((r) => [r.id, r.eventId]))
    insertAll(data.rankingPoints, (batch) =>
      tx
        .insert(t.rankingPoints)
        .values(
          batch.flatMap((p) => {
            const eventId = eventOfResult.get(p.id.replace(/^rp:/, ''))
            return eventId && competition(p.competitionId) ? [{ ...p, eventId }] : []
          }),
        )
        .run(),
    )

    insertAll(data.staffUsers, (batch) => tx.insert(t.staffUsers).values(batch.map((s) => ({ ...s, passwordHash, disabled: false }))).run())
    addSampleAthlete(tx, passwordHash, data.teams[0]?.id ?? null)
    addSampleMembers(tx, passwordHash)
    insertAll(data.auditLog, (batch) => tx.insert(t.auditLog).values(batch.map((a) => ({ ...a, before: null, after: null }))).run())
  })
}

// Fills in the sample athlete's whole account, so every screen of it has something to show: details, a coach, past
// payments, notifications, and a competitor with her name that has entries, results and ranking points. Safe to run again.
export function addSampleAthleteData(db: Db) {
  const athlete = db.select().from(t.athletes).where(eq(t.athletes.id, 'athlete-sample')).get()
  if (!athlete) return
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
  const teamId = athlete.teamId ?? db.select().from(t.teams).limit(1).get()?.id ?? null
  if (!teamId) return

  db.insert(t.coaches).values({ id: 'coach-sample', name: 'Rico Bautista', email: 'rico@sample.example', phone: '0917 555 0100', memberYear: 2026, summitYear: 2026 }).onConflictDoNothing().run()
  const coachId = athlete.coachId ?? 'coach-sample'

  // Only what is still blank is filled in, so details the athlete typed themselves stay as they are
  const history = athlete.membershipHistory ?? []
  const patch: Partial<typeof t.athletes.$inferInsert> = {}
  if (!athlete.birthDate) patch.birthDate = '2012-04-18'
  if (!athlete.phone) patch.phone = '0917 555 0142'
  if (!athlete.address) patch.address = 'Zone 3, Barangay Triangulo, Naga City'
  if (!athlete.province) patch.province = 'Camarines Sur'
  if (!athlete.teamId) patch.teamId = teamId
  if (!athlete.coachId) patch.coachId = coachId
  if (history.length === 0) {
    // Last year's membership: paid on the second try, so the history has a turned-down payment in it
    patch.membershipHistory = [
      { at: '2025-01-14T02:10:00.000Z', kind: 'sent', year: 2025, method: 'GCash' },
      { at: '2025-01-15T03:00:00.000Z', kind: 'rejected', year: 2025, method: 'GCash', reason: 'The screenshot did not show the amount' },
      { at: '2025-01-16T01:40:00.000Z', kind: 'sent', year: 2025, method: 'GCash' },
      { at: '2025-01-17T04:20:00.000Z', kind: 'confirmed', year: 2025, method: 'GCash' },
    ]
    if (athlete.memberYear === null) patch.memberYear = 2025
  }
  if (Object.keys(patch).length > 0) db.update(t.athletes).set(patch).where(eq(t.athletes.id, 'athlete-sample')).run()

  const hasNotes = db.select().from(t.notifications).where(eq(t.notifications.athleteId, 'athlete-sample')).limit(1).all().length > 0
  if (!hasNotes) {
    db.insert(t.notifications)
      .values([
        { id: 'note-sample-1', athleteId: 'athlete-sample', kind: 'membership_confirmed', title: 'Your 2025 membership was confirmed', detail: 'Your GCash payment was received. You are a member until December 2025.', link: '/athlete/membership', createdAt: '2025-01-17T04:20:00.000Z', readAt: '2025-01-17T05:00:00.000Z' },
        { id: 'note-sample-2', athleteId: 'athlete-sample', kind: 'membership_rejected', title: 'Your membership payment was not confirmed', detail: 'The screenshot did not show the amount', link: '/athlete/membership', createdAt: '2025-01-15T03:00:00.000Z', readAt: '2025-01-15T04:00:00.000Z' },
        { id: 'note-sample-3', athleteId: 'athlete-sample', kind: 'change_approved', title: 'Your team or coach change was approved', detail: '', link: '/athlete', createdAt: hoursAgo(30), readAt: null },
        { id: 'note-sample-4', athleteId: 'athlete-sample', kind: 'change_rejected', title: 'Your team or coach change was turned down', detail: 'Ask your coach to confirm the move first', link: '/athlete/edit', createdAt: hoursAgo(3), readAt: null },
      ])
      .onConflictDoNothing()
      .run()
  }

  // A competitor carrying the athlete's name, as it is now: the account finds results, rankings and entries by name
  db.insert(t.competitors)
    .values({ id: 'c-ana-cruz', names: [athlete.name], backNumber: 401, teamId, ageGroup: 'junior_1', birthDate: '2012-04-18' })
    .onConflictDoUpdate({ target: t.competitors.id, set: { names: [athlete.name] } })
    .run()
  const POINTS = [200, 180, 160, 140, 120, 100]
  const eventsOf = (competitionId: string, take: number) =>
    db
      .select()
      .from(t.events)
      .where(eq(t.events.competitionId, competitionId))
      .all()
      .filter((e) => e.ageGroup === 'junior_1')
      .sort((a, b) => Number(b.class === 'E1') - Number(a.class === 'E1') || a.number - b.number)
      .slice(0, take)

  // Past competitions: she danced, was placed and earned points
  const placings = [2, 1, 4]
  for (const competitionId of ['comp-naga-2025', 'comp-legazpi-2026']) {
    eventsOf(competitionId, 3).forEach((event, i) => {
      const place = placings[i] ?? 3
      db.insert(t.entries).values({ id: `en-ana-${event.id}`, eventId: event.id, competitorId: 'c-ana-cruz' }).onConflictDoNothing().run()
      db.insert(t.results).values({ id: `res-ana-${event.id}`, eventId: event.id, competitorId: 'c-ana-cruz', place, placeFrom: place, placeTo: place, stage: 'final', approvedBy: 'staff-scrutineer', approvedAt: '2026-05-24T03:40:00.000Z' }).onConflictDoNothing().run()
      db.insert(t.rankingPoints)
        .values({ id: `rp-ana-${event.id}`, competitorId: 'c-ana-cruz', ageGroup: event.ageGroup, class: event.class, discipline: event.discipline, competitionId, eventId: event.id, points: POINTS[place - 1] ?? 100 })
        .onConflictDoNothing()
        .run()
    })
  }

  // Coming up: entered, with one scratched
  for (const competitionId of ['comp-bicol-2026', 'comp-naga-2027']) {
    eventsOf(competitionId, 2).forEach((event, i) => {
      db.insert(t.entries).values({ id: `en-ana-${event.id}`, eventId: event.id, competitorId: 'c-ana-cruz', scratched: competitionId === 'comp-naga-2027' && i === 1 }).onConflictDoNothing().run()
    })
  }
}

const PROVINCES = ['Albay', 'Camarines Sur', 'Camarines Norte', 'Sorsogon', 'Catanduanes', 'Masbate']
const BARANGAYS = ['San Roque', 'Triangulo', 'Bagumbayan', 'Penafrancia', 'Pili Poblacion', 'Rizal', 'Magsaysay', 'Del Rosario', 'Sagrada']
const CITIES = ['Naga City', 'Legazpi City', 'Sorsogon City', 'Daet', 'Virac', 'Masbate City']
const BIRTH_YEAR: Record<string, number> = { juvenile_1: 2018, juvenile_2: 2016, junior_1: 2013, junior_2: 2011, youth: 2008, adult: 1995, senior: 1975 }
const COACHES = [
  { id: 'coach-sample-2', name: 'Maricel Dizon', email: 'maricel@sample.example', phone: '0917 555 0101' },
  { id: 'coach-sample-3', name: 'Jonas Alcantara', email: 'jonas@sample.example', phone: '0917 555 0102' },
  { id: 'coach-sample-4', name: 'Liza Ramos', email: 'liza@sample.example', phone: '0917 555 0103' },
]

// Gives every competitor an entry form (province, coach, each dancer's details) and the entries and results they lack, so every
// panel of the staff screens has something to show. Only what is blank is filled, so real data is never replaced. Safe to run again.
export function addSampleCompetitorData(db: Db) {
  const coachIds = ['coach-sample', ...COACHES.map((c) => c.id)]
  db.insert(t.coaches).values(COACHES.map((c) => ({ ...c, memberYear: 2026, summitYear: 2026 }))).onConflictDoNothing().run()
  const existingCoaches = new Set(db.select().from(t.coaches).all().map((c) => c.id))
  const usable = coachIds.filter((id) => existingCoaches.has(id))

  const competitors = db.select().from(t.competitors).all().sort((a, b) => a.id.localeCompare(b.id))
  const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')

  db.transaction((tx) => {
    competitors.forEach((c, i) => {
      if (c.details) return
      const year = BIRTH_YEAR[c.ageGroup ?? 'adult'] ?? 1995
      const details = {
        province: PROVINCES[i % PROVINCES.length]!,
        coachId: usable[i % usable.length] ?? null,
        dancers: c.names.map((name, j) => ({
          birthDate: `${year - (j % 2)}-${String(((i + j) % 12) + 1).padStart(2, '0')}-${String(((i * 3 + j) % 27) + 1).padStart(2, '0')}`,
          address: `Zone ${(i % 9) + 1}, Barangay ${BARANGAYS[(i + j) % BARANGAYS.length]}, ${CITIES[(i + j) % CITIES.length]}`,
          email: `${slug(name)}@sample.example`,
          phone: `0917 555 ${String(1000 + ((i * 7 + j) % 9000)).padStart(4, '0')}`,
        })),
        beginner: ['juvenile_1', 'juvenile_2'].includes(c.ageGroup ?? '') && i % 5 === 0,
        memberYear: i % 4 === 0 ? 2025 : 2026,
      }
      tx.update(t.competitors).set({ details }).where(eq(t.competitors.id, c.id)).run()
    })

    const events = tx.select().from(t.events).all()
    const hasEntry = new Set(tx.select().from(t.entries).all().map((e) => e.competitorId))
    const hasResult = new Set(tx.select().from(t.results).all().map((r) => r.competitorId))
    const matching = (competitionIds: string[], ageGroup: string | null, take: number) => {
      const inComps = events.filter((e) => competitionIds.includes(e.competitionId))
      const same = inComps.filter((e) => e.ageGroup === ageGroup)
      return (same.length > 0 ? same : inComps).slice(0, take)
    }
    const POINTS = [200, 180, 160, 140, 120, 100]

    competitors.forEach((c, i) => {
      // Not entered anywhere: enter them in two events of the coming competitions
      if (!hasEntry.has(c.id)) {
        for (const e of matching(['comp-bicol-2026', 'comp-naga-2027'], c.ageGroup, 2)) {
          tx.insert(t.entries).values({ id: `en-fill-${c.id}-${e.id}`, eventId: e.id, competitorId: c.id }).onConflictDoNothing().run()
        }
      }
      // No results: place them in two events of a past competition, after whoever is already placed there
      if (!hasResult.has(c.id)) {
        const past = i % 2 === 0 ? ['comp-naga-2025'] : ['comp-legazpi-2026']
        for (const e of matching(past, c.ageGroup, 2)) {
          const placed = tx.select().from(t.results).where(eq(t.results.eventId, e.id)).all().length
          const place = placed + 1
          tx.insert(t.entries).values({ id: `en-fill-${c.id}-${e.id}`, eventId: e.id, competitorId: c.id }).onConflictDoNothing().run()
          tx.insert(t.results)
            .values({ id: `res-fill-${c.id}-${e.id}`, eventId: e.id, competitorId: c.id, place, placeFrom: place, placeTo: place, stage: place <= 6 ? 'final' : 'semi_final', approvedBy: 'staff-scrutineer', approvedAt: '2026-05-24T03:40:00.000Z' })
            .onConflictDoNothing()
            .run()
          if (place <= 6) {
            tx.insert(t.rankingPoints)
              .values({ id: `rp-fill-${c.id}-${e.id}`, competitorId: c.id, ageGroup: e.ageGroup, class: e.class, discipline: e.discipline, competitionId: e.competitionId, eventId: e.id, points: POINTS[place - 1] ?? 100 })
              .onConflictDoNothing()
              .run()
          }
        }
      }
    })
  })
}

// Puts adjudicators on the panel of every event that has none yet, so each adjudicator's record shows more than one competition.
// Seven of the adjudicators, rotating, per event. Safe to run again: events with a panel are left alone.
export function addSamplePanels(db: Db) {
  const adjudicators = db.select().from(t.adjudicators).all().sort((a, b) => a.letter.localeCompare(b.letter))
  if (adjudicators.length < 3) return
  const size = Math.min(7, adjudicators.length)
  const hasPanel = new Set(db.select().from(t.panels).all().map((p) => p.eventId))
  const events = db.select().from(t.events).all().sort((a, b) => a.competitionId.localeCompare(b.competitionId) || a.number - b.number)

  db.transaction((tx) => {
    events.forEach((event, i) => {
      if (hasPanel.has(event.id)) return
      const panelId = `panel-fill-${event.id}`
      tx.insert(t.panels).values({ id: panelId, eventId: event.id }).onConflictDoNothing().run()
      for (let k = 0; k < size; k++) {
        const adjudicator = adjudicators[(i + k) % adjudicators.length]!
        tx.insert(t.panelMembers).values({ panelId, adjudicatorId: adjudicator.id }).onConflictDoNothing().run()
      }
    })
  })
}

// A 1x1 picture standing in for a payment screenshot
const SAMPLE_RECEIPT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAoQ7cyAAAAABJRU5ErkJggg=='

// Solo events for the coming competitions (the ones above are all couples), a linked sample coach and team with their pages filled in,
// and entry requests in every state, so Enter events, My requests and the secretariat's Entry requests all have something to show.
// Safe to run again: everything has a fixed id and only what is blank is filled.
export function addSampleEntryData(db: Db) {
  const COMPETITIONS = ['comp-bicol-2026', 'comp-naga-2027']
  const AGE_GROUPS: AgeGroup[] = ['juvenile_1', 'juvenile_2', 'junior_1', 'junior_2', 'youth', 'adult']
  const SOLOS: Array<{ class: Class; discipline: Discipline; dances: Dance[] }> = [
    { class: 'E1', discipline: 'latin', dances: ['samba'] },
    { class: 'E1', discipline: 'latin', dances: ['cha_cha_cha'] },
    { class: 'E1', discipline: 'standard', dances: ['waltz'] },
  ]
  for (const competitionId of COMPETITIONS) {
    if (!db.select().from(t.competitions).where(eq(t.competitions.id, competitionId)).get()) continue
    const taken = db.select().from(t.events).where(eq(t.events.competitionId, competitionId)).all()
    let number = Math.max(0, ...taken.map((e) => e.number)) + 1
    for (const ageGroup of AGE_GROUPS) {
      for (const solo of SOLOS) {
        const id = `${competitionId}:solo:${ageGroup}:${solo.dances[0]}`
        db.insert(t.events).values({ id, competitionId, number, position: number, ageGroup, ...solo, isSolo: true }).onConflictDoNothing().run()
        number++
      }
    }
  }

  const athlete = db.select().from(t.athletes).where(eq(t.athletes.id, 'athlete-sample')).get()
  const home = db.select().from(t.competitors).where(eq(t.competitors.id, 'c-ana-cruz')).get()
  const teamId = home?.teamId ?? db.select().from(t.teams).limit(1).get()?.id
  if (!athlete || !home || !teamId) return

  // The sample coach and team stand for Rico Bautista and Ana's team; they were given a name and an email only
  for (const m of db.select().from(t.memberAccounts).all()) {
    if (m.id !== 'member-sample-coach' && m.id !== 'member-sample-team') continue
    const patch: Partial<typeof t.memberAccounts.$inferInsert> = {}
    if (!m.linkedId) patch.linkedId = m.role === 'team' ? teamId : 'coach-sample'
    if (!m.phone) patch.phone = m.role === 'team' ? '0917 555 0200' : '0917 555 0100'
    if (!m.province) patch.province = 'Camarines Sur'
    if (!m.address) patch.address = m.role === 'team' ? 'Naga City Coliseum, Naga City' : 'Zone 3, Barangay Triangulo, Naga City'
    if (m.role === 'coach' && !m.birthDate) patch.birthDate = '1988-06-21'
    if (Object.keys(patch).length > 0) db.update(t.memberAccounts).set(patch).where(eq(t.memberAccounts.id, m.id)).run()
  }

  // A few solo dancers of the team, so the team has someone to enter whatever the rest of the sample holds
  const teamDancers = [
    { id: 'c-sample-team-1', names: ['Lian Torres'], ageGroup: 'juvenile_1' as const, year: 2018 },
    { id: 'c-sample-team-2', names: ['Bea Mendoza'], ageGroup: 'junior_1' as const, year: 2013 },
    { id: 'c-sample-team-3', names: ['Paolo Aquino'], ageGroup: 'youth' as const, year: 2008 },
  ]
  for (const d of teamDancers) {
    const details = {
      province: 'Camarines Sur',
      coachId: 'coach-sample',
      dancers: [{ birthDate: `${d.year}-05-14`, address: 'Zone 2, Barangay Triangulo, Naga City', email: '', phone: '0917 555 0300' }],
      beginner: false,
      memberYear: 2026,
    }
    db.insert(t.competitors).values({ id: d.id, names: d.names, ageGroup: d.ageGroup, teamId, details }).onConflictDoNothing().run()
  }

  // The team's solo dancers, as it would enter them
  const others = db
    .select()
    .from(t.competitors)
    .all()
    .filter((c) => teamDancers.some((d) => d.id === c.id))
    .sort((x, y) => x.id.localeCompare(y.id))
  const soloEvents = (competitionId: string, ageGroup: string | null, take: number) =>
    db
      .select()
      .from(t.events)
      .where(eq(t.events.competitionId, competitionId))
      .all()
      .filter((e) => e.isSolo && e.ageGroup === ageGroup)
      .sort((a, b) => a.number - b.number)
      .slice(0, take)
  // A dancer's age group, from the birth years of the dancers
  const groupIn = (c: { ageGroup: string | null; details?: { dancers: Array<{ birthDate: string }> } | null }) =>
    ageGroupForBirthYears((c.details?.dancers ?? []).map((d) => Number(d.birthDate.slice(0, 4)))) ?? c.ageGroup
  const priced = (events: Array<typeof t.events.$inferSelect>) => registrationFee(DEFAULT_FEE_SCHEDULE, events as never, 0).total
  const at = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()
  const team = { requesterId: 'member-sample-team', requesterRole: 'team' as const, requesterName: 'Sample Dance Team' }

  type Request = typeof t.entryRequests.$inferInsert
  const requests: Request[] = []
  const [a, b, c] = others
  if (a) {
    const events = soloEvents('comp-bicol-2026', a.ageGroup, 2)
    requests.push({ id: 'req-sample-waiting', ...team, competitorId: a.id, competitionId: 'comp-bicol-2026', eventIds: events.map((e) => e.id), total: priced(events), warnings: [], method: 'gcash', reference: 'GC7040012345', receipt: SAMPLE_RECEIPT, status: 'waiting', createdAt: at(3) })
  }
  if (b) {
    const events = soloEvents('comp-bicol-2026', b.ageGroup, 1)
    requests.push({ id: 'req-sample-rejected', ...team, competitorId: b.id, competitionId: 'comp-bicol-2026', eventIds: events.map((e) => e.id), total: priced(events), warnings: [], method: 'maya', reference: 'MY2209912', receipt: SAMPLE_RECEIPT, status: 'rejected', rejectedReason: 'The screenshot is cut off. Send the whole payment.', createdAt: at(30), decidedAt: at(26), decidedBy: 'staff-secretariat' })
  }
  if (c) {
    const events = soloEvents('comp-naga-2027', groupIn(c), 2)
    requests.push({ id: 'req-sample-approved', ...team, competitorId: c.id, competitionId: 'comp-naga-2027', eventIds: events.map((e) => e.id), total: priced(events), warnings: [], method: 'bank', reference: 'BK55102', receipt: SAMPLE_RECEIPT, status: 'approved', createdAt: at(72), decidedAt: at(70), decidedBy: 'staff-secretariat' })
    // An approved request has its entries and its payment
    const paymentId = 'pay-sample-request'
    db.insert(t.payments).values({ id: paymentId, teamId, competitionId: 'comp-naga-2027', late: false, amountDue: priced(events), amountPaid: priced(events), referenceNumber: 'BK55102', method: 'bank', receipt: SAMPLE_RECEIPT, status: 'approved', checkedBy: 'staff-secretariat', checkedAt: at(70) }).onConflictDoNothing().run()
    for (const e of events) db.insert(t.entries).values({ id: `en-req-${c.id}-${e.id}`, eventId: e.id, competitorId: c.id, paymentId }).onConflictDoNothing().run()
  }
  for (const r of requests) if (r.eventIds.length > 0) db.insert(t.entryRequests).values(r).onConflictDoNothing().run()

  // What the team and the coach were told
  db.insert(t.memberNotifications)
    .values([
      { id: 'mnote-sample-team-1', memberId: 'member-sample-team', kind: 'link_approved', title: 'You are linked to your team', detail: 'Your dancers and payments are on your page now.', link: '/team/dancers', createdAt: at(96), readAt: at(95) },
      { id: 'mnote-sample-team-2', memberId: 'member-sample-team', kind: 'entry_approved', title: 'Your entry was approved', detail: '2 events entered. Your payment was received.', link: '/team/entries', createdAt: at(70), readAt: null },
      { id: 'mnote-sample-team-3', memberId: 'member-sample-team', kind: 'entry_rejected', title: 'Your entry was not approved', detail: 'The screenshot is cut off. Send the whole payment.', link: '/team/register', createdAt: at(26), readAt: null },
      { id: 'mnote-sample-coach-1', memberId: 'member-sample-coach', kind: 'link_approved', title: 'You are linked to Rico Bautista', detail: 'Your athletes are on your page now.', link: '/coach/dancers', createdAt: at(48), readAt: null },
    ])
    .onConflictDoNothing()
    .run()
}
