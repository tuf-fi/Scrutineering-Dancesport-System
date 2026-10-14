// Ten phones marking at the same moment, while a crowd reads the public pages. The real server in its own process on a
// spare database, so nothing real is touched. Run it with `pnpm loadtest` (about a minute) and before any event.
// It fails if any request fails, a mark goes missing or is stored twice, or the slowest typical request is too slow.
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const BACKEND = resolve(import.meta.dirname, '..', 'backend')
const PORT = Number(process.env.LOADTEST_PORT ?? 4060)
const BASE = `http://localhost:${PORT}`
const PHONES = 10
const READERS = Number(process.env.LOADTEST_READERS ?? 100)
const MARKING_ROUNDS = 5
const LIMIT_P95_MS = Number(process.env.LOADTEST_P95_MS ?? 1000)

const work = mkdtempSync(join(tmpdir(), 'bis-load-'))
const db = join(work, 'bis.db')
const env = { ...process.env, DATABASE_PATH: db, PORT: String(PORT), HOST: '127.0.0.1', BACKUP_DIRS: join(work, 'backups'), BACKUP_INTERVAL_MINUTES: '5', NODE_NO_WARNINGS: '1' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const latencies = { phoneState: [], phoneSubmit: [], reader: [] }
const failures = []

async function timed(bucket, label, fn) {
  const start = performance.now()
  try {
    const out = await fn()
    latencies[bucket].push(performance.now() - start)
    return out
  } catch (error) {
    failures.push(`${label}: ${error.message}`)
    return null
  }
}

async function call(cookie, name, args = []) {
  const res = await fetch(`${BASE}/api/call/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ args }) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${name} ${res.status}: ${body.error ?? ''}`)
  return body.data
}
async function signIn(path, payload) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  if (!res.ok) throw new Error(`sign-in ${res.status}`)
  return res.headers.get('set-cookie').split(';')[0]
}
const percentile = (list, p) => {
  if (list.length === 0) return NaN
  const sorted = [...list].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]
}
const row = (name, list) => `${name.padEnd(22)} n=${String(list.length).padStart(5)}  p50=${percentile(list, 50).toFixed(0).padStart(5)} ms  p95=${percentile(list, 95).toFixed(0).padStart(5)} ms  max=${Math.max(...list).toFixed(0).padStart(5)} ms`

let server
try {
  console.log('Seeding a spare database…')
  spawnSync(process.execPath, ['--import', 'tsx', 'src/db/seed-cli.ts'], { cwd: BACKEND, env, stdio: 'inherit' })
  // Everyone paid, so the "only paid entries dance" guard does not stop the test
  const Database = createRequire(join(BACKEND, 'package.json'))('better-sqlite3')
  const setup = new Database(db)
  setup.prepare("UPDATE payments SET status = 'paid_at_venue' WHERE status IN ('unpaid', 'for_checking', 'rejected')").run()
  // The sample has a round already on the floor with marks in; start from a clean floor
  setup.exec("DELETE FROM marks WHERE round_id IN (SELECT id FROM rounds WHERE status = 'marking'); DELETE FROM submissions WHERE round_id IN (SELECT id FROM rounds WHERE status = 'marking'); UPDATE rounds SET status = 'pending' WHERE status = 'marking'; UPDATE competitions SET floor_round_id = NULL")
  const before = setup.prepare('SELECT count(*) AS n FROM submissions').get().n
  setup.close()
  server = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], { cwd: BACKEND, env, stdio: 'ignore' })
  for (let i = 0; i < 120; i++) {
    if ((await fetch(`${BASE}/api/health`).catch(() => null))?.ok) break
    await sleep(250)
  }

  const admin = await signIn('/api/auth/staff', { username: 'admin', password: 'bis2026' })
  const scrutineer = await signIn('/api/auth/staff', { username: 'scrutineer', password: 'bis2026' })
  const competitionId = 'comp-sorsogon-2026'

  // A panel of ten, the most the lettering allows
  const adjudicators = await call(admin, 'getAdjudicators')
  const have = new Set(adjudicators.map((a) => a.letter))
  for (const letter of 'ABCDEFGHIJ') if (!have.has(letter)) await call(admin, 'createAdjudicator', [{ name: `Load adjudicator ${letter}`, letter }])
  const panel = (await call(admin, 'getAdjudicators')).filter((a) => 'ABCDEFGHIJ'.includes(a.letter)).sort((a, b) => a.letter.localeCompare(b.letter)).slice(0, PHONES)
  await call(admin, 'generatePins', [competitionId])
  const pins = await call(admin, 'getAdjudicatorPins', [competitionId])

  await call(scrutineer, 'planRounds', [competitionId])
  const rounds = await call(scrutineer, 'getCompetitionRounds', [competitionId])
  // The first round of each event that has not started, in the order the events run
  const seen = new Set()
  const first = rounds.filter((r) => r.status === 'pending' && !seen.has(r.eventId) && seen.add(r.eventId))
  if (first.length < MARKING_ROUNDS) throw new Error(`Only ${first.length} events are waiting to start.`)

  const phones = []
  for (const adjudicator of panel) {
    const pin = pins.find((p) => p.adjudicatorId === adjudicator.id)?.pin
    phones.push({ letter: adjudicator.letter, cookie: await signIn('/api/auth/adjudicator', { pin }), id: adjudicator.id })
  }
  console.log(`${phones.length} phones signed in. Marking ${MARKING_ROUNDS} rounds, with ${READERS} readers on the public pages…`)

  // The crowd: public pages, read all the way through
  let crowd = true
  const readers = Array.from({ length: READERS }, async (_, i) => {
    while (crowd) {
      const name = ['getCompetitions', 'getRankingPoints', 'getEvents'][i % 3]
      await timed('reader', name, () => call(null, name, name === 'getRankingPoints' ? [{}] : name === 'getEvents' ? [competitionId] : []))
      await sleep(200 + Math.random() * 400)
    }
  })

  let marked = 0
  for (const round of first.slice(0, MARKING_ROUNDS)) {
    // Every panel member of this event is the ten, so the whole round arrives together
    await call(admin, 'setPanel', [round.eventId, panel.map((a) => a.id)])
    try {
      await call(scrutineer, 'startRound', [round.roundId])
    } catch (error) {
      failures.push(`startRound: ${error.message}`)
      continue
    }
    // All phones ask what to mark at once, then all send at once
    const states = await Promise.all(phones.map((p) => timed('phoneState', 'getAdjudicatorState', () => call(p.cookie, 'getAdjudicatorState'))))
    await Promise.all(
      phones.map((p, i) => {
        const state = states[i]
        if (!state || state.status !== 'marking') {
          failures.push(`phone ${p.letter} was not asked to mark`)
          return null
        }
        const ordered = [...state.task.competitors].sort((a, b) => (a.backNumber ?? 0) - (b.backNumber ?? 0)).map((c) => c.id)
        const chosen = state.task.recallNumber === null ? ordered : ordered.slice(0, state.task.recallNumber)
        const marks = state.task.dances.map((dance) => ({ dance, competitorIds: chosen }))
        return timed('phoneSubmit', 'submitAdjudicatorMarks', () => call(p.cookie, 'submitAdjudicatorMarks', [round.roundId, marks]))
      }),
    )
    // The same marks sent again, as a flaky phone would, must not be stored twice
    await Promise.all(
      phones.map((p, i) => {
        const state = states[i]
        if (!state?.task) return null
        const ordered = [...state.task.competitors].sort((a, b) => (a.backNumber ?? 0) - (b.backNumber ?? 0)).map((c) => c.id)
        const chosen = state.task.recallNumber === null ? ordered : ordered.slice(0, state.task.recallNumber)
        return timed('phoneSubmit', 'resend', () => call(p.cookie, 'submitAdjudicatorMarks', [round.roundId, state.task.dances.map((dance) => ({ dance, competitorIds: chosen }))]))
      }),
    )
    marked++
    await call(scrutineer, 'approveRound', [round.roundId]).catch((e) => failures.push(`approveRound: ${e.message}`))
    await call(scrutineer, 'publishRound', [round.roundId]).catch((e) => failures.push(`publishRound: ${e.message}`))
  }
  crowd = false
  await Promise.all(readers)

  // Nothing missing, nothing doubled
  const check = new Database(db, { readonly: true })
  const doubled = check.prepare('SELECT count(*) AS n FROM (SELECT round_id, adjudicator_id, dance, competitor_id, count(*) AS c FROM marks GROUP BY 1,2,3,4 HAVING c > 1)').get().n
  const submissions = check.prepare('SELECT count(*) AS n FROM submissions').get().n
  const integrity = check.pragma('integrity_check', { simple: true })
  check.close()
  if (doubled > 0) failures.push(`${doubled} marks were stored twice`)
  if (submissions - before !== marked * phones.length) failures.push(`expected ${marked * phones.length} new submissions, found ${submissions - before}`)
  if (integrity !== 'ok') failures.push(`database integrity: ${integrity}`)

  console.log('')
  console.log(row('phone asks what to mark', latencies.phoneState))
  console.log(row('phone sends marks', latencies.phoneSubmit))
  console.log(row('public page read', latencies.reader))
  const slow = Math.max(percentile(latencies.phoneState, 95), percentile(latencies.phoneSubmit, 95), percentile(latencies.reader, 95))
  if (!(slow <= LIMIT_P95_MS)) failures.push(`the 95th percentile was ${slow.toFixed(0)} ms, over the ${LIMIT_P95_MS} ms limit`)
  console.log(`\n${phones.length} phones x ${marked} rounds, ${submissions - before} submissions, ${latencies.reader.length} public reads.`)
} catch (error) {
  failures.push(String(error.stack ?? error))
} finally {
  server?.kill('SIGKILL')
  await sleep(500)
  rmSync(work, { recursive: true, force: true, maxRetries: 3 })
}

if (failures.length > 0) {
  console.log('\nFAILED')
  for (const f of [...new Set(failures)].slice(0, 15)) console.log(`  ${f}`)
  process.exit(1)
}
console.log('\nPASSED')
