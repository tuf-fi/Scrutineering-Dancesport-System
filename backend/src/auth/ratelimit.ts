// Counts requests per visitor in a fixed window, so one address cannot use up the server for everyone. It is in memory,
// which is right for one server process; it starts again from zero when the server restarts.
export class RequestLimiter {
  private readonly windows = new Map<string, { count: number; start: number }>()
  private readonly max: number
  private readonly windowMs: number
  private lastSweep = Date.now()

  constructor(max: number, windowMs = 60_000) {
    this.max = max
    this.windowMs = windowMs
  }

  // True when the request may go ahead
  take(key: string, now = Date.now()): boolean {
    this.sweep(now)
    const entry = this.windows.get(key)
    if (!entry || now - entry.start >= this.windowMs) {
      this.windows.set(key, { count: 1, start: now })
      return true
    }
    entry.count++
    return entry.count <= this.max
  }

  // Forgets visitors whose window is over, so the map cannot grow without end
  private sweep(now: number) {
    if (now - this.lastSweep < this.windowMs) return
    this.lastSweep = now
    for (const [key, entry] of this.windows) if (now - entry.start >= this.windowMs) this.windows.delete(key)
  }
}
