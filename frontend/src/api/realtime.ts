import type { AdjudicatorSubmission } from '@bis/shared'
import { io, type Socket } from 'socket.io-client'
import { call } from './http.ts'

// The venue socket: pushes changes to every screen, and carries each phone's heartbeat to the scrutineer's board.

const HEARTBEAT_MS = 5000

export interface RealtimeOptions {
  // Adjudicators' phones tell the server they are alive
  heartbeat: boolean
  // The round this phone holds unsent marks for, told with every heartbeat so the scrutineer can see it
  holding?: () => string | null
  // The socket (re)connected: fetch everything again, anything could have changed
  onConnect: () => void
  onDisconnect: () => void
  // Something changed on the server
  onChange: () => void
}

const listeners = new Map<string, Set<(snapshot: AdjudicatorSubmission[]) => void>>()
const latest = new Map<string, AdjudicatorSubmission[]>()

function deliver(roundId: string, snapshot: AdjudicatorSubmission[]) {
  latest.set(roundId, snapshot)
  listeners.get(roundId)?.forEach((listener) => listener(snapshot))
}

// Opens the socket with whatever session cookie the browser holds; returns a function that closes it
export function connectRealtime(options: RealtimeOptions): () => void {
  const socket: Socket = io({ transports: ['websocket', 'polling'], reconnectionDelayMax: 3000 })
  let beat: ReturnType<typeof setInterval> | undefined

  socket.on('connect', () => {
    options.onConnect()
    if (options.heartbeat) {
      const beatOnce = () => socket.emit('heartbeat', { holding: options.holding?.() ?? null })
      beatOnce()
      beat = setInterval(beatOnce, HEARTBEAT_MS)
    }
  })
  socket.on('disconnect', () => {
    if (beat) clearInterval(beat)
    beat = undefined
    options.onDisconnect()
  })
  for (const event of ['changed', 'floor', 'published', 'rankings']) socket.on(event, options.onChange)
  socket.on('submissions', (message: { roundId: string; snapshot: AdjudicatorSubmission[] }) =>
    deliver(message.roundId, message.snapshot),
  )

  return () => {
    if (beat) clearInterval(beat)
    socket.removeAllListeners()
    socket.disconnect()
  }
}

// What the live board last showed for a round, so it does not flash empty while the first reply loads
export const getSubmissionSnapshot = (roundId: string): AdjudicatorSubmission[] => latest.get(roundId) ?? []

// Calls back with the board now, then again whenever it changes
export function subscribeSubmissions(roundId: string, listener: (snapshot: AdjudicatorSubmission[]) => void): () => void {
  const set = listeners.get(roundId) ?? new Set()
  set.add(listener)
  listeners.set(roundId, set)
  let active = true
  call<AdjudicatorSubmission[]>('getSubmissions', roundId)
    .then((snapshot) => {
      if (active) deliver(roundId, snapshot)
    })
    .catch(() => {})
  return () => {
    active = false
    set.delete(listener)
  }
}
