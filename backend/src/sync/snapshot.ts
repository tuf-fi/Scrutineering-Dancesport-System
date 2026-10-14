import { HttpError } from '../core/context.ts'
import type { Sqlite } from '../db/client.ts'
import type { SyncSnapshot } from './apply.ts'
import { readPaymentSettings } from '../paymentSettings.ts'
import { DOWNLOAD_TABLES } from './tables.ts'

type Row = Record<string, string | number | null>

const q = (name: string) => `"${name}"`
const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ')
const columnsOf = (table: string) => DOWNLOAD_TABLES.find((t) => t.name === table)!.columns

// What a venue needs to run a competition: the paid entries and who they are, the events and panels, the official
// points table, and the rankings so far (with enough history to show them). Built on the cloud.
export function buildSnapshot(sqlite: Sqlite, competitionId: string): SyncSnapshot {
  const pick = (table: string, where: string, ...args: Array<string | number>): Row[] =>
    sqlite.prepare(`SELECT ${columnsOf(table).map(q).join(', ')} FROM ${q(table)} WHERE ${where}`).all(...args) as Row[]
  const byIds = (table: string, column: string, ids: Array<string | number>): Row[] =>
    ids.length === 0 ? [] : pick(table, `${q(column)} IN (${placeholders(ids.length)})`, ...ids)
  const ids = (rows: Row[], column: string) => [...new Set(rows.map((r) => r[column]).filter((v): v is string | number => v !== null))]
  const unique = (rows: Row[]) => [...new Map(rows.map((r) => [r.id, r])).values()]

  const competition = pick('competitions', 'id = ?', competitionId)
  if (competition.length === 0) throw new HttpError(404, 'Competition not found')

  const events = pick('events', 'competition_id = ?', competitionId)

  // A paid entry is one with an approved or cash payment, or no payment record at all (a past competition's entry)
  const eligible = `(entries.payment_id IS NULL OR payments.status IN ('approved', 'paid_at_venue')) AND entries.scratched = 0`
  const entryColumns = columnsOf('entries').map((c) => `entries.${q(c)}`).join(', ')
  const from = `FROM entries JOIN events ON events.id = entries.event_id LEFT JOIN payments ON payments.id = entries.payment_id WHERE events.competition_id = ?`
  const entries = sqlite.prepare(`SELECT ${entryColumns} ${from} AND ${eligible}`).all(competitionId) as Row[]
  const excluded = (sqlite.prepare(`SELECT count(*) AS n ${from} AND entries.scratched = 0 AND NOT ${eligible}`).get(competitionId) as { n: number }).n

  const payments = byIds('payments', 'id', ids(entries, 'payment_id'))

  // Rankings so far, and the events they came from, so the venue can show them and each dancer's history
  const rankingPoints = pick('ranking_points', '1 = 1')
  const historyEvents = byIds('events', 'id', ids(rankingPoints, 'event_id'))
  const historyCompetitions = byIds('competitions', 'id', ids([...historyEvents, ...events], 'competition_id'))
  const results = byIds('results', 'event_id', ids(historyEvents, 'id'))

  const competitorIds = [...new Set([...ids(entries, 'competitor_id'), ...ids(rankingPoints, 'competitor_id'), ...ids(results, 'competitor_id')])]
  const competitors = byIds('competitors', 'id', competitorIds)
  const clubs = byIds('clubs', 'id', [...new Set([...ids(competitors, 'club_id'), ...ids(payments, 'club_id')])])

  const panels = byIds('panels', 'event_id', ids(events, 'id'))
  const tables: SyncSnapshot['tables'] = {
    competitions: unique([...competition, ...historyCompetitions]),
    clubs,
    competitors,
    events: unique([...events, ...historyEvents]),
    payments,
    entries,
    adjudicators: sqlite.prepare(`SELECT ${columnsOf('adjudicators').map(q).join(', ')} FROM adjudicators`).all() as Row[],
    adjudicator_pins: pick('adjudicator_pins', 'competition_id = ?', competitionId),
    panels,
    panel_members: byIds('panel_members', 'panel_id', ids(panels, 'id')),
    points_table: sqlite.prepare(`SELECT ${columnsOf('points_table').map(q).join(', ')} FROM points_table`).all() as Row[],
    results,
    ranking_points: rankingPoints,
  }
  return { tables, excluded: { entries: excluded }, paymentSettings: readPaymentSettings(sqlite) }
}
