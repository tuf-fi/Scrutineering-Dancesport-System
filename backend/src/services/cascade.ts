import { Role, type DeleteImpact, type DeleteImpactItem, type DeleteKind } from '@bis/shared'
import { actor, fail, type Ctx } from '../core/context.ts'

// Deleting something that other rows depend on: what would go with it, and doing it. The delete functions refuse
// when there is related data unless they are told to cascade; the screens show this list first and then say so.
// People (dancers, adjudicators, athletes) and competitions are never deleted as a side effect:
// they are only taken off the event or competition that goes.

const ADMIN_ONLY: DeleteKind[] = ['competition', 'ageGroup', 'eventKind', 'adjudicator', 'staff']
const MAX_LINES = 300

const inList = (ids: string[]) => ids.map(() => '?').join(', ')

// ---- Reading

type Row = Record<string, unknown>
const rows = (ctx: Ctx, sql: string, ...args: unknown[]): Row[] => ctx.sqlite.prepare(sql).all(...(args as never[])) as Row[]
const count = (ctx: Ctx, sql: string, ...args: unknown[]): number => (ctx.sqlite.prepare(`SELECT COUNT(*) AS n FROM ${sql}`).get(...(args as never[])) as { n: number }).n
const column = (ctx: Ctx, sql: string, ...args: unknown[]): string[] => rows(ctx, sql, ...args).map((r) => String(Object.values(r)[0]))
const namesOf = (json: unknown): string => {
  try {
    return (JSON.parse(String(json)) as string[]).join(' & ')
  } catch {
    return String(json)
  }
}

// An item with one line for each record that goes; a very long list is cut with a note
function listed(label: string, lines: string[], effect: 'delete' | 'change' = 'delete'): DeleteImpactItem[] {
  if (lines.length === 0) return []
  const shown = lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES), `and ${lines.length - MAX_LINES} more`] : lines
  return [{ label, count: lines.length, lines: shown, effect }]
}
// An item that is only a number: marks, heat places and the like have nothing to read on their own
function counted(label: string, n: number): DeleteImpactItem[] {
  return n > 0 ? [{ label, count: n, lines: [], effect: 'delete' }] : []
}

function eventIdsOf(ctx: Ctx, kind: DeleteKind, id: string): string[] {
  if (kind === 'event') return [id]
  if (kind === 'competition') return column(ctx, 'SELECT id FROM events WHERE competition_id = ? ORDER BY number', id)
  if (kind === 'ageGroup') return column(ctx, 'SELECT id FROM events WHERE age_group = ? ORDER BY number', id)
  if (kind === 'eventKind') return column(ctx, 'SELECT id FROM events WHERE kind = ? ORDER BY number', id)
  return []
}

// "E12  Waltz, Juvenile 1, class E1, solo" for each event, and a short "E12" to point at it
function eventNames(ctx: Ctx, ids: string[]) {
  const groups = new Map(rows(ctx, 'SELECT id, name FROM age_groups').map((g) => [String(g.id), String(g.name)]))
  const full = new Map<string, string>()
  const short = new Map<string, string>()
  if (ids.length > 0) {
    for (const e of rows(ctx, `SELECT id, number, age_group, class, dances, is_solo FROM events WHERE id IN (${inList(ids)}) ORDER BY number`, ...ids)) {
      const dances = (JSON.parse(String(e.dances)) as string[]).map((d) => d.replace(/_/g, ' ')).join(', ')
      short.set(String(e.id), `E${e.number}`)
      full.set(String(e.id), `E${e.number}  ${dances}, ${groups.get(String(e.age_group)) ?? e.age_group}, class ${e.class}, ${e.is_solo ? 'solo' : 'couples'}`)
    }
  }
  return { full, short, of: (id: unknown) => short.get(String(id)) ?? '' }
}

const ADJUDICATOR_LABEL = "a.letter || ' ' || a.name"

// What the events in the list carry. The entries go, the dancers stay; the panels' adjudicators are taken off, not deleted
function underEvents(ctx: Ctx, events: string[], withEvents = false): DeleteImpactItem[] {
  if (events.length === 0) return []
  const q = inList(events)
  const names = eventNames(ctx, events)
  const rounds = `SELECT id FROM rounds WHERE event_id IN (${q})`
  const entryRows = rows(ctx, `SELECT e.event_id, e.scratched, c.names FROM entries e JOIN competitors c ON c.id = e.competitor_id WHERE e.event_id IN (${q}) ORDER BY e.event_id, c.names`, ...events)
  const scratched = entryRows.filter((r) => r.scratched).length
  const panelRows = rows(ctx, `SELECT id, event_id FROM panels WHERE event_id IN (${q})`, ...events)
  return [
    ...(withEvents ? listed('Events', events.map((id) => names.full.get(id) ?? id)) : []),
    ...listed(
      scratched > 0 ? `Entries (${scratched} scratched)` : 'Entries',
      entryRows.map((r) => `${namesOf(r.names)}, ${names.of(r.event_id)}${r.scratched ? ' (scratched)' : ''}`),
    ),
    ...listed('Rounds', rows(ctx, `SELECT event_id, type, status FROM rounds WHERE event_id IN (${q}) ORDER BY event_id, position`, ...events).map((r) => `${names.of(r.event_id)}, ${r.type} (${r.status})`)),
    ...counted('Adjudicator marks', count(ctx, `marks WHERE round_id IN (${rounds})`, ...events)),
    ...counted('Submitted sheets', count(ctx, `submissions WHERE round_id IN (${rounds})`, ...events)),
    ...listed(
      'Results',
      rows(ctx, `SELECT r.event_id, r.place, c.names FROM results r JOIN competitors c ON c.id = r.competitor_id WHERE r.event_id IN (${q}) ORDER BY r.event_id, r.place`, ...events).map((r) => `${names.of(r.event_id)}, place ${r.place}: ${namesOf(r.names)}`),
    ),
    ...counted('Ranking points', count(ctx, `ranking_points WHERE event_id IN (${q})`, ...events)),
    ...listed(
      'Program lines',
      rows(ctx, `SELECT sequence, kind, event_id, round_type FROM program_slots WHERE event_id IN (${q}) ORDER BY sequence`, ...events).map((r) => `Line ${r.sequence}, ${r.kind} ${names.of(r.event_id)}${r.round_type ? ` ${r.round_type}` : ''}`),
    ),
    ...listed(
      'Adjudicators taken off the panel (they stay)',
      panelRows.flatMap((p) => column(ctx, `SELECT ${ADJUDICATOR_LABEL} FROM panel_members m JOIN adjudicators a ON a.id = m.adjudicator_id WHERE m.panel_id = ? ORDER BY a.letter`, String(p.id)).map((who) => `${who}, ${names.of(p.event_id)}`)),
      'change',
    ),
  ]
}

// What a dancer's removal takes: their entries and results. Their marks and places go with them
function underCompetitors(ctx: Ctx, competitors: string[]): DeleteImpactItem[] {
  if (competitors.length === 0) return []
  const q = inList(competitors)
  const eventOf = eventNames(ctx, column(ctx, `SELECT DISTINCT event_id FROM entries WHERE competitor_id IN (${q})`, ...competitors))
  return [
    ...listed(
      'Entries',
      rows(ctx, `SELECT e.event_id, e.scratched, c.names FROM entries e JOIN competitors c ON c.id = e.competitor_id WHERE e.competitor_id IN (${q}) ORDER BY c.names`, ...competitors).map(
        (r) => `${namesOf(r.names)}, ${eventOf.of(r.event_id)}${r.scratched ? ' (scratched)' : ''}`,
      ),
    ),
    ...counted('Adjudicator marks', count(ctx, `marks WHERE competitor_id IN (${q})`, ...competitors)),
    ...counted('Results', count(ctx, `results WHERE competitor_id IN (${q})`, ...competitors)),
    ...counted('Ranking points', count(ctx, `ranking_points WHERE competitor_id IN (${q})`, ...competitors)),
    ...counted('Places in heats', count(ctx, `heat_competitors WHERE competitor_id IN (${q})`, ...competitors)),
    ...listed('Entry requests', rows(ctx, `SELECT requester_name FROM entry_requests WHERE competitor_id IN (${q})`, ...competitors).map((r) => String(r.requester_name))),
  ]
}

const paymentLines = (ctx: Ctx, where: string, id: string) =>
  rows(ctx, `SELECT p.late, p.reference_number, t.name AS team FROM payments p LEFT JOIN teams t ON t.id = p.team_id WHERE ${where}`, id).map(
    (r) => `${r.team ?? 'Payment'}${r.late ? ', late' : ''}${r.reference_number ? `, ref ${r.reference_number}` : ''}`,
  )

const coachedBy = (ctx: Ctx, coachId: string): Array<{ id: string; names: string }> =>
  rows(ctx, 'SELECT id, names, details FROM competitors WHERE details IS NOT NULL')
    .filter((c) => {
      try {
        return (JSON.parse(String(c.details)) as { coachId?: string | null }).coachId === coachId
      } catch {
        return false
      }
    })
    .map((c) => ({ id: String(c.id), names: namesOf(c.names) }))

export function deleteImpact(ctx: Ctx, kind: DeleteKind, id: string): DeleteImpact {
  const user = actor(ctx)
  if (ADMIN_ONLY.includes(kind) && user.role !== Role.Admin) return fail('Your account cannot do this.', 403)
  const one = (sql: string): Row | undefined => ctx.sqlite.prepare(sql).get(id) as Row | undefined
  const base = { kind, id, blocked: null as string | null }

  if (kind === 'event') {
    const row = one('SELECT number FROM events WHERE id = ?')
    if (!row) return fail('Event not found.', 404)
    return { ...base, name: `E${row.number}`, items: underEvents(ctx, [id]) }
  }
  if (kind === 'competition') {
    const row = one('SELECT name FROM competitions WHERE id = ?')
    if (!row) return fail('Competition not found.', 404)
    return {
      ...base,
      name: String(row.name),
      items: [
        ...underEvents(ctx, eventIdsOf(ctx, kind, id), true),
        ...listed('Payments', paymentLines(ctx, 'p.competition_id = ?', id)),
        ...listed('Adjudicator PINs for this competition (the adjudicators stay)', column(ctx, `SELECT ${ADJUDICATOR_LABEL} FROM adjudicator_pins p JOIN adjudicators a ON a.id = p.adjudicator_id WHERE p.competition_id = ? ORDER BY a.letter`, id), 'change'),
        ...listed('Entry requests', column(ctx, 'SELECT requester_name FROM entry_requests WHERE competition_id = ?', id)),
      ],
    }
  }
  if (kind === 'ageGroup' || kind === 'eventKind') {
    const table = kind === 'ageGroup' ? 'age_groups' : 'event_kinds'
    const row = one(`SELECT name FROM ${table} WHERE id = ?`)
    if (!row) return fail(`${kind === 'ageGroup' ? 'Age group' : 'Kind'} not found.`, 404)
    return {
      ...base,
      name: String(row.name),
      items: [
        ...underEvents(ctx, eventIdsOf(ctx, kind, id), true),
        ...(kind === 'ageGroup'
          ? [
              ...counted('Ranking points', count(ctx, 'ranking_points WHERE age_group = ?', id)),
              ...listed('Competitors left without this age group (they stay)', rows(ctx, 'SELECT names FROM competitors WHERE age_group = ?', id).map((r) => namesOf(r.names)), 'change'),
            ]
          : []),
      ],
    }
  }
  if (kind === 'team') {
    const row = one('SELECT name FROM teams WHERE id = ?')
    if (!row) return fail('Team not found.', 404)
    const dancers = rows(ctx, 'SELECT names FROM competitors WHERE team_id = ? ORDER BY names', id).map((d) => namesOf(d.names))
    return {
      ...base,
      name: String(row.name),
      // A dancer always belongs to a team, and no one is deleted by deleting a team
      blocked: dancers.length > 0 ? `${row.name} still has ${dancers.length === 1 ? 'a dancer' : `${dancers.length} dancers`}. Move them to another team first.` : null,
      items: [
        ...listed('Dancers and couples (they stay)', dancers, 'change'),
        ...listed('Payments', paymentLines(ctx, 'p.team_id = ?', id)),
        ...listed('Athletes left without a team (they stay)', column(ctx, 'SELECT name FROM athletes WHERE team_id = ? ORDER BY name', id), 'change'),
        ...listed('Accounts left unlinked (they stay)', column(ctx, "SELECT name || ' (' || email || ')' FROM member_accounts WHERE role = 'team' AND (linked_id = ? OR claim_id = ?)", id, id), 'change'),
      ],
    }
  }
  if (kind === 'coach') {
    const row = one('SELECT name FROM coaches WHERE id = ?')
    if (!row) return fail('Coach not found.', 404)
    return {
      ...base,
      name: String(row.name),
      items: [
        ...listed('Dancers left without a coach (they stay)', coachedBy(ctx, id).map((c) => c.names), 'change'),
        ...listed('Athletes left without a coach (they stay)', column(ctx, 'SELECT name FROM athletes WHERE coach_id = ? ORDER BY name', id), 'change'),
        ...listed('Accounts left unlinked (they stay)', column(ctx, "SELECT name || ' (' || email || ')' FROM member_accounts WHERE role = 'coach' AND (linked_id = ? OR claim_id = ?)", id, id), 'change'),
      ],
    }
  }
  if (kind === 'competitor') {
    const row = one('SELECT names FROM competitors WHERE id = ?')
    if (!row) return fail('Competitor not found.', 404)
    return { ...base, name: namesOf(row.names), items: underCompetitors(ctx, [id]) }
  }
  if (kind === 'staff') {
    const row = one('SELECT name, role, disabled FROM staff_users WHERE id = ?')
    if (!row) return fail('Staff account not found.', 404)
    const admins = count(ctx, "staff_users WHERE role = 'admin' AND disabled = 0")
    const blocked = id === user.id ? "You can't delete your own account." : row.role === Role.Admin && admins === 1 ? 'There must be at least one admin.' : null
    return { ...base, name: String(row.name), blocked, items: [] }
  }
  if (kind === 'athlete') {
    const row = one('SELECT name FROM athletes WHERE id = ?')
    if (!row) return fail('Athlete not found.', 404)
    return { ...base, name: String(row.name), items: counted('Notifications', count(ctx, 'notifications WHERE athlete_id = ?', id)) }
  }
  const row = one('SELECT letter, name FROM adjudicators WHERE id = ?')
  if (!row) return fail('Adjudicator not found.', 404)
  const places = rows(ctx, 'SELECT p.event_id FROM panel_members m JOIN panels p ON p.id = m.panel_id WHERE m.adjudicator_id = ?', id)
  const names = eventNames(ctx, places.map((p) => String(p.event_id)))
  return {
    ...base,
    name: String(row.name),
    items: [
      ...listed('Taken off these panels', places.map((p) => names.full.get(String(p.event_id)) ?? names.of(p.event_id)), 'change'),
      ...counted('Marks they gave', count(ctx, 'marks WHERE adjudicator_id = ?', id)),
      ...counted('Submitted sheets', count(ctx, 'submissions WHERE adjudicator_id = ?', id)),
      ...listed('PINs', column(ctx, 'SELECT c.name FROM adjudicator_pins p JOIN competitions c ON c.id = p.competition_id WHERE p.adjudicator_id = ?', id)),
    ],
  }
}

// ---- Doing it

const removeEvents = (ctx: Ctx, events: string[]) => {
  // The rounds, entries, marks, results, ranking points, panels and program lines follow by the database's own rules.
  // The dancers and adjudicators are not touched.
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
    ctx.sqlite.prepare('DELETE FROM payments WHERE team_id = ?').run(id)
    ctx.sqlite.prepare("UPDATE member_accounts SET linked_id = NULL WHERE role = 'team' AND linked_id = ?").run(id)
    ctx.sqlite.prepare("UPDATE member_accounts SET claim_id = NULL, claimed_at = NULL WHERE role = 'team' AND claim_id = ?").run(id)
    return void ctx.sqlite.prepare('DELETE FROM teams WHERE id = ?').run(id)
  }
  if (kind === 'coach') {
    const update = ctx.sqlite.prepare('UPDATE competitors SET details = ? WHERE id = ?')
    for (const competitor of coachedBy(ctx, id)) {
      const row = ctx.sqlite.prepare('SELECT details FROM competitors WHERE id = ?').get(competitor.id) as { details: string }
      update.run(JSON.stringify({ ...(JSON.parse(row.details) as object), coachId: null }), competitor.id)
    }
    ctx.sqlite.prepare("UPDATE member_accounts SET linked_id = NULL WHERE role = 'coach' AND linked_id = ?").run(id)
    ctx.sqlite.prepare("UPDATE member_accounts SET claim_id = NULL, claimed_at = NULL WHERE role = 'coach' AND claim_id = ?").run(id)
    return void ctx.sqlite.prepare('DELETE FROM coaches WHERE id = ?').run(id)
  }
  if (kind === 'competitor') return removeCompetitors(ctx, [id])
  if (kind === 'staff') return void ctx.sqlite.prepare('DELETE FROM staff_users WHERE id = ?').run(id)
  if (kind === 'athlete') return void ctx.sqlite.prepare('DELETE FROM athletes WHERE id = ?').run(id)
  ctx.sqlite.prepare('DELETE FROM marks WHERE adjudicator_id = ?').run(id)
  ctx.sqlite.prepare('DELETE FROM submissions WHERE adjudicator_id = ?').run(id)
  ctx.sqlite.prepare('DELETE FROM adjudicators WHERE id = ?').run(id)
}

// What the audit log says about a delete that took other rows with it
export const impactSummary = (impact: DeleteImpact): string =>
  impact.items.filter((i) => i.effect === 'delete').map((i) => `${i.count} ${i.label.toLowerCase().replace(/ \(.*\)$/, '')}`).join(', ')

// The guard every delete function runs: a blocked delete never goes through, and anything with related data needs the caller to say so
export function confirmCascade(ctx: Ctx, kind: DeleteKind, id: string, cascade: boolean | undefined): DeleteImpact {
  const impact = deleteImpact(ctx, kind, id)
  if (impact.blocked) return fail(impact.blocked, 409)
  if (impact.items.length > 0 && !cascade) return fail(`${impact.name} has related data. Confirm to delete it too.`, 409)
  return impact
}
