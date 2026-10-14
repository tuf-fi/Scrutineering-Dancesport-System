// One-off: snapshots the frontend's sample data to backend/seed/sample-data.json so the database
// can be seeded without importing the frontend. Run with `pnpm --filter @bis/backend db:snapshot`.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { adjudicatorPins, adjudicators, panels } from '../../frontend/src/mocks/data/adjudicators.ts'
import { clubs } from '../../frontend/src/mocks/data/clubs.ts'
import { competitions, currentCompetitionId } from '../../frontend/src/mocks/data/competitions.ts'
import { ageGroupOf, competitors } from '../../frontend/src/mocks/data/competitors.ts'
import { entries } from '../../frontend/src/mocks/data/entries.ts'
import { events } from '../../frontend/src/mocks/data/events.ts'
import '../../frontend/src/mocks/data/late.ts'
import { payments } from '../../frontend/src/mocks/data/payments.ts'
import { heats, liveRoundId, marks, rounds } from '../../frontend/src/mocks/data/progress.ts'
import { pointsTable } from '../../frontend/src/mocks/data/pointsTable.ts'
import { rankingPoints, results } from '../../frontend/src/mocks/data/results.ts'
import { auditLog, staffUsers } from '../../frontend/src/mocks/data/staff.ts'

// The live round starts with the first three adjudicators already submitted, as the demo does
const START_SUBMITTED = 3
const liveRound = rounds.find((r) => r.id === liveRoundId)
const livePanel = panels.find((p) => p.eventId === liveRound?.eventId)?.adjudicatorIds ?? []
const submittedOnLive = new Set(livePanel.slice(0, START_SUBMITTED))

const snapshot = {
  currentCompetitionId,
  liveRoundId,
  competitions,
  clubs,
  competitors: competitors.map((c) => ({ ...c, ageGroup: ageGroupOf.get(c.id) ?? null })),
  events,
  entries,
  payments,
  adjudicators,
  adjudicatorPins,
  panels,
  rounds,
  heats,
  marks: marks.filter((m) => m.roundId !== liveRoundId || submittedOnLive.has(m.adjudicatorId)),
  results,
  pointsTable,
  rankingPoints,
  staffUsers,
  auditLog,
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed', 'sample-data.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(snapshot, null, 1))
console.log(`Wrote ${out}`)
