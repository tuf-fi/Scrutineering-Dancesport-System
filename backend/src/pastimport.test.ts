import type { Adjudicator, Catalog, Competition, CompetitorHistoryLine, PastImportReport, PastRow, PastWorkbook, Result } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TEST_PHOTO, startTestApp, type TestApp } from './testing.ts'

let app: TestApp
let admin: string
let secretariat: string
let book: PastWorkbook
let names: string[]

const rows = (list: string[][], header: string[]): PastRow[] => list.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])))
const copy = (b: PastWorkbook): PastWorkbook => JSON.parse(JSON.stringify(b))
const run = (b: PastWorkbook, dry: boolean, cookie = admin) => app.ok<PastImportReport>('importPastCompetition', [b, dry], cookie)

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
  secretariat = await app.signIn.staff('secretariat')
  const catalog = await app.ok<Catalog>('getCatalog', [])
  const adjudicators = await app.ok<Adjudicator[]>('getAdjudicators', [], admin)
  names = adjudicators.slice(0, 3).map((a) => a.name)
  const age = catalog.ageGroups.find((g) => !g.retired)!.name
  const cls = catalog.classes[0]!.name

  const couples = [1, 2, 3, 4, 5, 6, 7, 8]
  const marks: string[][] = []
  // Semi-final: A, B and C all recall 1 to 6
  for (const letter of ['A', 'B', 'C']) for (const bn of [1, 2, 3, 4, 5, 6]) marks.push(['1', 'semi_final', letter, String(bn), 'cha-cha', 'X'])
  // Final: everyone places them in the order of the back numbers
  for (const letter of ['A', 'B', 'C']) for (const bn of [1, 2, 3, 4, 5, 6]) marks.push(['1', 'final', letter, String(bn), 'cha-cha', String(bn)])

  const sheet = (header: string[], list: string[][]) => rows(list, header)
  book = {
    image: TEST_PHOTO,
    sheets: {
      Competition: sheet(['name', 'date', 'venue', 'organizer', 'executor'], [['Old Open 2019', '2019-03-16', 'Legazpi Gym', 'Bicol DanceSport', '']]),
      Events: sheet(['event_no', 'age_group', 'class', 'discipline', 'dances', 'solo'], [
        ['1', age, cls, 'Latin', 'cha-cha', 'no'],
        ['2', age, cls, 'Latin', 'samba', 'no'],
      ]),
      Competitors: sheet(['back_number', 'name_1', 'name_2', 'team'], couples.map((n) => [String(n), `Dancer ${n}a`, `Dancer ${n}b`, 'Old Team'])),
      Adjudicators: sheet(['letter', 'name'], [['A', names[0]!], ['B', names[1]!], ['C', names[2]!]]),
      Rounds: sheet(['event_no', 'round', 'back_number'], [...couples.map((n) => ['1', 'semi_final', String(n)]), ...[1, 2, 3, 4, 5, 6].map((n) => ['1', 'final', String(n)])]),
      Marks: sheet(['event_no', 'round', 'adjudicator', 'back_number', 'dance', 'mark'], marks),
      Placings: sheet(['event_no', 'back_number', 'place'], [['2', '1', '1'], ['2', '2', '2'], ['2', '3', '2']]),
    },
  }
})
afterAll(() => app.close())

describe('importing a past competition', () => {
  it('only the admin may', async () => {
    expect((await app.call('importPastCompetition', [book, true], secretariat)).status).toBe(403)
    expect((await app.call('importPastCompetition', [book, true])).status).toBe(401)
  })

  it('a trial run reports what it would do and keeps nothing', async () => {
    const report = await run(book, true)
    expect(report.errors).toEqual([])
    expect(report.imported).toBe(false)
    expect(report.counts).toMatchObject({ events: 2, competitors: 8, adjudicators: 3, rounds: 2, marks: 36, newAdjudicators: 0, newTeams: 1 })
    expect(report.counts.results).toBe(8 + 3)
    expect((await app.ok<Competition[]>('getCompetitions', [])).some((c) => c.name === 'Old Open 2019')).toBe(false)
  })

  it('saves the competition with its rounds, results and history', async () => {
    const report = await run(book, false)
    expect(report.errors).toEqual([])
    expect(report.warnings).toEqual([])
    expect(report.imported).toBe(true)

    const competition = (await app.ok<Competition[]>('getCompetitions', [])).find((c) => c.name === 'Old Open 2019')!
    expect(competition.date).toBe('2019-03-16')
    const events = await app.ok<Array<{ id: string; number: number }>>('getEvents', [competition.id])
    const first = events.find((e) => e.number === 1)!
    const second = events.find((e) => e.number === 2)!

    const results = await app.ok<Result[]>('getResults', [first.id])
    const final = results.filter((r) => r.stage === 'final').sort((a, b) => a.place - b.place)
    expect(final.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6])
    expect(results.filter((r) => r.stage === 'semi_final').map((r) => r.place).sort()).toEqual([7, 7])
    const rounds = await app.ok<Array<{ type: string; status: string; recallNumber: number | null }>>('getRounds', [first.id])
    expect(rounds).toMatchObject([{ type: 'semi_final', status: 'published', recallNumber: 6 }, { type: 'final', status: 'published', recallNumber: null }])

    // Printed placings with a shared place
    const printed = await app.ok<Result[]>('getResults', [second.id])
    expect(printed.map((r) => [r.place, r.placeFrom, r.placeTo])).toEqual([[1, 1, 1], [2, 2, 3], [2, 2, 3]])

    // The public sheet is there, and the dancers have a history
    const report2 = await app.ok<{ adjudicators: unknown[] }>('getEventReport', [first.id])
    expect(report2.adjudicators).toHaveLength(3)
    const history = await app.ok<CompetitorHistoryLine[]>('getCompetitorHistory', [final[0]!.competitorId])
    expect(history[0]).toMatchObject({ competitionName: 'Old Open 2019', place: 1 })
    expect(history[0]!.points).toBeGreaterThan(0)
  })

  it('refuses the same competition twice', async () => {
    const report = await run(book, true)
    expect(report.errors.map((e) => e.message).join(' ')).toMatch(/already in the system/)
  })
})

describe('what it refuses', () => {
  const fresh = (change: (b: PastWorkbook) => void) => {
    const b = copy(book)
    b.sheets.Competition![0]!.name = 'Another Open'
    change(b)
    return b
  }
  const messages = async (b: PastWorkbook) => (await run(b, true)).errors.map((e) => `${e.sheet} ${e.row}: ${e.message}`).join('\n')

  it('marks before the final without the Rounds sheet', async () => {
    expect(await messages(fresh((b) => delete b.sheets.Rounds))).toMatch(/list who danced each round/)
  })

  it('an adjudicator who marked a different number of X', async () => {
    expect(await messages(fresh((b) => b.sheets.Marks!.splice(0, 1)))).toMatch(/same number of X/)
  })

  it('a final whose placings are not 1 to n', async () => {
    const b = fresh((x) => {
      const m = x.sheets.Marks!.find((r) => r.round === 'final' && r.adjudicator === 'A' && r.back_number === '2')!
      m.mark = '1'
    })
    expect(await messages(b)).toMatch(/must be 1 to 6/)
  })

  it('an unknown age group, back number or sheet row', async () => {
    const text = await messages(fresh((b) => {
      b.sheets.Events![0]!.age_group = 'Nobody'
      b.sheets.Placings![0]!.back_number = '99'
    }))
    expect(text).toMatch(/age group "Nobody"/)
    expect(text).toMatch(/Back number 99 is not in the Competitors sheet/)
  })

  it('needs a card photo', async () => {
    const b = fresh((x) => (x.image = ''))
    expect((await messages(b))).toMatch(/card photo/)
  })

  it('keeps nothing when a refused import is run for real', async () => {
    const b = fresh((x) => delete x.sheets.Rounds)
    const report = await run(b, false)
    expect(report.imported).toBe(false)
    expect((await app.ok<Competition[]>('getCompetitions', [])).some((c) => c.name === 'Another Open')).toBe(false)
  })

  it('keeps the printed placings and warns when the marks place differently', async () => {
    const b = fresh((x) => {
      x.sheets.Competition![0]!.name = 'Disputed Open'
      x.sheets.Placings = [{ event_no: '1', back_number: '1', place: '2' }, { event_no: '1', back_number: '2', place: '1' }]
      delete x.sheets.Events![1]
      x.sheets.Events = x.sheets.Events!.filter(Boolean)
    })
    const report = await run(b, false)
    expect(report.errors).toEqual([])
    expect(report.warnings.map((w) => w.message).join(' ')).toMatch(/not as printed/)
    const competition = (await app.ok<Competition[]>('getCompetitions', [])).find((c) => c.name === 'Disputed Open')!
    const [event] = await app.ok<Array<{ id: string }>>('getEvents', [competition.id])
    const results = await app.ok<Result[]>('getResults', [event!.id])
    expect(results.filter((r) => r.place <= 2).length).toBe(2)
  })
})
