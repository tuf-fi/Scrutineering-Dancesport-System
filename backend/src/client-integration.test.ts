import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import * as client from '../../frontend/src/api/client.ts'
import { ApiError, isNetworkError, onSessionEnded } from '../../frontend/src/api/http.ts'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { SAMPLE_PASSWORD, seedSampleData } from './db/seed.ts'

// The frontend's real client talking to the real server over HTTP, with cookies kept the way a browser keeps them

let app: Awaited<ReturnType<typeof buildApp>>
let sqlite: ReturnType<typeof openDatabase>['sqlite']
let base = ''
const realFetch = globalThis.fetch

// One cookie jar per "device"; a test picks which device is making the next request
const jars = new Map<string, string>()
let device = 'guest'
const useDevice = (name: string) => void (device = name)

beforeAll(async () => {
  const opened = openDatabase(':memory:')
  sqlite = opened.sqlite
  runMigrations(opened.db)
  seedSampleData(opened.db)
  app = await buildApp({ config: loadConfig({ FRONTEND_DIR: '' }), sqlite, db: opened.db, liveBoardMs: 0 })
  await app.listen({ port: 0, host: '127.0.0.1' })
  base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`

  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const cookie = jars.get(device)
    if (cookie) headers.set('cookie', cookie)
    const res = await realFetch(`${base}${url}`, { ...init, headers })
    const set = res.headers.get('set-cookie')
    if (set) {
      const pair = set.split(';')[0]!
      // An emptied cookie means sign-out
      if (pair.endsWith('=')) jars.delete(device)
      else jars.set(device, pair)
    }
    return res
  })
})
afterEach(() => onSessionEnded(() => {}))
afterAll(async () => {
  vi.unstubAllGlobals()
  await app.close().catch(() => {})
  sqlite.close()
})

describe('signing in through the client', () => {
  it('signs in, is remembered by the cookie, and signs out', async () => {
    useDevice('admin')
    const session = await client.signInStaff('admin', SAMPLE_PASSWORD)
    expect(session).toMatchObject({ role: 'admin', name: 'Amelia Rosales' })
    expect(await client.getSession()).toMatchObject({ id: session.id })
    expect((await client.getStaffUsers()).length).toBe(5)
    await client.signOut()
    expect(await client.getSession()).toBeNull()
    await expect(client.getStaffUsers()).rejects.toMatchObject({ status: 401 })
  })

  it('explains a wrong password in the server\'s words, without ending a session', async () => {
    const ended = vi.fn()
    onSessionEnded(ended)
    useDevice('nobody')
    await expect(client.signInStaff('admin', 'wrong')).rejects.toMatchObject({ status: 401, message: 'Wrong username or password.' })
    expect(ended).not.toHaveBeenCalled()
  })

  it('tells the app the session ended when the server stops recognising it', async () => {
    const ended = vi.fn()
    useDevice('expiring')
    await client.signInStaff('mc', SAMPLE_PASSWORD)
    onSessionEnded(ended)
    jars.set('expiring', 'bis_session=not-a-real-token')
    await expect(client.getAnnouncements()).rejects.toBeInstanceOf(ApiError)
    expect(ended).toHaveBeenCalledTimes(1)
  })
})

describe('every role, using the functions the screens call', () => {
  it('lets a guest read published data only', async () => {
    useDevice('guest')
    expect((await client.getCompetitions()).length).toBe(3)
    expect((await client.getClubs()).every((c) => c.contactEmail === '')).toBe(true)
    await expect(client.getPaymentDetails()).rejects.toMatchObject({ status: 401 })
  })

  it('runs the secretariat\'s screens', async () => {
    useDevice('secretariat')
    await client.signInStaff('secretariat', SAMPLE_PASSWORD)
    const result = await client.importCompetitorsCsv('ignored-actor-id', '"Cruz, Mia",,Unknown Club')
    expect(result.skipped).toEqual([{ line: 2, reason: 'Unknown club "Unknown Club".' }])
    const rows = await client.getCompetitorRows()
    const [first, second] = rows
    // The server's own message comes through to the screen
    await expect(client.setBackNumber('ignored-actor-id', second!.id, first!.backNumber)).rejects.toThrow(/already taken/)
    const schedule = await client.getSchedule('comp-sorsogon-2026')
    expect(schedule.length).toBeGreaterThan(50)
  })

  it('runs an adjudicator\'s phone', async () => {
    useDevice('phone-d')
    await client.signInAdjudicator('4433')
    const state = await client.getAdjudicatorState('ignored-own-id')
    if (state.status !== 'marking') throw new Error(`expected marking, got ${state.status}`)
    const { task } = state
    const ids = task.competitors.slice(0, task.recallNumber ?? 0).map((c) => c.id)
    await client.submitAdjudicatorMarks('ignored-own-id', task.round.id, task.dances.map((dance) => ({ dance, competitorIds: ids })))
    expect((await client.getAdjudicatorState('x')).status).toBe('submitted')
    // Sending the same marks again, as a phone does after a Wi-Fi drop, is accepted
    await client.submitAdjudicatorMarks('x', task.round.id, task.dances.map((dance) => ({ dance, competitorIds: ids })))
  })

  it('shows the scrutineer the phone that just submitted', async () => {
    useDevice('scrutineer')
    await client.signInStaff('scrutineer', SAMPLE_PASSWORD)
    const round = await client.getCurrentRoundId()
    expect(round).toBe('comp-sorsogon-2026:e11:round_2')
    const board = await client.getSubmissions(round)
    expect(board.filter((b) => b.status === 'submitted')).toHaveLength(4)
    const table = await client.getRecallTable(round)
    expect(table).toMatchObject({ recallNumber: 12, submittedCount: 4, adjudicatorCount: 7 })
    expect((await client.getBackupStatus()).targets).toEqual([])
  })

  it('refuses the chairperson what only the scrutineer may do, with a message', async () => {
    useDevice('chair')
    await client.signInStaff('chairperson', SAMPLE_PASSWORD)
    await expect(client.approveRound('x', 'comp-sorsogon-2026:e11:round_2')).rejects.toMatchObject({ status: 403 })
  })

  it('runs a club\'s portal', async () => {
    // Only staff are given clubs' contact details, so the admin looks one up
    useDevice('admin')
    await client.signInStaff('admin', SAMPLE_PASSWORD)
    const [club] = await client.getClubs()
    useDevice('club')
    await client.signInClub(club!.contactEmail, SAMPLE_PASSWORD)
    const dancers = await client.getClubDancers('ignored-club-id')
    expect(dancers.length).toBeGreaterThan(0)
    expect(await client.getPaymentMethods()).toHaveLength(3)
    await expect(client.saveClubDancer('x', { names: ['  '], ageGroup: 'adult' })).rejects.toMatchObject({ status: 400 })
  })
})

describe('when the server cannot be reached', () => {
  it('reports it as a network error', async () => {
    await app.close()
    useDevice('guest')
    const error = await client.getCompetitions().catch((e: unknown) => e)
    expect(isNetworkError(error)).toBe(true)
  })
})
