import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import type { AdjudicatorSubmission, MarkingTask, MarkSubmission } from '@bis/shared'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import * as client from '../../frontend/src/api/client.ts'
import { closePhoneDb, loadPending } from '../../frontend/src/lib/phoneDb.ts'
import { sendPending } from '../../frontend/src/lib/sendPending.ts'
import { useOutbox } from '../../frontend/src/stores/outbox.ts'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { seedSampleData } from './db/seed.ts'

// A bad day at the venue, end to end: a phone holds marks while the Wi-Fi is off, its browser is killed, the server
// is restarted, and the marks still arrive exactly once. The server and the phone code are the real ones.

const LIVE = 'comp-sorsogon-2026:e11:round_2'
const realFetch = globalThis.fetch

let dir = ''
let dbPath = ''
let port = 0
let server: Awaited<ReturnType<typeof buildApp>> | null = null
let sqlite: ReturnType<typeof openDatabase>['sqlite'] | null = null

// Everything the phone's browser keeps: cookies, and a switch for "the response never came back"
const jar = new Map<string, string>()
let loseResponses = false

async function startServer(seed: boolean) {
  const opened = openDatabase(dbPath)
  runMigrations(opened.db)
  if (seed) seedSampleData(opened.db)
  sqlite = opened.sqlite
  server = await buildApp({ config: loadConfig({ FRONTEND_DIR: '' }), sqlite: opened.sqlite, db: opened.db, liveBoardMs: 0 })
  await server.listen({ port, host: '127.0.0.1' })
  port = (server.server.address() as { port: number }).port
}

// The Wi-Fi going off, or the laptop's server being stopped
async function stopServer() {
  await server?.close()
  sqlite?.close()
  server = null
  sqlite = null
}

// What the phone does while the app is open: tries to send whatever it is holding
async function phoneTick() {
  const pending = useOutbox.getState().pending
  if (!pending) return null
  const outcome = await sendPending(pending, (roundId, submissions) => client.submitAdjudicatorMarks(pending.adjudicatorId, roundId, submissions))
  if (outcome.result !== 'kept') await useOutbox.getState().clear()
  return outcome
}

// The browser being killed: everything in memory goes, what is in storage stays
async function killBrowser() {
  closePhoneDb()
  useOutbox.setState({ pending: null })
  await useOutbox.getState().restore()
}

const marksInDb = () => (sqlite!.prepare("select count(*) as n from marks where round_id = ? and adjudicator_id = 'adj-d'").get(LIVE) as { n: number }).n
const submissionsInDb = () => (sqlite!.prepare("select count(*) as n from submissions where round_id = ? and adjudicator_id = 'adj-d'").get(LIVE) as { n: number }).n

async function marksToSend(): Promise<MarkSubmission[]> {
  const state = await client.getAdjudicatorState('x')
  if (state.status !== 'marking') throw new Error(`expected marking, got ${state.status}`)
  const task: MarkingTask = state.task
  const ids = task.competitors.slice(0, task.recallNumber ?? 0).map((c) => c.id)
  return task.dances.map((dance) => ({ dance, competitorIds: ids }))
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'bis-offline-'))
  dbPath = join(dir, 'bis.db')
  await startServer(true)
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const cookie = jar.get('phone')
    if (cookie) headers.set('cookie', cookie)
    const res = await realFetch(`http://127.0.0.1:${port}${url}`, { ...init, headers })
    const set = res.headers.get('set-cookie')
    if (set) jar.set('phone', set.split(';')[0]!)
    // The server did the work, but the reply never reached the phone
    if (loseResponses) throw new TypeError('network connection lost')
    return res
  })
  await client.signInAdjudicator('4433')
})
afterEach(() => {
  loseResponses = false
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await stopServer()
  rmSync(dir, { recursive: true, force: true })
})

describe('an adjudicator on a bad day', () => {
  it('has marks held on the phone while the Wi-Fi is off, even after the browser is killed', async () => {
    globalThis.indexedDB = new IDBFactory()
    closePhoneDb()
    useOutbox.setState({ pending: null })

    const marks = await marksToSend()
    // Confirmed: saved on the phone first
    await useOutbox.getState().save({ adjudicatorId: 'adj-d', roundId: LIVE, submissions: marks })
    expect(await loadPending()).not.toBeNull()

    // The Wi-Fi goes off (the server cannot be reached): nothing is lost, nothing is sent
    await stopServer()
    expect(await phoneTick()).toEqual({ result: 'kept', reason: 'network' })
    expect(await phoneTick()).toEqual({ result: 'kept', reason: 'network' })

    // The phone's browser is killed while the marks are still unsent
    await killBrowser()
    expect(useOutbox.getState().pending).toMatchObject({ adjudicatorId: 'adj-d', roundId: LIVE })

    // The server comes back, restarted on the same database
    await startServer(false)
    expect(submissionsInDb()).toBe(0)
    expect(await phoneTick()).toEqual({ result: 'sent' })

    // The marks are on the server exactly once, and the phone has let go of them
    expect(marksInDb()).toBe(12)
    expect(submissionsInDb()).toBe(1)
    expect(useOutbox.getState().pending).toBeNull()
    expect(await loadPending()).toBeNull()
    // The phone stays signed in across the server restart
    expect((await client.getAdjudicatorState('x')).status).toBe('submitted')
  })

  it('does not count marks twice when the server stored them but the reply was lost', async () => {
    // Another adjudicator on the same panel, on the same phone
    jar.clear()
    await client.signInAdjudicator('4544')
    const state = await client.getAdjudicatorState('x')
    if (state.status !== 'marking') throw new Error('expected marking')
    const ids = state.task.competitors.slice(0, 12).map((c) => c.id)
    const marks = state.task.dances.map((dance) => ({ dance, competitorIds: ids }))
    await useOutbox.getState().save({ adjudicatorId: 'adj-e', roundId: LIVE, submissions: marks })

    // The server receives and stores the marks, but the answer never comes back
    loseResponses = true
    expect(await phoneTick()).toEqual({ result: 'kept', reason: 'network' })
    loseResponses = false
    const count = () => (sqlite!.prepare("select count(*) as n from marks where round_id = ? and adjudicator_id = 'adj-e'").get(LIVE) as { n: number }).n
    expect(count()).toBe(12)
    expect(useOutbox.getState().pending).not.toBeNull()

    // The phone tries again, as it will until it hears back: accepted, and still 12 marks, not 24
    expect(await phoneTick()).toEqual({ result: 'sent' })
    expect(count()).toBe(12)
    expect(useOutbox.getState().pending).toBeNull()
  })

  it('shows the scrutineer both phones in once the marks arrive', async () => {
    jar.clear()
    const response = await realFetch(`http://127.0.0.1:${port}/api/auth/staff`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'scrutineer', password: 'bis2026' }),
    })
    jar.set('phone', response.headers.get('set-cookie')!.split(';')[0]!)
    const board: AdjudicatorSubmission[] = await client.getSubmissions(LIVE)
    expect(board.filter((b) => b.status === 'submitted').map((b) => b.adjudicatorId).sort()).toEqual(['adj-a', 'adj-b', 'adj-c', 'adj-d', 'adj-e'])
  })

  it('drops marks the server refuses for good, and keeps them when it has trouble', async () => {
    // The round has since moved on: marks for a round that is not open are refused for good
    sqlite!.prepare("update rounds set status = 'approved' where id = ?").run(LIVE)
    useOutbox.setState({ pending: null })
    await useOutbox.getState().save({ adjudicatorId: 'adj-d', roundId: LIVE, submissions: [{ dance: 'cha_cha_cha', competitorIds: ['c1'] }] })
    jar.clear()
    await client.signInAdjudicator('4433')
    const refused = await phoneTick()
    expect(refused).toMatchObject({ result: 'dropped' })
    expect(useOutbox.getState().pending).toBeNull()
    expect(await loadPending()).toBeNull()

    // A signed-out phone is told to sign in again: the marks are not thrown away
    await useOutbox.getState().save({ adjudicatorId: 'adj-d', roundId: LIVE, submissions: [{ dance: 'cha_cha_cha', competitorIds: ['c1'] }] })
    jar.clear()
    expect(await phoneTick()).toEqual({ result: 'kept', reason: 'server' })
    expect(await loadPending()).not.toBeNull()
  })
})
