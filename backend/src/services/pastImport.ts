import { recalledIds } from '@bis/scoring'
import {
  DISCIPLINE_DANCES,
  RoundType,
  type Dance,
  type Discipline,
  type PastImportReport,
  type PastIssue,
  type PastRow,
  type PastSheet,
  type PastWorkbook,
} from '@bis/shared'
import { and, eq } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { recomputeEventPoints } from './ranking.ts'
import { callbackFor, writeResults } from './scrutiny.ts'
import { catalogOf, checkPhoto, clean, saveHeats, splitIntoHeats } from './shared.ts'

const ORDER: RoundType[] = [RoundType.Round1, RoundType.Round2, RoundType.QuarterFinal, RoundType.SemiFinal, RoundType.Final]
const LETTERS = 'ABCDEFGHIJ'.split('')
const MAX_ROWS = 50_000

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const plain = (s: string) => s.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
const whole = (s: string | undefined) => (s && /^\d+$/.test(s) ? Number(s) : null)

const ROUND_NAMES: Record<string, RoundType> = {
  round1: RoundType.Round1, r1: RoundType.Round1, firstround: RoundType.Round1,
  round2: RoundType.Round2, r2: RoundType.Round2, secondround: RoundType.Round2,
  quarterfinal: RoundType.QuarterFinal, quarterfinals: RoundType.QuarterFinal, qf: RoundType.QuarterFinal,
  semifinal: RoundType.SemiFinal, semifinals: RoundType.SemiFinal, sf: RoundType.SemiFinal,
  final: RoundType.Final, f: RoundType.Final,
}

const DANCE_NAMES: Record<string, Dance> = {
  samba: 'samba', chachacha: 'cha_cha_cha', chacha: 'cha_cha_cha', rumba: 'rumba', pasodoble: 'paso_doble', paso: 'paso_doble', jive: 'jive',
  waltz: 'waltz', slowwaltz: 'waltz', tango: 'tango', viennesewaltz: 'viennese_waltz', vienesewaltz: 'viennese_waltz', foxtrot: 'foxtrot', quickstep: 'quickstep',
}

const yes = (v: string | undefined) => ['yes', 'y', 'true', '1'].includes((v ?? '').toLowerCase())
const no = (v: string | undefined) => ['no', 'n', 'false', '0'].includes((v ?? '').toLowerCase())

interface MarkLine {
  row: number
  round: RoundType
  letter: string
  bn: number
  dance: Dance
  x: boolean
  placing: number | null
}

interface EventPlan {
  row: number
  number: number
  ageGroup: string
  class: string
  discipline: Discipline
  dances: Dance[]
  solo: boolean
  kind: string
  province: string
  usesPoints: boolean
  entries: Set<number>
  // Each round's field in back numbers, in the order they are danced
  rounds: Array<{ type: RoundType; field: Set<number>; recall: number | null }>
  marks: MarkLine[]
  placings: Map<number, number>
}

interface Plan {
  name: string
  date: string
  venue: string
  organizer: string
  executor: string
  image: string
  events: EventPlan[]
  competitors: Map<number, { names: string[]; team: string; birthDate: string | null }>
  adjudicators: Array<{ letter: string; name: string; id: string | null }>
}

class Preview extends Error {
  report: PastImportReport

  constructor(report: PastImportReport) {
    super('preview')
    this.report = report
  }
}

const emptyCounts = (): PastImportReport['counts'] => ({ events: 0, competitors: 0, adjudicators: 0, rounds: 0, marks: 0, results: 0, newTeams: 0, newAdjudicators: 0 })

function sheetRows(book: PastWorkbook, sheet: PastSheet, errors: PastIssue[]): PastRow[] {
  const raw = book.sheets?.[sheet]
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    errors.push({ sheet, row: 0, message: 'This sheet could not be read.' })
    return []
  }
  if (raw.length > MAX_ROWS) {
    errors.push({ sheet, row: 0, message: `This sheet has more than ${MAX_ROWS} rows.` })
    return []
  }
  return raw.map((r) => {
    const out: PastRow = {}
    for (const [k, v] of Object.entries(r ?? {})) out[k.trim().toLowerCase()] = typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim()
    return out
  })
}

// A blank line in the middle of a sheet is skipped, and the rows after it keep the numbers the spreadsheet shows
const each = (list: PastRow[], fn: (r: PastRow, i: number) => void) => list.forEach((r, i) => (Object.values(r).every((v) => v === '') ? undefined : fn(r, i)))

const mode = (values: number[]) => {
  const count = new Map<number, number>()
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1)
  return [...count].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? null
}

// Reads the workbook and checks it against itself and the catalog. Nothing is written.
function buildPlan(ctx: Ctx, book: PastWorkbook, errors: PastIssue[]): Plan | null {
  const err = (sheet: PastSheet | 'File', row: number, message: string) => void errors.push({ sheet, row, message })
  const get = (sheet: PastSheet) => sheetRows(book, sheet, errors)

  // ---- Competition ----
  const comp = get('Competition').filter((r) => Object.values(r).some((v) => v !== ''))
  if (comp.length !== 1) err('Competition', 0, comp.length === 0 ? 'Add one row with the competition.' : 'Only one competition can be imported at a time.')
  const c = comp[0] ?? {}
  for (const col of ['name', 'date', 'venue', 'organizer']) if (!c[col]) err('Competition', 2, `Fill in the ${col}.`)
  if (c.date && !/^\d{4}-\d{2}-\d{2}$/.test(c.date)) err('Competition', 2, 'Write the date as year-month-day, such as 2024-03-16.')
  if (c.name && c.date && ctx.db.select().from(t.competitions).where(and(eq(t.competitions.name, c.name), eq(t.competitions.date, c.date))).get()) {
    err('Competition', 2, 'A competition with this name and date is already in the system.')
  }
  try {
    checkPhoto(book.image)
  } catch (e) {
    err('File', 0, `The competition card photo: ${(e as Error).message}`)
  }

  // ---- Adjudicators ----
  const taken = new Set(ctx.db.select({ letter: t.adjudicators.letter }).from(t.adjudicators).all().map((a) => a.letter))
  const existing = ctx.db.select().from(t.adjudicators).all()
  const adjudicators: Plan['adjudicators'] = []
  const letters = new Set<string>()
  each(get('Adjudicators'), (r, i) => {
    const row = i + 2
    const letter = (r.letter ?? '').toUpperCase()
    if (!r.name || !letter) return err('Adjudicators', row, 'Each adjudicator needs a letter and a name.')
    if (letters.has(letter)) return err('Adjudicators', row, `Letter ${letter} is listed twice.`)
    letters.add(letter)
    const known = existing.find((a) => plain(a.name) === plain(r.name!))
    adjudicators.push({ letter, name: r.name, id: known?.id ?? null })
  })
  const claimed = new Set<string>()
  for (const a of adjudicators) {
    if (a.id) continue
    // The letter on the sheet when it is free, otherwise the next free one; letters belong to the system, not the competition
    const free = [a.letter, ...LETTERS].find((l) => LETTERS.includes(l) && !taken.has(l) && !claimed.has(l))
    if (!free) err('Adjudicators', 0, `There is no free adjudicator letter left for ${a.name}. Use the name of an adjudicator already in the system.`)
    else claimed.add(free)
  }

  // ---- Competitors ----
  const competitors: Plan['competitors'] = new Map()
  each(get('Competitors'), (r, i) => {
    const row = i + 2
    const bn = whole(r.back_number)
    if (!bn || bn < 1) return err('Competitors', row, 'The back number is a whole number from 1.')
    if (competitors.has(bn)) return err('Competitors', row, `Back number ${bn} is listed twice.`)
    if (!r.name_1) return err('Competitors', row, 'Fill in name 1.')
    if (!r.team) return err('Competitors', row, 'Fill in the team.')
    const birth = r.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(r.birth_date) ? r.birth_date : null
    if (r.birth_date && !birth) err('Competitors', row, 'Write the birth date as year-month-day, or leave it empty.')
    competitors.set(bn, { names: [r.name_1, r.name_2].filter((n): n is string => !!n), team: r.team, birthDate: birth })
  })

  // ---- Events ----
  const catalog = catalogOf(ctx)
  const events = new Map<number, EventPlan>()
  each(get('Events'), (r, i) => {
    const row = i + 2
    const number = whole(r.event_no)
    if (!number || number < 1) return err('Events', row, 'The event number is a whole number from 1.')
    if (events.has(number)) return err('Events', row, `Event ${number} is listed twice.`)
    const discipline = r.discipline?.toLowerCase() as Discipline
    if (discipline !== 'latin' && discipline !== 'standard') return err('Events', row, 'The discipline is Latin or Standard.')
    const dances = (r.dances ?? '').split(/[,;/]/).map((d) => d.trim()).filter(Boolean).map((d) => DANCE_NAMES[squash(d)])
    if (dances.length === 0 || dances.some((d) => !d)) return err('Events', row, 'List the dances with commas, such as waltz, tango.')
    if (dances.some((d) => !DISCIPLINE_DANCES[discipline].includes(d!))) return err('Events', row, `These dances do not belong to ${discipline}.`)
    if (new Set(dances).size !== dances.length) return err('Events', row, 'A dance is listed twice.')
    const age = catalog.ageGroups.find((g) => g.id === r.age_group || [g.name, g.short].some((n) => n.toLowerCase() === (r.age_group ?? '').toLowerCase()) && !g.retired)
      ?? catalog.ageGroups.find((g) => [g.name, g.short].some((n) => n.toLowerCase() === (r.age_group ?? '').toLowerCase()))
    if (!age) return err('Events', row, `The age group "${r.age_group ?? ''}" is not in the system. Add it under Categories first.`)
    const cls = catalog.classes.find((k) => k.name.toLowerCase() === (r.class ?? '').toLowerCase())
    if (!cls) return err('Events', row, `The class "${r.class ?? ''}" is not in the system. Add it under Categories first.`)
    const kind = r.kind ? catalog.kinds.find((k) => k.id === r.kind || k.name.toLowerCase() === r.kind!.toLowerCase()) : catalog.kinds.find((k) => k.id === 'standard')
    if (!kind) return err('Events', row, `The kind "${r.kind ?? ''}" is not in the system.`)
    if (r.solo && !yes(r.solo) && !no(r.solo)) return err('Events', row, 'Solo is yes or no.')
    if (r.uses_points && !yes(r.uses_points) && !no(r.uses_points)) return err('Events', row, 'Uses points is yes or no.')
    events.set(number, {
      row, number, ageGroup: age.id, class: cls.name, discipline, dances: dances as Dance[], solo: yes(r.solo), kind: kind.id,
      province: r.province ?? '', usesPoints: !no(r.uses_points), entries: new Set(), rounds: [], marks: [], placings: new Map(),
    })
  })

  const eventOf = (sheet: PastSheet, row: number, r: PastRow) => {
    const e = events.get(whole(r.event_no) ?? -1)
    if (!e) err(sheet, row, `Event ${r.event_no || '(empty)'} is not in the Events sheet.`)
    return e
  }
  const bnOf = (sheet: PastSheet, row: number, r: PastRow) => {
    const bn = whole(r.back_number)
    if (bn === null || !competitors.has(bn)) {
      err(sheet, row, `Back number ${r.back_number || '(empty)'} is not in the Competitors sheet.`)
      return null
    }
    return bn
  }

  // ---- Entries, Rounds, Placings ----
  each(get('Entries'), (r, i) => {
    const e = eventOf('Entries', i + 2, r)
    const bn = bnOf('Entries', i + 2, r)
    if (e && bn !== null) e.entries.add(bn)
  })
  const fields = new Map<EventPlan, Map<RoundType, Set<number>>>()
  each(get('Rounds'), (r, i) => {
    const row = i + 2
    const e = eventOf('Rounds', row, r)
    const bn = bnOf('Rounds', row, r)
    const type = ROUND_NAMES[squash(r.round ?? '')]
    if (!type) return err('Rounds', row, `"${r.round ?? ''}" is not a round. Use round_1, round_2, quarter_final, semi_final or final.`)
    if (!e || bn === null) return
    const byType = fields.get(e) ?? new Map<RoundType, Set<number>>()
    fields.set(e, byType)
    byType.set(type, (byType.get(type) ?? new Set()).add(bn))
  })
  each(get('Placings'), (r, i) => {
    const row = i + 2
    const e = eventOf('Placings', row, r)
    const bn = bnOf('Placings', row, r)
    const place = whole(r.place)
    if (!place || place < 1) return err('Placings', row, 'The place is a whole number from 1.')
    if (!e || bn === null) return
    if (e.placings.has(bn)) return err('Placings', row, `Back number ${bn} has two places.`)
    e.placings.set(bn, place)
    e.entries.add(bn)
  })

  // ---- Marks ----
  const known = new Set(adjudicators.map((a) => a.letter))
  each(get('Marks'), (r, i) => {
    const row = i + 2
    const e = eventOf('Marks', row, r)
    const bn = bnOf('Marks', row, r)
    const round = ROUND_NAMES[squash(r.round ?? '')]
    const letter = (r.adjudicator ?? '').toUpperCase()
    const dance = DANCE_NAMES[squash(r.dance ?? '')]
    if (!round) return err('Marks', row, `"${r.round ?? ''}" is not a round.`)
    if (!known.has(letter)) return err('Marks', row, `Adjudicator ${r.adjudicator || '(empty)'} is not in the Adjudicators sheet.`)
    if (!e || bn === null) return
    if (!dance || !e.dances.includes(dance)) return err('Marks', row, `"${r.dance ?? ''}" is not one of event ${e.number}'s dances.`)
    const mark = (r.mark ?? '').toUpperCase()
    if (round === RoundType.Final) {
      const placing = whole(mark)
      if (!placing || placing < 1) return err('Marks', row, 'A mark in the final is a placing: 1, 2, 3...')
      e.marks.push({ row, round, letter, bn, dance, x: false, placing })
    } else {
      if (mark !== 'X') return err('Marks', row, 'A mark before the final is X.')
      e.marks.push({ row, round, letter, bn, dance, x: true, placing: null })
    }
    e.entries.add(bn)
  })

  // ---- Each event ----
  for (const e of events.values()) {
    const byType = fields.get(e)
    if (e.marks.length > 0) {
      if (byType) {
        for (const type of ORDER) if (byType.has(type)) e.rounds.push({ type, field: byType.get(type)!, recall: null })
      } else if (e.marks.every((m) => m.round === RoundType.Final)) {
        e.rounds.push({ type: RoundType.Final, field: new Set(e.marks.map((m) => m.bn)), recall: null })
      } else {
        err('Rounds', 0, `Event ${e.number} has marks before the final, so list who danced each round in the Rounds sheet.`)
        continue
      }
      for (const m of e.marks) if (!e.rounds.some((r) => r.type === m.round)) err('Marks', m.row, `Event ${e.number} has no ${m.round.replace('_', ' ')} in the Rounds sheet.`)
      if (e.rounds[e.rounds.length - 1]!.type !== RoundType.Final) err('Rounds', 0, `Event ${e.number}: the last round must be the final.`)
      e.rounds.forEach((round, k) => {
        for (const bn of round.field) e.entries.add(bn)
        const previous = e.rounds[k - 1]
        if (previous) for (const bn of round.field) if (!previous.field.has(bn)) err('Rounds', 0, `Event ${e.number}: back number ${bn} is in the ${round.type.replace('_', ' ')} but was not in the round before.`)
      })
      checkRounds(e, err)
    } else if (e.placings.size === 0) {
      err('Events', e.row, `Event ${e.number} has no marks and no placings.`)
    }
    for (const bn of e.entries) {
      const person = competitors.get(bn)
      if (person && (person.names.length === 1) !== e.solo) err('Competitors', 0, `Back number ${bn} is ${person.names.length === 1 ? 'a solo dancer' : 'a couple'} but event ${e.number} is ${e.solo ? 'a solo' : 'a couple'} event.`)
    }
  }

  if (errors.length > 0) return null
  return {
    name: c.name!, date: c.date!, venue: c.venue!, organizer: c.organizer!, executor: c.executor ?? '', image: book.image,
    events: [...events.values()].sort((a, b) => a.number - b.number), competitors, adjudicators,
  }
}

// Every adjudicator who marked a round marked all of it: the same dances, every dancer in the final, the same number of X before it
function checkRounds(e: EventPlan, err: (sheet: PastSheet, row: number, message: string) => void) {
  for (const round of e.rounds) {
    const lines = e.marks.filter((m) => m.round === round.type)
    const label = `Event ${e.number}, ${round.type.replace('_', ' ')}`
    const seen = new Set<string>()
    for (const m of lines) {
      const key = `${m.letter}|${m.bn}|${m.dance}`
      if (seen.has(key)) err('Marks', m.row, `${label}: adjudicator ${m.letter} marked back number ${m.bn} twice in ${m.dance}.`)
      seen.add(key)
      if (!round.field.has(m.bn)) err('Marks', m.row, `${label}: back number ${m.bn} did not dance this round.`)
    }
    if (lines.length === 0) {
      err('Marks', 0, `${label} has no marks.`)
      continue
    }
    const dances = [...new Set(lines.map((m) => m.dance))]
    const panel = [...new Set(lines.map((m) => m.letter))].sort()
    const counts: number[] = []
    for (const letter of panel) {
      for (const dance of dances) {
        const mine = lines.filter((m) => m.letter === letter && m.dance === dance)
        if (mine.length === 0) err('Marks', 0, `${label}: adjudicator ${letter} has no marks for ${dance}.`)
        else if (round.type === RoundType.Final) {
          const places = mine.map((m) => m.placing!).sort((a, b) => a - b)
          if (mine.length !== round.field.size || places.some((p, k) => p !== k + 1)) err('Marks', 0, `${label}: adjudicator ${letter}'s placings for ${dance} must be 1 to ${round.field.size}, once each, for every dancer in the final.`)
        } else counts.push(mine.length)
      }
    }
    if (round.type === RoundType.Final) continue
    const recall = mode(counts)
    if (recall === null) continue
    if (counts.some((n) => n !== recall)) err('Marks', 0, `${label}: every adjudicator must mark the same number of X in every dance (most marked ${recall}).`)
    if (recall >= round.field.size) err('Marks', 0, `${label}: ${recall} X is not fewer than the ${round.field.size} who danced.`)
    round.recall = recall
  }
}

function write(ctx: Ctx, plan: Plan, report: PastImportReport) {
  const user = actor(ctx)
  const at = now()
  const counts = report.counts
  const warn = (sheet: PastSheet | 'File', message: string) => void report.warnings.push({ sheet, row: 0, message })

  const competitionId = newId()
  ctx.db.insert(t.competitions).values({
    id: competitionId, name: plan.name, date: plan.date, venue: plan.venue, organizer: plan.organizer, executor: plan.executor,
    image: plan.image, paymentRequired: false,
  }).run()

  // Adjudicators: by name when the system knows them, otherwise a new one on a free letter
  const used = new Set(ctx.db.select({ letter: t.adjudicators.letter }).from(t.adjudicators).all().map((a) => a.letter))
  const adjudicatorIds = new Map<string, string>()
  for (const a of plan.adjudicators) {
    if (a.id) {
      adjudicatorIds.set(a.letter, a.id)
      continue
    }
    const letter = [a.letter, ...LETTERS].find((l) => LETTERS.includes(l) && !used.has(l))!
    used.add(letter)
    const id = newId()
    ctx.db.insert(t.adjudicators).values({ id, name: a.name, letter }).run()
    adjudicatorIds.set(a.letter, id)
    counts.newAdjudicators++
  }
  counts.adjudicators = plan.adjudicators.length

  // Teams and competitors: the same team and the same names are the same dancers, so their history joins up
  const teams = new Map(ctx.db.select().from(t.teams).all().map((team) => [plain(team.name), team.id]))
  const key = (names: string[]) => names.map(plain).sort().join('|')
  const people = ctx.db.select().from(t.competitors).all()
  const competitorIds = new Map<number, string>()
  const onThisCompetition = new Set<number>(plan.events.flatMap((e) => [...e.entries]))
  for (const [bn, person] of plan.competitors) {
    if (!onThisCompetition.has(bn)) continue
    let teamId = teams.get(plain(person.team))
    if (!teamId) {
      teamId = newId()
      ctx.db.insert(t.teams).values({ id: teamId, name: person.team }).run()
      teams.set(plain(person.team), teamId)
      counts.newTeams++
    }
    const twin = people.find((p) => p.teamId === teamId && key(p.names) === key(person.names))
    if (twin) {
      competitorIds.set(bn, twin.id)
      continue
    }
    const row = { id: newId(), names: person.names, ageGroup: null, birthDate: person.birthDate, details: null, backNumber: null, teamId }
    ctx.db.insert(t.competitors).values(row).run()
    people.push(row)
    competitorIds.set(bn, row.id)
  }
  counts.competitors = competitorIds.size
  const idOf = (bn: number) => competitorIds.get(bn)!

  plan.events.forEach((e, index) => {
    const eventId = newId()
    ctx.db.insert(t.events).values({
      id: eventId, competitionId, number: e.number, position: index + 1, ageGroup: e.ageGroup, class: e.class, discipline: e.discipline,
      dances: e.dances, isSolo: e.solo, kind: e.kind, province: e.province, syllabus: '', usesPoints: e.usesPoints,
    }).run()
    counts.events++
    for (const bn of e.entries) ctx.db.insert(t.entries).values({ id: newId(), eventId, competitorId: idOf(bn) }).run()
    const eventRow = ctx.db.select().from(t.events).where(eq(t.events.id, eventId)).get()!

    if (e.marks.length > 0) {
      const panel = [...new Set(e.marks.map((m) => m.letter))]
      const panelId = newId()
      ctx.db.insert(t.panels).values({ id: panelId, eventId }).run()
      for (const letter of panel) ctx.db.insert(t.panelMembers).values({ panelId, adjudicatorId: adjudicatorIds.get(letter)! }).run()

      const rows = e.rounds.map((round, k) => {
        const id = newId()
        ctx.db.insert(t.rounds).values({
          id, eventId, type: round.type, position: k + 1, recallNumber: round.type === RoundType.Final ? null : round.recall,
          status: 'published', publishedAt: at, onFloorAt: null,
        }).run()
        saveHeats(ctx, id, splitIntoHeats(ctx, [...round.field].map(idOf)))
        const mine = e.marks.filter((m) => m.round === round.type)
        const marked = [...new Set(mine.map((m) => m.letter))]
        // Only part of the panel marked this round: keep who did
        if (marked.length !== panel.length) for (const letter of marked) ctx.db.insert(t.roundSets).values({ eventId, roundType: round.type, adjudicatorId: adjudicatorIds.get(letter)! }).run()
        for (const m of mine) {
          ctx.db.insert(t.marks).values({
            id: newId(), roundId: id, adjudicatorId: adjudicatorIds.get(m.letter)!, competitorId: idOf(m.bn), dance: m.dance,
            kind: m.x ? 'x' : 'placing', placing: m.placing, submittedAt: at,
          }).run()
          counts.marks++
        }
        for (const letter of marked) ctx.db.insert(t.submissions).values({ roundId: id, adjudicatorId: adjudicatorIds.get(letter)!, submittedAt: at, enteredBy: user.id }).run()
        counts.rounds++
        return ctx.db.select().from(t.rounds).where(eq(t.rounds.id, id)).get()!
      })

      // Do the recalls the marks give match who the sheet says went through?
      rows.forEach((row, k) => {
        const next = e.rounds[k + 1]
        if (!next || row.recallNumber === null) return
        const { result } = callbackFor(ctx, row, row.recallNumber)
        const label = `Event ${e.number}, ${row.type.replace('_', ' ')}`
        if (result.tie) return warn('Marks', `${label}: the marks leave a tie at the cut, so check who went through.`)
        const computed = new Set(recalledIds(result))
        const sheet = new Set([...next.field].map(idOf))
        if (computed.size !== sheet.size || [...computed].some((id) => !sheet.has(id))) warn('Rounds', `${label}: the marks recall different dancers from the ones listed in the next round.`)
      })

      writeResults(ctx, rows[rows.length - 1]!, eventRow, user.id)
      if (e.placings.size > 0) applyPrinted(ctx, e, eventId, idOf, user.id, at, warn)
    } else {
      printed(ctx, e, eventId, idOf, user.id, at)
      recomputeEventPoints(ctx, eventId)
    }
    counts.results += ctx.db.select().from(t.results).where(eq(t.results.eventId, eventId)).all().length
  })
}

// Results straight from the printed sheet, for an event with no marks
function printed(ctx: Ctx, e: EventPlan, eventId: string, idOf: (bn: number) => string, approvedBy: string, approvedAt: string) {
  const sharing = new Map<number, number>()
  for (const p of e.placings.values()) sharing.set(p, (sharing.get(p) ?? 0) + 1)
  for (const [bn, place] of e.placings) {
    ctx.db.insert(t.results).values({
      id: newId(), eventId, competitorId: idOf(bn), place, placeFrom: place, placeTo: place + (sharing.get(place) ?? 1) - 1,
      stage: 'final', approvedBy, approvedAt,
    }).run()
  }
}

// The printed sheet is the record: where the marks give another placing, it is kept and the difference is reported
function applyPrinted(ctx: Ctx, e: EventPlan, eventId: string, idOf: (bn: number) => string, approvedBy: string, approvedAt: string, warn: (sheet: PastSheet, message: string) => void) {
  const stored = new Map(ctx.db.select().from(t.results).where(eq(t.results.eventId, eventId)).all().map((r) => [r.competitorId, r]))
  const differs = [...e.placings].filter(([bn, place]) => stored.get(idOf(bn))?.place !== place)
  if (differs.length === 0) return
  warn('Placings', `Event ${e.number}: the marks place ${differs.map(([bn]) => `${bn} ${stored.get(idOf(bn))?.place ?? 'nowhere'}`).join(', ')}, not as printed (${differs.map(([bn, p]) => `${bn} ${p}`).join(', ')}). The printed placings are kept.`)
  const sharing = new Map<number, number>()
  for (const p of e.placings.values()) sharing.set(p, (sharing.get(p) ?? 0) + 1)
  for (const [bn, place] of e.placings) {
    const competitorId = idOf(bn)
    const row = stored.get(competitorId)
    const range = { place, placeFrom: place, placeTo: place + (sharing.get(place) ?? 1) - 1 }
    if (row) ctx.db.update(t.results).set(range).where(eq(t.results.id, row.id)).run()
    else ctx.db.insert(t.results).values({ id: newId(), eventId, competitorId, ...range, stage: 'final', approvedBy, approvedAt }).run()
  }
  recomputeEventPoints(ctx, eventId)
}

export const pastImport = {
  // Checks the workbook and, unless it is a trial run, saves the whole competition in one go: all of it or none of it
  importPastCompetition(ctx: Ctx, book: PastWorkbook, dryRun = true): PastImportReport {
    actor(ctx)
    if (!book || typeof book !== 'object' || typeof book.sheets !== 'object' || book.sheets === null) return fail('Send the workbook.')
    const report: PastImportReport = { imported: false, errors: [], warnings: [], counts: emptyCounts(), competitionName: clean(book.sheets.Competition?.[0]?.name) }
    const plan = buildPlan(ctx, book, report.errors)
    if (!plan) return report
    report.competitionName = plan.name
    try {
      ctx.sqlite.transaction(() => {
        write(ctx, plan, report)
        if (dryRun) throw new Preview(report)
      })()
    } catch (error) {
      if (error instanceof Preview) return error.report
      throw error
    }
    report.imported = true
    record(ctx.db, actor(ctx).id, 'Imported past competition', `${plan.name}, ${plan.date}`)
    ctx.defer(() => ctx.hub.rankings())
    return report
  },
}
