import { Role, type DeleteImpact, type DeleteImpactItem, type DeleteKind } from '@bis/shared'
import { actor, fail, type Ctx } from '../core/context.ts'

// Deleting something that other rows depend on: what would go with it, and doing it. The delete functions refuse
// when there is related data unless they are told to cascade; the screens show this list first and then say so.

const ADMIN_ONLY: DeleteKind[] = ['competition', 'ageGroup', 'eventKind', 'adjudicator']

const inList = (ids: string[]) => ids.map(() => '?').join(', ')

// ---- Reading

const count = (ctx: Ctx, sql: string, ...args: unknown[]): number => (ctx.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${sql}`).get(...(args as never[])) as { n: number }).n
const column = (ctx: Ctx, sql: string, ...args: unknown[]): string[] => (ctx.sqlite.prepare(sql).all(...(args as never[])) as Array<Record<string, unknown>>).map((r) => String(Object.values(r)[0]))
const namesOf = (json: string): string => {
  try {
    return (JSON.parse(json) as string[]).join(' & ')
  } catch {
    return json
  }
}

function eventIdsOf(ctx: Ctx, kind: DeleteKind, id: string): string[] {
  if (kind === 'event') return [id]
  if (kind === 'competition') return column(ctx, 'SELECT id FROM events WHERE competition_id = ?', id)
  if (kind === 'ageGroup') return column(ctx, 'SELECT id FROM events WHERE age_group = ?', id)
  if (kind === 'eventKind') return column(ctx, 'SELECT id FROM events WHERE kind = ?', id)
  return []
}

function item(label: string, n: number, examples: string[], effect: 'delete' | 'change' = 'delete'): DeleteImpactItem[] {
  return n > 0 ? [{ label, count: n, examples: examples.slice(0, 6), effect }] : []
}

// What the events in the list carry: entries, rounds, marks, results and the rest
function underEvents(ctx: Ctx, events: string[]): DeleteImpactItem[] {
  if (events.length === 0) return []
  const q = inList(events)
  const entries = count(ctx, `entries WHERE event_id IN (${q})`, ...events)
  const scratched = count(ctx, `entries WHERE scratched = 1 AND event_id IN (${q})`, ...events)
  const rounds = `SELECT id FROM rounds WHERE event_id IN (${q})`
  return [
    ...item(
      scratched > 0 ? `Entries (${scratched} scratched)` : 'Entries',
      entries,
      column(ctx, `SELECT c.names FROM entries e JOIN competitors c ON c.id = e.competitor_id WHERE e.event_id IN (${q}) LIMIT 6`, ...events).map(namesOf),
    ),
    ...item('Rounds', count(ctx, `rounds WHERE event_id IN (${q})`, ...events), column(ctx, `SELECT type FROM rounds WHERE event_id IN (${q}) LIMIT 6`, ...events)),
    ...item('Adjudicator marks', count(ctx, `marks WHERE round_id IN (${rounds})`, ...events), []),
    ...item('Submitted sheets', count(ctx, `submissions WHERE round_id IN (${rounds})`, ...events), []),
    ...item('Results', count(ctx, `results WHERE event_id IN (${q})`, ...events), []),
    ...item('Ranking points', count(ctx, `ranking_points WHERE event_id IN (${q})`, ...events), []),
    ...item('Panels', count(ctx, `panels WHERE event_id IN (${q})`, ...events), []),
    ...item('Program lines', count(ctx, `program_slots WHERE event_id IN (${q})`, ...events), []),
  ]
}

function underCompetitors(ctx: Ctx, competitors: string[]): DeleteImpactItem[] {
  if (competitors.length === 0) return []
  const q = inList(competitors)
  return [
    ...item('Entries', count(ctx, `entries WHERE competitor_id IN (${q})`, ...competitors), []),
    ...item('Adjudicator marks', count(ctx, `marks WHERE competitor_id IN (${q})`, ...competitors), []),
    ...item('Results', count(ctx, `results WHERE competitor_id IN (${q})`, ...competitors), []),
    ...item('Ranking points', count(ctx, `ranking_points WHERE competitor_id IN (${q})`, ...competitors), []),
    ...item('Places in heats', count(ctx, `heat_competitors WHERE competitor_id IN (${q})`, ...competitors), []),
    ...item('Entry requests', count(ctx, `entry_requests WHERE competitor_id IN (${q})`, ...competitors), []),
  ]
}

const coachedBy = (ctx: Ctx, coachId: string): string[] =>
  (ctx.sqlite.prepare('SELECT id, details FROM competitors WHERE details IS NOT NULL').all() as Array<{ id: string; details: string }>)
    .filter((c) => {
      try {
        return (JSON.parse(c.details) as { coachId?: string | null }).coachId === coachId
      } catch {
        return false
      }
    })
    .map((c) => c.id)

export function deleteImpact(ctx: Ctx, kind: DeleteKind, id: string): DeleteImpact {
  const user = actor(ctx)
  if (ADMIN_ONLY.includes(kind) && user.role !== Role.Admin) return fail('Your account cannot do this.', 403)
  const one = (sql: string): Record<string, unknown> | undefined => ctx.sqlite.prepare(sql).get(id) as Record<string, unknown> | undefined
  const base = { kind, id }

  if (kind === 'event') {
    const row = one('SELECT number FROM events WHERE id = ?')
    if (!row) return fail('Event not found.', 404)
    return { ...base, name: `E${row.number}`, items: underEvents(ctx, [id]) }
  }
  if (kind === 'competition') {
    const row = one('SELECT name FROM competitions WHERE id = ?')
    if (!row) return fail('Competition not found.', 404)
    const events = eventIdsOf(ctx, kind, id)
    return {
      ...base,
      name: String(row.name),
      items: [
        ...item('Events', events.length, column(ctx, 'SELECT number FROM events WHERE competition_id = ? ORDER BY number LIMIT 6', id).map((n) => `E${n}`)),
        ...underEvents(ctx, events),
        ...item('Payments', count(ctx, 'payments WHERE competition_id = ?', id), []),
        ...item('Adjudicator PINs', count(ctx, 'adjudicator_pins WHERE competition_id = ?', id), []),
        ...item('Entry requests', count(ctx, 'entry_requests WHERE competition_id = ?', id), []),
      ],
    }
  }
  if (kind === 'ageGroup' || kind === 'eventKind') {
    const table = kind === 'ageGroup' ? 'age_groups' : 'event_kinds'
    const row = one(`SELECT name FROM ${table} WHERE id = ?`)
    if (!row) return fail(`${kind === 'ageGroup' ? 'Age group' : 'Kind'} not found.`, 404)
    const events = eventIdsOf(ctx, kind, id)
    return {
      ...base,
      name: String(row.name),
      items: [
        ...item('Events', events.length, column(ctx, `SELECT number FROM events WHERE ${kind === 'ageGroup' ? 'age_group' : 'kind'} = ? ORDER BY number LIMIT 6`, id).map((n) => `E${n}`)),
        ...underEvents(ctx, events),
        ...(kind === 'ageGroup'
          ? [
              ...item('Ranking points', count(ctx, 'ranking_points WHERE age_group = ?', id), []),
              ...item('Competitors left without this age group', count(ctx, 'competitors WHERE age_group = ?', id), [], 'change'),
            ]
          : []),
      ],
    }
  }
  if (kind === 'team') {
    const row = one('SELECT name FROM teams WHERE id = ?')
    if (!row) return fail('Team not found.', 404)
    const dancers = column(ctx, 'SELECT id FROM competitors WHERE team_id = ?', id)
    return {
      ...base,
      name: String(row.name),
      items: [
        ...item('Dancers and couples', dancers.length, column(ctx, 'SELECT names FROM competitors WHERE team_id = ? LIMIT 6', id).map(namesOf)),
        ...underCompetitors(ctx, dancers),
        ...item('Payments', count(ctx, 'payments WHERE team_id = ?', id), []),
        ...item('Athletes left without a team', count(ctx, 'athletes WHERE team_id = ?', id), [], 'change'),
        ...item('Accounts left unlinked', count(ctx, "member_accounts WHERE role = 'team' AND (linked_id = ? OR claim_id = ?)", id, id), [], 'change'),
      ],
    }
  }
  if (kind === 'coach') {
    const row = one('SELECT name FROM coaches WHERE id = ?')
    if (!row) return fail('Coach not found.', 404)
    const coached = coachedBy(ctx, id)
    return {
      ...base,
      name: String(row.name),
      items: [
        ...item('Dancers left without a coach', coached.length, column(ctx, `SELECT names FROM competitors WHERE id IN (${inList(coached.slice(0, 6))})`, ...coached.slice(0, 6)).map(namesOf), 'change'),
        ...item('Athletes left without a coach', count(ctx, 'athletes WHERE coach_id = ?', id), [], 'change'),
        ...item('Accounts left unlinked', count(ctx, "member_accounts WHERE role = 'coach' AND (linked_id = ? OR claim_id = ?)", id, id), [], 'change'),
      ],
    }
  }
  if (kind === 'competitor') {
    const row = one('SELECT names FROM competitors WHERE id = ?')
    if (!row) return fail('Competitor not found.', 404)
    return { ...base, name: namesOf(String(row.names)), items: underCompetitors(ctx, [id]) }
  }
  const row = one('SELECT letter, name FROM adjudicators WHERE id = ?')
  if (!row) return fail('Adjudicator not found.', 404)
  return {
    ...base,
    name: String(row.name),
    items: [
      ...item('Panel places', count(ctx, 'panel_members WHERE adjudicator_id = ?', id), []),
      ...item('Marks they gave', count(ctx, 'marks WHERE adjudicator_id = ?', id), []),
      ...item('Submitted sheets', count(ctx, 'submissions WHERE adjudicator_id = ?', id), []),
      ...item('PINs', count(ctx, 'adjudicator_pins WHERE adjudicator_id = ?', id), []),
    ],
  }
}

// ---- Doing it

const removeEvents = (ctx: Ctx, events: string[]) => {
  // The rounds, entries, marks, results, ranking points, panels and program lines follow by the database's own rules
  for (const id of events) ctx.sqlite.prepare('DELETE FROM events WHERE id = ?').run(id)
}

export function removeCompetitors(ctx: Ctx, ids: string[]) {
  for (const id of ids) {
    for (const table of ['marks', 'heat_competitors', 'results', 'ranking_points']) ctx.sqlite.prepare(`DELETE FROM ${table} WHERE competitor_id = ?`).run(id)
    ctx.sqlite.prepare('DELETE FROM competitors WHERE id = ?').run(id)
  }
}

// Everything that goes with the thing, in an order the database accepts. The caller has already checked who may do it.
export function removeCascade(ctx: Ctx, kind: DeleteKind, id: string) {
  if (kind === 'event') return removeEvents(ctx, [id])
  if (kind === 'competition') return void ctx.sqlite.prepare('DELETE FROM competitions WHERE id = ?').run(id)
  if (kind === 'ageGroup') {
    removeEvents(ctx, eventIdsOf(ctx, kind, id))
    ctx.sqlite.prepare('DELETE FROM ranking_points WHERE age_group = ?').run(id)
    ctx.sqlite.prepare('UPDATE competitors SET age_group = NULL WHERE age_group = ?').run(id)
    return void ctx.sqlite.prepare('DELETE FROM age_groups WHERE id = ?').run(id)
  }
  if (kind === 'eventKind') {
    removeEvents(ctx, eventIdsOf(ctx, kind, id))
    return void ctx.sqlite.prepare('DELETE FROM event_kinds WHERE id = ?').run(id)
  }
  if (kind === 'team') {
    removeCompetitors(ctx, column(ctx, 'SELECT id FROM competitors WHERE team_id = ?', id))
    ctx.sqlite.prepare('DELETE FROM payments WHERE team_id = ?').run(id)
    ctx.sqlite.prepare("UPDATE member_accounts SET linked_id = NULL WHERE role = 'team' AND linked_id = ?").run(id)
    ctx.sqlite.prepare("UPDATE member_accounts SET claim_id = NULL, claimed_at = NULL WHERE role = 'team' AND claim_id = ?").run(id)
    return void ctx.sqlite.prepare('DELETE FROM teams WHERE id = ?').run(id)
  }
  if (kind === 'coach') {
    const update = ctx.sqlite.prepare('UPDATE competitors SET details = ? WHERE id = ?')
    for (const competitor of coachedBy(ctx, id)) {
      const row = ctx.sqlite.prepare('SELECT details FROM competitors WHERE id = ?').get(competitor) as { details: string }
      update.run(JSON.stringify({ ...(JSON.parse(row.details) as object), coachId: null }), competitor)
    }
    ctx.sqlite.prepare("UPDATE member_accounts SET linked_id = NULL WHERE role = 'coach' AND linked_id = ?").run(id)
    ctx.sqlite.prepare("UPDATE member_accounts SET claim_id = NULL, claimed_at = NULL WHERE role = 'coach' AND claim_id = ?").run(id)
    return void ctx.sqlite.prepare('DELETE FROM coaches WHERE id = ?').run(id)
  }
  if (kind === 'competitor') return removeCompetitors(ctx, [id])
  ctx.sqlite.prepare('DELETE FROM marks WHERE adjudicator_id = ?').run(id)
  ctx.sqlite.prepare('DELETE FROM submissions WHERE adjudicator_id = ?').run(id)
  ctx.sqlite.prepare('DELETE FROM adjudicators WHERE id = ?').run(id)
}

// What the audit log says about a delete that took other rows with it
export const impactSummary = (impact: DeleteImpact): string =>
  impact.items.filter((i) => i.effect === 'delete').map((i) => `${i.count} ${i.label.toLowerCase().replace(/ \(.*\)$/, '')}`).join(', ')


// The guard every delete function runs: anything with related data needs the caller to say so
export function confirmCascade(ctx: Ctx, kind: DeleteKind, id: string, cascade: boolean | undefined): DeleteImpact {
  const impact = deleteImpact(ctx, kind, id)
  if (impact.items.length > 0 && !cascade) return fail(`${impact.name} has related data. Confirm to delete it too.`, 409)
  return impact
}
