import type {
  Adjudicator,
  AdjudicatorPin,
  AuditEntry,
  Club,
  Competition,
  Competitor,
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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { hashPassword } from '../auth/password.ts'
import { newId } from '../ids.ts'
import type { Db } from './client.ts'
import * as t from './schema.ts'

interface SampleData {
  currentCompetitionId: string
  liveRoundId: string
  competitions: Competition[]
  clubs: Club[]
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

// Everyone who signs in to the sample data uses this password. For demos and development only.
export const SAMPLE_PASSWORD = 'bis2026'

const snapshotPath = join(import.meta.dirname, '..', '..', 'seed', 'sample-data.json')

// SQLite allows about 32,000 values in one statement
function insertAll<T>(rows: T[], insert: (batch: T[]) => void, size = 400) {
  for (let i = 0; i < rows.length; i += size) insert(rows.slice(i, i + size))
}

export function hasData(db: Db): boolean {
  return db.select().from(t.competitions).limit(1).all().length > 0
}

// Loads the same sample competition the frontend shows, so the real app can be tried before real data exists
export function seedSampleData(db: Db) {
  const data = JSON.parse(readFileSync(snapshotPath, 'utf8')) as SampleData
  const passwordHash = hashPassword(SAMPLE_PASSWORD)
  const competition = (id: string) => data.competitions.find((c) => c.id === id)

  db.transaction((tx) => {
    insertAll(data.competitions, (batch) =>
      tx.insert(t.competitions).values(batch.map((c) => ({ ...c, floorRoundId: c.id === data.currentCompetitionId ? data.liveRoundId : null }))).run(),
    )
    insertAll(data.clubs, (batch) => tx.insert(t.clubs).values(batch.map((c) => ({ ...c, passwordHash }))).run())
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
            clubId: p.clubId,
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
      tx.insert(t.pointsTable).values(batch.map((p, i) => ({ id: newId(), place: p.place, label: p.label, points: p.points, sortOrder: i }))).run(),
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
    insertAll(data.auditLog, (batch) => tx.insert(t.auditLog).values(batch.map((a) => ({ ...a, before: null, after: null }))).run())
  })
}
