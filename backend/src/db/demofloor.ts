import { PIN_LENGTH, samplePhoto, ageGroupForBirthYears, type Dance } from '@bis/shared'
import { and, eq } from 'drizzle-orm'
import { randomBytes, randomInt } from 'node:crypto'
import { hashPassword } from '../auth/password.ts'
import type { Db } from './client.ts'
import { priceSampleEvents } from './sample-fees.ts'
import { sampleCompetitionImage } from './seed.ts'
import * as t from './schema.ts'

// A small competition for trying rounds that run side by side. Every id starts with "td-", so db:testdata:clear removes it.
// E1 (A, B, C), E2 (D, E, F) and E3 (G, H, I) have different adjudicators, so all three can start together. E4 to E8 share adjudicators with them and cannot start while those are marking.

const NAMES = ['Bianca Alcantara', 'Rafael Briones', 'Camille Dominguez', 'Enzo Fernandez', 'Gabriela Hizon', 'Ivan Jacinto']
const EVENTS: Array<{ dances: Dance[]; discipline: 'latin' | 'standard'; panel: string }> = [
  { dances: ['cha_cha_cha', 'rumba', 'jive'], discipline: 'latin', panel: 'ABC' },
  { dances: ['samba'], discipline: 'latin', panel: 'DEF' },
  { dances: ['waltz', 'quickstep'], discipline: 'standard', panel: 'GHI' },
  { dances: ['jive'], discipline: 'latin', panel: 'ABC' },
  { dances: ['rumba', 'samba'], discipline: 'latin', panel: 'DEF' },
  { dances: ['tango'], discipline: 'standard', panel: 'GHI' },
  { dances: ['waltz'], discipline: 'standard', panel: 'ADG' },
  { dances: ['cha_cha_cha'], discipline: 'latin', panel: 'BEH' },
]

export function addFloorDemo(db: Db): { competitionId: string; missing: string[] } {
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
  const competitionId = 'td-floor-demo'
  const adjudicators = db.select().from(t.adjudicators).all()
  const byLetter = new Map(adjudicators.map((a) => [a.letter, a.id]))
  const missing = [...new Set(EVENTS.flatMap((e) => [...e.panel]))].filter((l) => !byLetter.has(l))
  if (missing.length > 0) return { competitionId, missing }

  const ageGroup = ageGroupForBirthYears([2017])!
  db.insert(t.competitions)
    .values({ id: competitionId, name: 'Floor demo (test data)', date: today, venue: 'Demo Gym, Naga City', organizer: 'BIS test data', image: sampleCompetitionImage() })
    .onConflictDoNothing()
    .run()
  db.insert(t.teams)
    .values({ id: 'td-floor-team', name: 'Floor Demo Team', contactName: 'Demo Coach', contactEmail: 'floor-demo@testdata.example', contactPhone: '0917 555 0000' })
    .onConflictDoNothing()
    .run()

  const used = new Set(db.select({ n: t.competitors.backNumber }).from(t.competitors).all().map((c) => c.n).filter((n): n is number => n !== null))
  let back = 1
  const noPassword = hashPassword(randomBytes(24).toString('hex'))
  const competitorIds = NAMES.map((name, i) => {
    const id = `td-floor-competitor-${i + 1}`
    while (used.has(back)) back++
    used.add(back)
    const birthDate = `2017-0${1 + i}-1${i}`
    const email = `floor-${i + 1}@testdata.example`
    db.insert(t.athletes)
      .values({ id: `td-floor-athlete-${i + 1}`, name, email, passwordHash: noPassword, birthDate, phone: '0920 555 0000', address: 'Rizal Street, Naga City', province: 'Camarines Sur', teamId: 'td-floor-team', memberYear: 2026, photo: samplePhoto(name) })
      .onConflictDoNothing()
      .run()
    db.insert(t.competitors)
      .values({ id, names: [name], ageGroup, birthDate, backNumber: back, teamId: 'td-floor-team', details: { province: 'Camarines Sur', coachId: null, dancers: [{ birthDate, address: 'Rizal Street, Naga City', email, phone: '0920 555 0000' }], memberYear: 2026 } })
      .onConflictDoNothing()
      .run()
    return id
  })
  const due = 500 * EVENTS.length * NAMES.length
  db.insert(t.payments)
    .values({ id: 'td-floor-pay', teamId: 'td-floor-team', competitionId, amountDue: due, amountPaid: due, referenceNumber: 'TDFLOOR', method: 'gcash', status: 'approved', checkedBy: 'td-seed', checkedAt: new Date().toISOString() })
    .onConflictDoNothing()
    .run()

  EVENTS.forEach((spec, n) => {
    const eventId = `${competitionId}-e${n + 1}`
    db.insert(t.events)
      .values({ id: eventId, competitionId, number: n + 1, position: n + 1, ageGroup, class: 'D', discipline: spec.discipline, dances: spec.dances, isSolo: true, kind: 'standard', province: '' })
      .onConflictDoNothing()
      .run()
    db.insert(t.panels).values({ id: `${eventId}-panel`, eventId }).onConflictDoNothing().run()
    db.insert(t.panelMembers).values([...spec.panel].map((l) => ({ panelId: `${eventId}-panel`, adjudicatorId: byLetter.get(l)! }))).onConflictDoNothing().run()
    for (const competitorId of competitorIds) {
      db.insert(t.entries).values({ id: `${eventId}-${competitorId}`, eventId, competitorId, paymentId: 'td-floor-pay' }).onConflictDoNothing().run()
    }
    const roundId = `${eventId}-final`
    db.insert(t.rounds)
      .values({ id: roundId, eventId, type: 'final', position: 1, recallNumber: null, status: 'pending' })
      .onConflictDoNothing()
      .run()
  })

  const pins = new Set(db.select().from(t.adjudicatorPins).where(eq(t.adjudicatorPins.competitionId, competitionId)).all().map((p) => p.pin))
  for (const a of adjudicators) {
    if (db.select().from(t.adjudicatorPins).where(and(eq(t.adjudicatorPins.competitionId, competitionId), eq(t.adjudicatorPins.adjudicatorId, a.id))).get()) continue
    let pin = ''
    do pin = String(randomInt(10 ** (PIN_LENGTH - 1), 10 ** PIN_LENGTH))
    while (pins.has(pin))
    pins.add(pin)
    db.insert(t.adjudicatorPins).values({ competitionId, adjudicatorId: a.id, pin }).run()
  }
  priceSampleEvents(db, (e) => e.competitionId === competitionId)
  return { competitionId, missing: [] }
}
