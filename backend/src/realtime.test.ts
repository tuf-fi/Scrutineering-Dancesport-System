import type { AdjudicatorSubmission, MarkSubmission } from '@bis/shared'
import { io, type Socket } from 'socket.io-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import { SAMPLE_PASSWORD, seedSampleData } from './db/seed.ts'

// A real server on a real port with real Socket.IO clients, the way phones and laptops connect

const LIVE = 'comp-sorsogon-2026:e11:round_2'
let app: Awaited<ReturnType<typeof buildApp>>
let sqlite: ReturnType<typeof openDatabase>['sqlite']
let base = ''
const sockets: Socket[] = []

async function signIn(path: string, body: object): Promise<string> {
  const res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  expect(res.status).toBe(200)
  return res.headers.get('set-cookie')!.split(';')[0]!
}

async function call(name: string, args: unknown[], cookie: string) {
  const res = await fetch(`${base}/api/call/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ args }) })
  return { status: res.status, body: (await res.json()) as { data?: any; error?: string } }
}

function connect(cookie?: string): Promise<Socket> {
  const socket = io(base, { extraHeaders: cookie ? { cookie } : {}, transports: ['websocket'], reconnection: false })
  sockets.push(socket)
  return new Promise((resolve, reject) => {
    socket.on('connect', () => resolve(socket))
    socket.on('connect_error', reject)
  })
}

// Collects every message of these kinds a socket receives
function listen(socket: Socket, events: string[]) {
  const got: Array<{ event: string; payload: any }> = []
  for (const event of events) socket.on(event, (payload) => got.push({ event, payload }))
  return got
}

const settle = (ms = 150) => new Promise((r) => setTimeout(r, ms))

beforeAll(async () => {
  const opened = openDatabase(':memory:')
  sqlite = opened.sqlite
  runMigrations(opened.db)
  seedSampleData(opened.db)
  app = await buildApp({ config: loadConfig({ FRONTEND_DIR: '' }), sqlite, db: opened.db, liveBoardMs: 0 })
  await app.listen({ port: 0, host: '127.0.0.1' })
  base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`
})
afterAll(async () => {
  for (const s of sockets) s.disconnect()
  await app.close()
  sqlite.close()
})

describe('live updates', () => {
  it('tells signed-in screens when something changes, but not guests', async () => {
    const staff = await signIn('/api/auth/staff', { username: 'secretariat', password: SAMPLE_PASSWORD })
    const watcher = await connect(staff)
    const guest = await connect()
    const staffGot = listen(watcher, ['changed', 'submissions'])
    const guestGot = listen(guest, ['changed', 'submissions', 'floor'])

    expect((await call('assignBackNumbers', [], staff)).status).toBe(200)
    await settle()
    expect(staffGot.some((m) => m.event === 'changed' && m.payload.scope === 'assignBackNumbers')).toBe(true)
    expect(guestGot).toEqual([])
  })

  it('shows the scrutineer a phone arriving, marking and then submitting', async () => {
    const scrutineer = await signIn('/api/auth/staff', { username: 'scrutineer', password: SAMPLE_PASSWORD })
    const board = await connect(scrutineer)
    const got = listen(board, ['submissions', 'floor'])

    // Before the phone connects it is waiting
    let snapshot = (await call('getSubmissions', [LIVE], scrutineer)).body.data as AdjudicatorSubmission[]
    const d = snapshot[3]!
    expect(d.status).toBe('waiting')

    const phone = await signIn('/api/auth/adjudicator', { pin: String(4100 + 3 * 111) })
    const phoneSocket = await connect(phone)
    // Connecting counts as being heard from; the phone is now marking
    snapshot = (await call('getSubmissions', [LIVE], scrutineer)).body.data
    expect(snapshot[3]).toMatchObject({ status: 'marking', quietSince: null })

    phoneSocket.emit('heartbeat')
    const state = (await call('getAdjudicatorState', [], phone)).body.data
    const ids = state.task.competitors.slice(0, state.task.recallNumber).map((c: { id: string }) => c.id)
    const marks: MarkSubmission[] = state.task.dances.map((dance: string) => ({ dance, competitorIds: ids }))
    expect((await call('submitAdjudicatorMarks', [LIVE, marks], phone)).status).toBe(200)
    await settle()

    const last = got.filter((m) => m.event === 'submissions' && m.payload.roundId === LIVE).at(-1)!
    expect((last.payload.snapshot as AdjudicatorSubmission[])[3]!.status).toBe('submitted')
    expect(got.some((m) => m.event === 'floor')).toBe(true)
  })

  it('flags a phone that has gone quiet', async () => {
    const scrutineer = await signIn('/api/auth/staff', { username: 'scrutineer', password: SAMPLE_PASSWORD })
    const phone = await signIn('/api/auth/adjudicator', { pin: String(4100 + 4 * 111) })
    await call('getAdjudicatorState', [], phone)
    const recent = (await call('getSubmissions', [LIVE], scrutineer)).body.data as AdjudicatorSubmission[]
    expect(recent[4]).toMatchObject({ status: 'marking', quietSince: null })

    // Twenty-five seconds of silence later
    const realNow = Date.now
    Date.now = () => realNow() + 25_000
    try {
      const quiet = (await call('getSubmissions', [LIVE], scrutineer)).body.data as AdjudicatorSubmission[]
      expect(quiet[4]!.status).toBe('marking')
      expect(quiet[4]!.quietSince).toEqual(expect.any(String))
    } finally {
      Date.now = realNow
    }
  })

  it('shows the scrutineer a phone that is holding marks it has not been able to send', async () => {
    const scrutineer = await signIn('/api/auth/staff', { username: 'scrutineer', password: SAMPLE_PASSWORD })
    const phone = await signIn('/api/auth/adjudicator', { pin: String(4100 + 5 * 111) })
    const phoneSocket = await connect(phone)
    const board = async () => ((await call('getSubmissions', [LIVE], scrutineer)).body.data as AdjudicatorSubmission[])[5]!

    phoneSocket.emit('heartbeat', { holding: null })
    await settle()
    expect(await board()).toMatchObject({ status: 'marking', holdingMarks: false })

    // The phone has confirmed marks and cannot send them yet
    phoneSocket.emit('heartbeat', { holding: LIVE })
    await settle()
    expect(await board()).toMatchObject({ status: 'marking', holdingMarks: true })

    // Marks held for some other round do not count for this one
    phoneSocket.emit('heartbeat', { holding: 'another-round' })
    await settle()
    expect((await board()).holdingMarks).toBe(false)

    // A garbage heartbeat does no harm
    phoneSocket.emit('heartbeat', { holding: 42 })
    phoneSocket.emit('heartbeat')
    await settle()
    expect((await board()).holdingMarks).toBe(false)
  })

  it('refuses a socket with a forged cookie the same as a guest', async () => {
    const forged = await connect('bis_session=not.a.token')
    const got = listen(forged, ['changed'])
    const staff = await signIn('/api/auth/staff', { username: 'secretariat', password: SAMPLE_PASSWORD })
    await call('assignBackNumbers', [], staff)
    await settle()
    expect(got).toEqual([])
  })

  it('sends published results and rankings to guests', async () => {
    const scrutineer = await signIn('/api/auth/staff', { username: 'scrutineer', password: SAMPLE_PASSWORD })
    const admin = await signIn('/api/auth/staff', { username: 'admin', password: SAMPLE_PASSWORD })
    const guest = await connect()
    const got = listen(guest, ['published', 'rankings', 'changed'])
    const table = (await call('getPointsTable', [], admin)).body.data as Array<{ points: number }>
    expect((await call('savePointsTable', [table], admin)).status).toBe(200)
    await settle()
    expect(got.map((m) => m.event)).toEqual(['rankings'])
    void scrutineer
  })
})

describe('serving the app', () => {
  it('answers health over the network', async () => {
    const res = await fetch(`${base}/api/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', mode: 'venue' })
  })
})
