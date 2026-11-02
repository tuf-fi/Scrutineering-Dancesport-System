import type { Program, ProgramRow } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

const COMP = 'comp-sorsogon-2026'
let app: TestApp
let secretariat = ''
let scrutineer = ''

const read = () => app.ok<Program>('getProgram', [COMP])
const roundSlots = (p: Program) => p.rows.filter((r) => r.kind === 'round')
const statuses = (p: Program) => p.rows.map((r) => r.status)

// Puts the slot's round in a state without running it: the status logic only reads the round row
function setRound(row: ProgramRow, status: string, onFloor = false) {
  const round = app.sqlite.prepare('SELECT id FROM rounds WHERE event_id = ? AND type = ?').get(row.eventId, row.roundType) as { id: string }
  app.sqlite.prepare('UPDATE rounds SET status = ? WHERE id = ?').run(status, round.id)
  app.sqlite.prepare('UPDATE competitions SET floor_round_id = ? WHERE id = ?').run(onFloor ? round.id : null, COMP)
}

beforeAll(async () => {
  app = await startTestApp()
  secretariat = await app.signIn.staff('secretariat')
  scrutineer = await app.signIn.staff('scrutineer')
  // Start from a competition nobody has run
  app.sqlite.exec(`
    DELETE FROM tie_decisions; DELETE FROM marks; DELETE FROM submissions; DELETE FROM heat_competitors; DELETE FROM heats;
    DELETE FROM results; DELETE FROM ranking_points; DELETE FROM rounds; UPDATE competitions SET floor_round_id = NULL, date = date('now');
    DELETE FROM program_slots;
  `)
})
afterAll(() => app.close())

describe('the program', () => {
  it('is empty until it is generated, and anyone can read it', async () => {
    const guest = await read()
    expect(guest).toEqual({ start: null, rows: [] })
  })

  it('lays out rounds that are not planned yet, first rounds before finals', async () => {
    const generated = await app.ok<Program>('generateProgram', [COMP], secretariat)
    const slots = roundSlots(generated)
    expect(slots.length).toBeGreaterThan(10)
    const order = ['round_1', 'round_2', 'quarter_final', 'semi_final', 'final']
    const ranks = slots.map((s) => order.indexOf(s.roundType!))
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(generated.rows.map((r) => r.sequence)).toEqual(generated.rows.map((_, i) => i + 1))
    expect(slots.every((s) => s.entryCount > 0 || s.roundType !== 'round_1')).toBe(true)
  })

  it('does not add anything when run again', async () => {
    const before = await read()
    const again = await app.ok<Program>('generateProgram', [COMP], secretariat)
    expect(again.rows.map((r) => r.slotId)).toEqual(before.rows.map((r) => r.slotId))
  })

  it('works out times from the start time and reflows them after a change', async () => {
    const set = await app.ok<Program>('setProgramStart', [COMP, '07:00'], secretariat)
    const [first, second, third] = set.rows
    expect(first!.startTime).toBe('07:00')
    expect(second!.startTime).toBe(`07:${String(first!.minutes).padStart(2, '0')}`)

    const longer = await app.ok<Program>('updateProgramSlot', [first!.slotId, { minutes: 20 }], secretariat)
    expect(longer.rows[1]!.startTime).toBe('07:20')
    expect(longer.rows[2]!.startTime).not.toBe(third!.startTime)
  })

  it('inserts a break where asked and moves lines', async () => {
    const before = await read()
    const added = await app.ok<Program>('addProgramBreak', [COMP, { kind: 'break', label: 'Lunch', minutes: 45, afterSequence: 2 }], secretariat)
    expect(added.rows).toHaveLength(before.rows.length + 1)
    expect(added.rows[2]).toMatchObject({ kind: 'break', label: 'Lunch', minutes: 45, sequence: 3, eventId: null })
    expect(added.rows.map((r) => r.sequence)).toEqual(added.rows.map((_, i) => i + 1))

    const moved = await app.ok<Program>('moveProgramSlot', [added.rows[2]!.slotId, 'down'], secretariat)
    expect(moved.rows[3]!.label).toBe('Lunch')
    expect((await app.call('moveProgramSlot', [moved.rows[0]!.slotId, 'up'], secretariat)).status).toBe(400)

    const removed = await app.ok<Program>('removeProgramSlot', [moved.rows[3]!.slotId], secretariat)
    expect(removed.rows).toHaveLength(before.rows.length)
    expect(removed.rows.map((r) => r.sequence)).toEqual(removed.rows.map((_, i) => i + 1))
  })

  it('refuses bad input', async () => {
    expect((await app.call('setProgramStart', [COMP, '25:00'], secretariat)).status).toBe(400)
    expect((await app.call('addProgramBreak', [COMP, { kind: 'break', label: ' ', minutes: 10 }], secretariat)).status).toBe(400)
    expect((await app.call('addProgramBreak', [COMP, { kind: 'round', label: 'x', minutes: 10 }], secretariat)).status).toBe(400)
    const [first] = (await read()).rows
    expect((await app.call('updateProgramSlot', [first!.slotId, { minutes: 0 }], secretariat)).status).toBe(400)
    expect((await app.call('updateProgramSlot', [first!.slotId, { label: 'Renamed' }], secretariat)).status).toBe(400)
  })

  it('is edited by the secretariat only', async () => {
    expect((await app.call('generateProgram', [COMP])).status).toBe(401)
    expect((await app.call('generateProgram', [COMP], scrutineer)).status).toBe(403)
  })

  it('tells the public screens when it changes', async () => {
    app.hub.sent.length = 0
    await app.ok('setProgramStart', [COMP, '08:00'], secretariat)
    expect(app.hub.sent.some((e) => e.event === 'program')).toBe(true)
  })
})

describe('my entries', () => {
  it('gives the events a back number is entered in, and nothing else', async () => {
    const row = app.sqlite
      .prepare('select c.back_number as b from competitors c join entries e on e.competitor_id = c.id join events ev on ev.id = e.event_id where ev.competition_id = ? and e.scratched = 0 and c.back_number is not null group by c.id having count(*) > 1 limit 1')
      .get(COMP) as { b: number }
    const expected = (app.sqlite
      .prepare('select e.event_id as id from entries e join competitors c on c.id = e.competitor_id join events ev on ev.id = e.event_id where c.back_number = ? and ev.competition_id = ? and e.scratched = 0')
      .all(row.b, COMP) as Array<{ id: string }>).map((r) => r.id)
    expect(expected.length).toBeGreaterThan(1)
    const guest = await app.ok<string[]>('getEntriesByBackNumber', [COMP, row.b])
    expect([...guest].sort()).toEqual([...expected].sort())
    expect(await app.ok<string[]>('getEntriesByBackNumber', [COMP, 999999])).toEqual([])
    expect(await app.ok<string[]>('getEntriesByBackNumber', [COMP, 'abc'])).toEqual([])
  })

  it('leaves out a scratched entry', async () => {
    const row = app.sqlite
      .prepare('select e.id as entry, e.event_id as event, c.back_number as b from entries e join competitors c on c.id = e.competitor_id join events ev on ev.id = e.event_id where ev.competition_id = ? and e.scratched = 0 and c.back_number is not null limit 1')
      .get(COMP) as { entry: string; event: string; b: number }
    app.sqlite.prepare('update entries set scratched = 1 where id = ?').run(row.entry)
    expect(await app.ok<string[]>('getEntriesByBackNumber', [COMP, row.b])).not.toContain(row.event)
  })
})

describe('the status of each line', () => {
  beforeAll(async () => {
    await app.ok('planRounds', [COMP], scrutineer)
    await app.ok('addProgramBreak', [COMP, { kind: 'break', label: 'Break', minutes: 10, afterSequence: 1 }], secretariat)
  })

  it('has nothing current and the first round next when nothing has started', async () => {
    const p = await read()
    expect(statuses(p)[0]).toBe('next')
    expect(statuses(p).filter((s) => s === 'next')).toHaveLength(1)
    expect(statuses(p)).not.toContain('current')
    expect(statuses(p)).not.toContain('completed')
  })

  it('marks approved rounds completed, the round on the floor current and the one after it next', async () => {
    const p = await read()
    const [a, , b, c] = p.rows
    expect(p.rows[1]!.kind).toBe('break')
    setRound(a!, 'published')
    setRound(b!, 'marking', true)
    const now = await read()
    expect(now.rows[0]!.status).toBe('completed')
    expect(now.rows[2]!.status).toBe('current')
    expect(now.rows[3]!.status).toBe('next')
    expect(now.rows.slice(4).every((r) => r.status === 'upcoming')).toBe(true)
    // The break between two rounds is over once the later one has started
    expect(now.rows[1]!.status).toBe('completed')
    expect(c!.slotId).toBe(now.rows[3]!.slotId)
  })

  it('marks every line completed once the day has passed, even with a round left on the floor', async () => {
    const p = await read()
    setRound(p.rows[0]!, 'published')
    setRound(p.rows[2]!, 'marking', true)
    app.sqlite.prepare("UPDATE competitions SET date = '2020-01-01' WHERE id = ?").run(COMP)
    const past = await read()
    expect(statuses(past).filter((s) => s !== 'completed' && s !== null)).toEqual([])
    app.sqlite.prepare("UPDATE competitions SET date = date('now') WHERE id = ?").run(COMP)
  })

  it('makes the next line the break when a break follows the current round', async () => {
    const p = await read()
    setRound(p.rows[0]!, 'marking', true)
    const now = await read()
    expect(now.rows[0]!.status).toBe('current')
    expect(now.rows[1]!.status).toBe('next')
  })

  it('gives the guest the panel letters and no names', async () => {
    const rows = roundSlots(await read())
    expect(rows.some((r) => r.panel.length > 0)).toBe(true)
    expect(rows.flatMap((r) => r.panel).every((l) => /^[A-J]$/.test(l))).toBe(true)
  })
})
