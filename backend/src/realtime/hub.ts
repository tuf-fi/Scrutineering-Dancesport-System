import type { AdjudicatorSubmission } from '@bis/shared'

// How long without a heartbeat before a phone counts as quiet
export const QUIET_MS = 20_000

// What services use to tell the other screens something happened. The Socket.IO version is in socket.ts.
export interface Hub {
  // Something changed: signed-in screens refetch what they show
  changed(scope?: string): void
  // The live board of a round, pushed to signed-in screens
  submissions(roundId: string, snapshot: AdjudicatorSubmission[]): void
  // The round on the floor changed; phones refetch what to mark
  floor(roundId: string | null): void
  // A round's results went public: the only thing the guest network receives, besides rankings
  published(info: { competitionId: string; eventId: string; roundId: string }): void
  rankings(): void
  // A phone says it is alive
  seen(adjudicatorId: string): void
  // When a phone was last heard from, as milliseconds since 1970
  lastSeen(adjudicatorId: string): number | null
  close(): Promise<void>
}

// Remembers when each phone was last heard from
export class Presence {
  private readonly seenAt = new Map<string, number>()

  seen(adjudicatorId: string, at = Date.now()) {
    this.seenAt.set(adjudicatorId, at)
  }

  lastSeen(adjudicatorId: string): number | null {
    return this.seenAt.get(adjudicatorId) ?? null
  }
}

// Used in tests and anywhere no screens are connected; it records what would have been sent
export function silentHub(presence = new Presence()): Hub & { sent: Array<{ event: string; payload: unknown }> } {
  const sent: Array<{ event: string; payload: unknown }> = []
  return {
    sent,
    changed: (scope) => void sent.push({ event: 'changed', payload: scope ?? null }),
    submissions: (roundId, snapshot) => void sent.push({ event: 'submissions', payload: { roundId, snapshot } }),
    floor: (roundId) => void sent.push({ event: 'floor', payload: roundId }),
    published: (info) => void sent.push({ event: 'published', payload: info }),
    rankings: () => void sent.push({ event: 'rankings', payload: null }),
    seen: (id) => presence.seen(id),
    lastSeen: (id) => presence.lastSeen(id),
    close: async () => {},
  }
}
