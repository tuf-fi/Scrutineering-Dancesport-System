import { usingMocks } from '../api/mode.ts'

// The real server pushes changes over the socket, so screens only re-check now and then as a safety net.
// The sample app has no server to push, so it asks every few seconds.
const SAFETY_NET_MS = 30_000

export const usePoll = (sampleMs: number): number => (usingMocks ? sampleMs : SAFETY_NET_MS)
