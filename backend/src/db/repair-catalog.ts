import { DEFAULT_AGE_GROUPS, DEFAULT_EVENT_KINDS } from '@bis/shared'
import type { Sqlite } from './client.ts'

const readable = (id: string) => id.replace(/_/g, ' ')
const titled = (id: string) => readable(id).replace(/^./, (c) => c.toUpperCase())

export interface CatalogRepair {
  ageGroups: string[]
  kinds: string[]
}

// Events, competitors, ranking points and results name an age group and a kind by id. When the admin has since changed the
// catalog and an id no longer exists, screens show the raw id and the entry rules cannot read it. This puts each missing
// age group back as a retired one, which keeps its name on old events and results but is never offered or matched to a
// birth year, and each missing kind as a kind of its own.
export function repairCatalogRefs(sqlite: Sqlite): CatalogRepair {
  const ids = (sql: string) => (sqlite.prepare(sql).all() as Array<{ id: string }>).map((r) => r.id)
  const missingGroups = ids(
    `SELECT DISTINCT age_group AS id FROM (
       SELECT age_group FROM events UNION SELECT age_group FROM competitors UNION SELECT age_group FROM ranking_points
     ) WHERE age_group IS NOT NULL AND age_group NOT IN (SELECT id FROM age_groups)`,
  )
  const missingKinds = ids('SELECT DISTINCT kind AS id FROM events WHERE kind NOT IN (SELECT id FROM event_kinds)')

  const addGroup = sqlite.prepare('INSERT INTO age_groups (id, name, short, born_from, born_to, juvenile_fee, family, retired) VALUES (?, ?, ?, ?, ?, ?, NULL, 1)')
  for (const id of missingGroups) {
    const known = DEFAULT_AGE_GROUPS.find((g) => g.id === id)
    addGroup.run(id, known?.name ?? titled(id), known?.short ?? readable(id).toUpperCase(), known?.bornFrom ?? null, known?.bornTo ?? null, known?.juvenileFee ? 1 : 0)
  }

  const next = (sqlite.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM event_kinds').get() as { n: number }).n
  const addKind = sqlite.prepare('INSERT INTO event_kinds (id, name, fee_mode, closed_to_province, disciplines, requires, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)')
  missingKinds.forEach((id, i) => {
    const known = DEFAULT_EVENT_KINDS.find((k) => k.id === id)
    addKind.run(id, known?.name ?? titled(id), known?.feeMode ?? 'standard', known?.closedToProvince ? 1 : 0, JSON.stringify(known?.disciplines ?? ['latin', 'standard']), JSON.stringify(known?.requires ?? []), next + i)
  })

  return { ageGroups: missingGroups, kinds: missingKinds }
}
