import type { AdjudicatorSubmission } from '@bis/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// A stand-in for the socket: records what is emitted and lets a test fire server events
class FakeSocket {
  handlers = new Map<string, Array<(payload?: unknown) => void>>()
  emitted: string[] = []
  disconnected = false
  on(event: string, handler: (payload?: unknown) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
    return this
  }
  payloads: unknown[] = []
  emit(event: string, payload?: unknown) {
    this.emitted.push(event)
    this.payloads.push(payload)
  }
  removeAllListeners() {
    this.handlers.clear()
  }
  disconnect() {
    this.disconnected = true
  }
  fire(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach((h) => h(payload))
  }
}

let socket: FakeSocket
vi.mock('socket.io-client', () => ({ io: () => socket }))

const { connectRealtime, getSubmissionSnapshot, subscribeSubmissions } = await import('./realtime.ts')

const snapshot = (status: AdjudicatorSubmission['status']): AdjudicatorSubmission[] => [
  { roundId: 'r1', adjudicatorId: 'adj-a', status, submittedAt: null },
]

function options(heartbeat = false) {
  return { heartbeat, onConnect: vi.fn(), onDisconnect: vi.fn(), onChange: vi.fn() }
}

beforeEach(() => {
  socket = new FakeSocket()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('the venue socket', () => {
  it('tells the app when it connects and disconnects', () => {
    const o = options()
    connectRealtime(o)
    socket.fire('connect')
    expect(o.onConnect).toHaveBeenCalledTimes(1)
    socket.fire('disconnect')
    expect(o.onDisconnect).toHaveBeenCalledTimes(1)
  })

  it('reports a change for each kind of server announcement', () => {
    const o = options()
    connectRealtime(o)
    for (const event of ['changed', 'floor', 'published', 'rankings']) socket.fire(event)
    expect(o.onChange).toHaveBeenCalledTimes(4)
  })

  it("sends an adjudicator's heartbeat every five seconds while connected", () => {
    connectRealtime(options(true))
    socket.fire('connect')
    expect(socket.emitted).toEqual(['heartbeat'])
    vi.advanceTimersByTime(10_000)
    expect(socket.emitted).toEqual(['heartbeat', 'heartbeat', 'heartbeat'])
    socket.fire('disconnect')
    vi.advanceTimersByTime(20_000)
    expect(socket.emitted).toHaveLength(3)
  })

  it('says which round the phone is holding unsent marks for', () => {
    let holding: string | null = null
    connectRealtime({ ...options(true), holding: () => holding })
    socket.fire('connect')
    expect(socket.payloads.at(-1)).toEqual({ holding: null })
    holding = 'round-2'
    vi.advanceTimersByTime(5000)
    expect(socket.payloads.at(-1)).toEqual({ holding: 'round-2' })
    holding = null
    vi.advanceTimersByTime(5000)
    expect(socket.payloads.at(-1)).toEqual({ holding: null })
  })

  it('sends no heartbeat from anyone but an adjudicator', () => {
    connectRealtime(options(false))
    socket.fire('connect')
    vi.advanceTimersByTime(20_000)
    expect(socket.emitted).toEqual([])
  })

  it('closes cleanly', () => {
    const stop = connectRealtime(options(true))
    socket.fire('connect')
    stop()
    expect(socket.disconnected).toBe(true)
    vi.advanceTimersByTime(20_000)
    expect(socket.emitted).toEqual(['heartbeat'])
  })
})

describe('the live board', () => {
  it('shows the board now, then each push, and stops when unsubscribed', async () => {
    vi.useRealTimers()
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ data: snapshot('waiting') }), { status: 200 }))))
    connectRealtime(options())
    const seen: string[] = []
    const stop = subscribeSubmissions('r1', (s) => seen.push(s[0]!.status))
    await vi.waitFor(() => expect(seen).toEqual(['waiting']))
    expect(getSubmissionSnapshot('r1')[0]!.status).toBe('waiting')

    socket.fire('submissions', { roundId: 'r1', snapshot: snapshot('submitted') })
    socket.fire('submissions', { roundId: 'other', snapshot: snapshot('marking') })
    expect(seen).toEqual(['waiting', 'submitted'])

    stop()
    socket.fire('submissions', { roundId: 'r1', snapshot: snapshot('marking') })
    expect(seen).toEqual(['waiting', 'submitted'])
  })

  it('shows an empty board until something is known about a round', () => {
    expect(getSubmissionSnapshot('never-seen')).toEqual([])
  })

  it('does not fail the screen when the first fetch cannot reach the server', async () => {
    vi.useRealTimers()
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))))
    const seen: unknown[] = []
    const stop = subscribeSubmissions('r2', (s) => seen.push(s))
    await new Promise((r) => setTimeout(r, 20))
    expect(seen).toEqual([])
    stop()
  })
})
