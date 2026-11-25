import { ProgramKind, ageGroupForBirthYears, type Dance, type RoundType } from '@bis/shared'
import type { Db } from './client.ts'
import { priceSampleEvents } from './sample-fees.ts'
import { sampleCompetitionImage } from './seed.ts'
import * as t from './schema.ts'

type Stage = 'done' | 'floor' | 'waiting'

interface Spec {
  dances: Dance[]
  discipline: 'latin' | 'standard'
  round: RoundType
  recall: number | null
  stage: Stage
  heats: number[]
}

const COUPLES: Array<[string, string]> = [
  ['Bianca Alcantara', 'Rafael Briones'],
  ['Camille Dominguez', 'Enzo Fernandez'],
  ['Gabriela Hizon', 'Ivan Jacinto'],
  ['Kaya Lopez', 'Miguel Navarro'],
  ['Olivia Panganiban', 'Quentin Reyes'],
  ['Sofia Tolentino', 'Ulysses Valdez'],
  ['Wendy Zamora', 'Xavier Abad'],
  ['Yna Bautista', 'Zander Cruz'],
  ['Alyssa Dizon', 'Bryan Estrada'],
  ['Carla Fabian', 'Dennis Garcia'],
]
const TEAMS = ['Naga Dance Studio', 'Bicol Stars Dancesport']

const EVENTS: Spec[] = [
  { dances: ['waltz', 'quickstep'], discipline: 'standard', round: 'final', recall: null, stage: 'done', heats: [] },
  { dances: ['samba'], discipline: 'latin', round: 'final', recall: null, stage: 'done', heats: [] },
  { dances: ['cha_cha_cha', 'rumba'], discipline: 'latin', round: 'semi_final', recall: 6, stage: 'floor', heats: [8] },
  { dances: ['jive'], discipline: 'latin', round: 'final', recall: null, stage: 'waiting', heats: [] },
  { dances: ['tango'], discipline: 'standard', round: 'final', recall: null, stage: 'waiting', heats: [] },
  { dances: ['paso_doble'], discipline: 'latin', round: 'final', recall: null, stage: 'waiting', heats: [] },
]

export function addProgramDemo(db: Db): { competitionId: string } {
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
  const competitionId = 'td-program-demo'
  const ageGroup = ageGroupForBirthYears([2012, 2013])!

  db.insert(t.competitions)
    .values({ id: competitionId, name: 'Program demo (test data)', date: today, venue: 'Demo Gym, Naga City', organizer: 'BIS test data', image: sampleCompetitionImage() })
    .onConflictDoNothing()
    .run()
  TEAMS.forEach((name, i) => {
    db.insert(t.teams)
      .values({ id: `td-program-team-${i + 1}`, name, contactName: 'Demo Coach', contactEmail: `program-demo-${i + 1}@testdata.example`, contactPhone: '0917 555 0000' })
      .onConflictDoNothing()
      .run()
  })

  const used = new Set(db.select({ n: t.competitors.backNumber }).from(t.competitors).all().map((c) => c.n).filter((n): n is number => n !== null))
  let back = 100
  const competitorIds = COUPLES.map((names, i) => {
    const id = `td-program-competitor-${i + 1}`
    while (used.has(back)) back++
    used.add(back)
    db.insert(t.competitors)
      .values({
        id,
        names,
        ageGroup,
        birthDate: '2012-03-04',
        backNumber: back,
        teamId: `td-program-team-${(i % TEAMS.length) + 1}`,
        details: { province: 'Camarines Sur', coachId: null, dancers: names.map(() => ({ birthDate: '2012-03-04', address: 'Rizal Street, Naga City', email: '', phone: '' })), memberYear: 2026 },
      })
      .onConflictDoNothing()
      .run()
    return id
  })

  db.insert(t.programStarts).values({ competitionId, start: '09:00' }).onConflictDoNothing().run()

  const slots: Array<typeof t.programSlots.$inferInsert> = []
  const push = (slot: Omit<typeof t.programSlots.$inferInsert, 'id' | 'competitionId' | 'sequence'>) =>
    slots.push({ ...slot, id: `td-program-slot-${slots.length + 1}`, competitionId, sequence: slots.length + 1 })

  EVENTS.forEach((spec, n) => {
    const eventId = `${competitionId}-e${n + 1}`
    db.insert(t.events)
      .values({ id: eventId, competitionId, number: n + 1, position: n + 1, ageGroup, class: 'D', discipline: spec.discipline, dances: spec.dances, isSolo: false, kind: 'standard', province: '' })
      .onConflictDoNothing()
      .run()
    for (const competitorId of competitorIds) {
      db.insert(t.entries).values({ id: `${eventId}-${competitorId}`, eventId, competitorId }).onConflictDoNothing().run()
    }

    const roundId = `${eventId}-${spec.round}`
    const at = new Date().toISOString()
    db.insert(t.rounds)
      .values({
        id: roundId,
        eventId,
        type: spec.round,
        position: 1,
        recallNumber: spec.recall,
        status: spec.stage === 'done' ? 'published' : spec.stage === 'floor' ? 'marking' : 'pending',
        publishedAt: spec.stage === 'done' ? at : null,
        onFloorAt: spec.stage === 'floor' ? at : null,
      })
      .onConflictDoNothing()
      .run()

    if (spec.round === 'semi_final') {
      db.insert(t.rounds).values({ id: `${eventId}-final`, eventId, type: 'final', position: 2, recallNumber: null, status: 'pending' }).onConflictDoNothing().run()
    }

    let from = 0
    spec.heats.forEach((size, h) => {
      const heatId = `${roundId}-h${h + 1}`
      db.insert(t.heats).values({ id: heatId, roundId, number: h + 1 }).onConflictDoNothing().run()
      for (const competitorId of competitorIds.slice(from, from + size)) {
        db.insert(t.heatCompetitors).values({ heatId, competitorId }).onConflictDoNothing().run()
      }
      from += size
    })

    const minutes = spec.dances.length * 2 + 1
    push({ kind: ProgramKind.Round, eventId, roundType: spec.round, label: null, minutes })
    if (spec.round === 'semi_final') push({ kind: ProgramKind.Round, eventId, roundType: 'final', label: null, minutes })
    if (n === 3) push({ kind: ProgramKind.Break, eventId: null, roundType: null, label: 'Lunch break', minutes: 45 })
  })
  push({ kind: ProgramKind.Awarding, eventId: null, roundType: null, label: 'Awarding', minutes: 20 })
  db.insert(t.programSlots).values(slots).onConflictDoNothing().run()

  priceSampleEvents(db, (e) => e.competitionId === competitionId)
  return { competitionId }
}
