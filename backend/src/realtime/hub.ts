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
  // A phone says it is alive, and which round it is holding unsent marks for, if any
  seen(adjudicatorId: string, holding?: string | null): void
  // The round a phone last said it holds unsent marks for
  holding(adjudicatorId: string): string | null
  // When a phone was last heard from, as milliseconds since 1970
  lastSeen(adjudicatorId: string): number | null
  close(): Promise<void>
}

// Remembers when each phone was last heard from
export class Presence {
  private readonly seenAt = new Map<string, { at: number; holding: string | null }>()

  seen(adjudicatorId: string, holding: string | null = null, at = Date.now()) {
    this.seenAt.set(adjudicatorId, { at, holding })
  }

  lastSeen(adjudicatorId: string): number | null {
    return this.seenAt.get(adjudicatorId)?.at ?? null
  }

  holding(adjudicatorId: string): string | null {
    return this.seenAt.get(adjudicatorId)?.holding ?? null
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
    seen: (id, holding) => presence.seen(id, holding ?? null),
    lastSeen: (id) => presence.lastSeen(id),
    holding: (id) => presence.holding(id),
    close: async () => {},
  }
}
