import { ageGroupForBirthYears, samplePhoto, type AgeGroup, type Dance, type Discipline } from '@bis/shared'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'
import { hashPassword } from '../auth/password.ts'
import type { Db } from './client.ts'
import { sampleCompetitionImage } from './seed.ts'
import * as t from './schema.ts'

// Test data for trying every screen: teams, coaches, athletes, adjudicators and competitions with events.
// Nothing here can sign in (the athletes get a password nobody knows), so it is safe on a staging server.
// Safe to run again: each row has a fixed id, and a row that is already there is left alone.

const TEAMS = ['Naga Rhythm Studio', 'Legazpi Dance Collective', 'Sorsogon Star Dancers', 'Iriga Movement Club', 'Daet Ballroom Team']
const PROVINCES = ['Camarines Sur', 'Albay', 'Sorsogon', 'Camarines Sur', 'Camarines Norte']
const COACHES = ['Marites Villareal', 'Joel Santillan', 'Amparo Reyes', 'Nestor Balane', 'Cecile Tolentino']
// Four athletes a team, one in each age group of the events below
const ATHLETES = [
  'Bianca Alcantara', 'Rafael Briones', 'Camille Dominguez', 'Enzo Fernandez',
  'Gabriela Hizon', 'Ivan Jacinto', 'Kristine Lagman', 'Miguel Navarro',
  'Nicole Ocampo', 'Paolo Quintela', 'Raissa Salvador', 'Tomas Umali',
  'Ysabel Valdez', 'Zandro Abella', 'Alyssa Bautista', 'Benedict Cabrera',
  'Chloe Delos Santos', 'Dominic Estrada', 'Elaine Fajardo', 'Francis Gonzales',
]
const BIRTH_YEARS = [2017, 2015, 2013, 2010]
const ADJUDICATORS = [
  'Elena R. Marquez', 'Fidel A. Pascual', 'Gloria T. Rosales', 'Hector B. Salazar', 'Imelda C. Tan',
  'Jaime D. Uy', 'Karina E. Vergara', 'Leandro F. Yap', 'Mirasol G. Zamora', 'Narciso H. Abad',
  'Odessa I. Bernal', 'Prudencio J. Castillo', 'Querubin K. Dela Peña', 'Rosalinda L. Evangelista', 'Silvestre M. Fabella',
]
const LETTERS = 'ABCDEFGHIJ'

const PAST = [
  { name: 'Naga Dancesport Open 2026', date: '2026-03-14', venue: 'Naga City Coliseum, Naga City', organizer: 'Camarines Sur Dancesport Association' },
  { name: 'Albay Dancesport Cup 2026', date: '2026-05-23', venue: 'Albay Astrodome, Legazpi City', organizer: 'Albay Dancesport Federation' },
  { name: 'Sorsogon Grand Prix 2026', date: '2026-08-15', venue: 'Sorsogon Provincial Gymnasium, Sorsogon City', organizer: 'Sorsogon Dancesport Council' },
]
const UPCOMING = [
  { name: 'Bicol Christmas Dancesport Festival 2026', date: '2026-12-12', venue: 'Albay Astrodome, Legazpi City', organizer: 'Albay Dancesport Federation' },
  { name: 'Daet Dancesport Invitational 2027', date: '2027-01-30', venue: 'Camarines Norte Gymnasium, Daet', organizer: 'Camarines Norte Dancesport Club' },
  { name: 'Iriga City Dancesport Challenge 2027', date: '2027-03-13', venue: 'Iriga City Sports Complex, Iriga City', organizer: 'Iriga Movement Club' },
  { name: 'Naga Dancesport Championships 2027', date: '2027-05-22', venue: 'Naga City Coliseum, Naga City', organizer: 'Camarines Sur Dancesport Association' },
  { name: 'Bicol Regional Dancesport Finals 2027', date: '2027-07-17', venue: 'Sorsogon Provincial Gymnasium, Sorsogon City', organizer: 'Sorsogon Dancesport Council' },
]

// Six events a competition: each age group, in Latin and in Standard where it makes sense
const LATIN: Dance[] = ['cha_cha_cha', 'rumba', 'jive']
const STANDARD: Dance[] = ['waltz', 'quickstep']
const EVENTS: Array<{ ageGroup: AgeGroup; discipline: Discipline; dances: Dance[] }> = [
  { ageGroup: 'juvenile_1', discipline: 'latin', dances: LATIN },
  { ageGroup: 'juvenile_2', discipline: 'latin', dances: LATIN },
  { ageGroup: 'junior_1', discipline: 'standard', dances: STANDARD },
  { ageGroup: 'junior_1', discipline: 'latin', dances: LATIN },
  { ageGroup: 'youth', discipline: 'latin', dances: LATIN },
  { ageGroup: 'youth', discipline: 'standard', dances: STANDARD },
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')
const addDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10)

export interface TestDataReport {
  teams: number
  coaches: number
  athletes: number
  adjudicators: number
  adjudicatorsSkipped: number
  pastCompetitions: number
  upcomingCompetitions: number
}

export function addTestData(db: Db): TestDataReport {
  const image = sampleCompetitionImage()
  const noPassword = hashPassword(randomBytes(24).toString('hex'))

  // ---- Teams and coaches
  const teamIds = TEAMS.map((_, i) => `td-team-${i + 1}`)
  db.insert(t.teams)
    .values(TEAMS.map((name, i) => ({ id: teamIds[i]!, name, contactName: COACHES[i]!, contactEmail: `${slug(name)}@testdata.example`, contactPhone: `0917 555 ${String(1000 + i * 111)}` })))
    .onConflictDoNothing()
    .run()
  const coachIds = COACHES.map((_, i) => `td-coach-${i + 1}`)
  db.insert(t.coaches)
    .values(COACHES.map((name, i) => ({ id: coachIds[i]!, name, email: `${slug(name)}@testdata.example`, phone: `0918 555 ${String(2000 + i * 111)}`, memberYear: 2026, summitYear: 2026 })))
    .onConflictDoNothing()
    .run()

  // ---- Athletes: an account and the dancer record that carries the same name
  const used = new Set(db.select({ n: t.competitors.backNumber }).from(t.competitors).all().map((c) => c.n).filter((n): n is number => n !== null))
  let nextBack = 1
  const competitors: Array<{ id: string; ageGroup: AgeGroup; teamId: string; name: string }> = []
  ATHLETES.forEach((name, i) => {
    const team = Math.floor(i / 4)
    const year = BIRTH_YEARS[i % 4]!
    const birthDate = `${year}-${String(1 + ((i * 3) % 12)).padStart(2, '0')}-${String(5 + ((i * 7) % 20)).padStart(2, '0')}`
    const ageGroup = ageGroupForBirthYears([year], 2026)!
    const email = `${slug(name)}@testdata.example`
    const address = `${10 + i} Rizal Street, ${['Naga City', 'Legazpi City', 'Sorsogon City', 'Iriga City', 'Daet'][team]}`
    const phone = `0920 555 ${String(3000 + i * 37)}`
    db.insert(t.athletes)
      .values({ id: `td-athlete-${i + 1}`, name, email, passwordHash: noPassword, birthDate, phone, address, province: PROVINCES[team]!, teamId: teamIds[team]!, coachId: coachIds[team]!, memberYear: 2026, photo: samplePhoto(name) })
      .onConflictDoNothing()
      .run()
    const id = `td-competitor-${i + 1}`
    while (used.has(nextBack)) nextBack++
    const backNumber = db.select().from(t.competitors).where(eq(t.competitors.id, id)).get() ? undefined : nextBack
    if (backNumber !== undefined) used.add(backNumber)
    db.insert(t.competitors)
      .values({
        id,
        names: [name],
        ageGroup,
        birthDate,
        backNumber: backNumber ?? null,
        teamId: teamIds[team]!,
        details: { province: PROVINCES[team]!, coachId: coachIds[team]!, dancers: [{ birthDate, address, email, phone }], beginner: false, memberYear: 2026 },
      })
      .onConflictDoNothing()
      .run()
    competitors.push({ id, ageGroup, teamId: teamIds[team]!, name })
  })

  // ---- Adjudicators: letters A to J are all there are, so only the free ones are used
  const taken = new Set(db.select({ l: t.adjudicators.letter }).from(t.adjudicators).all().map((a) => a.l))
  const freeLetters = [...LETTERS].filter((l) => !taken.has(l))
  let added = 0
  for (const [i, name] of ADJUDICATORS.entries()) {
    const letter = freeLetters[added]
    if (!letter) break
    if (db.select().from(t.adjudicators).where(eq(t.adjudicators.id, `td-adjudicator-${i + 1}`)).get()) continue
    db.insert(t.adjudicators).values({ id: `td-adjudicator-${i + 1}`, name, letter, photo: samplePhoto(name) }).run()
    added++
  }
  const panel = db.select().from(t.adjudicators).all().sort((a, b) => a.letter.localeCompare(b.letter)).slice(0, 7)

  // ---- Competitions: three finished, with results and points, and five coming up
  const points = db.select().from(t.pointsTable).all().filter((p) => p.place !== null).sort((a, b) => (a.place ?? 0) - (b.place ?? 0)).map((p) => p.points)
  const pointsFor = (place: number) => (points.length > 0 ? points[place - 1] : [100, 80, 60, 40, 30][place - 1]) ?? 0
  const at = (iso: string) => `${iso}T12:00:00.000Z`

  const make = (comp: { name: string; date: string; venue: string; organizer: string }, key: string, finished: boolean, round: number) => {
    const competitionId = `td-${key}`
    db.insert(t.competitions)
      .values({ id: competitionId, ...comp, entryDeadline: addDays(comp.date, -14), feeDeadline: addDays(comp.date, -7), image })
      .onConflictDoNothing()
      .run()
    const dueByTeam = new Map<string, number>()
    const entryRows: Array<{ eventId: string; competitorId: string; teamId: string }> = []
    EVENTS.forEach((spec, n) => {
      const eventId = `${competitionId}-e${n + 1}`
      db.insert(t.events)
        .values({ id: eventId, competitionId, number: n + 1, position: n + 1, ageGroup: spec.ageGroup, class: 'D', discipline: spec.discipline, dances: spec.dances, isSolo: true, kind: 'standard', province: '' })
        .onConflictDoNothing()
        .run()
      if (panel.length > 0) {
        db.insert(t.panels).values({ id: `${eventId}-panel`, eventId }).onConflictDoNothing().run()
        db.insert(t.panelMembers).values(panel.map((a) => ({ panelId: `${eventId}-panel`, adjudicatorId: a.id }))).onConflictDoNothing().run()
      }
      for (const c of competitors.filter((x) => x.ageGroup === spec.ageGroup)) {
        entryRows.push({ eventId, competitorId: c.id, teamId: c.teamId })
        dueByTeam.set(c.teamId, (dueByTeam.get(c.teamId) ?? 0) + 500)
      }
    })
    // One payment a team: paid for a finished competition, still owed for one that is coming
    for (const [teamId, due] of dueByTeam) {
      db.insert(t.payments)
        .values({
          id: `${competitionId}-pay-${teamId}`,
          teamId,
          competitionId,
          amountDue: due,
          amountPaid: finished ? due : null,
          referenceNumber: finished ? `TD${round}${teamId.slice(-1)}${due}` : null,
          method: finished ? 'gcash' : null,
          status: finished ? 'approved' : 'unpaid',
          checkedBy: finished ? 'td-seed' : null,
          checkedAt: finished ? at(comp.date) : null,
        })
        .onConflictDoNothing()
        .run()
    }
    for (const e of entryRows) {
      db.insert(t.entries)
        .values({ id: `${e.eventId}-${e.competitorId}`, eventId: e.eventId, competitorId: e.competitorId, paymentId: `${competitionId}-pay-${e.teamId}` })
        .onConflictDoNothing()
        .run()
    }
    if (!finished) return
    // Results: each event had a final; the places rotate between competitions so the rankings are not all the same
    EVENTS.forEach((spec, n) => {
      const eventId = `${competitionId}-e${n + 1}`
      db.insert(t.rounds)
        .values({ id: `${eventId}-final`, eventId, type: 'final', position: 1, recallNumber: null, status: 'published', publishedAt: at(comp.date) })
        .onConflictDoNothing()
        .run()
      const field = competitors.filter((x) => x.ageGroup === spec.ageGroup)
      field.forEach((_, i) => {
        const c = field[(i + round + n) % field.length]!
        const place = i + 1
        db.insert(t.results)
          .values({ id: `${eventId}-r${place}`, eventId, competitorId: c.id, place, placeFrom: place, placeTo: place, stage: 'final', approvedBy: 'td-seed', approvedAt: at(comp.date) })
          .onConflictDoNothing()
          .run()
        db.insert(t.rankingPoints)
          .values({ id: `${eventId}-p${place}`, competitorId: c.id, ageGroup: spec.ageGroup, class: 'D', discipline: spec.discipline, competitionId, eventId, points: pointsFor(place) })
          .onConflictDoNothing()
          .run()
      })
    })
  }
  PAST.forEach((c, i) => make(c, `past-${i + 1}`, true, i + 1))
  UPCOMING.forEach((c, i) => make(c, `upcoming-${i + 1}`, false, i + 1))

  return {
    teams: TEAMS.length,
    coaches: COACHES.length,
    athletes: ATHLETES.length,
    adjudicators: added,
    adjudicatorsSkipped: ADJUDICATORS.length - added,
    pastCompetitions: PAST.length,
    upcomingCompetitions: UPCOMING.length,
  }
}
