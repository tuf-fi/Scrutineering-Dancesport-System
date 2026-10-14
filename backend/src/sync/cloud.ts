import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createHash, timingSafeEqual } from 'node:crypto'
import { record } from '../core/audit.ts'
import type { Config } from '../config.ts'
import { HttpError } from '../core/context.ts'
import type { Db, Sqlite } from '../db/client.ts'
import { now } from '../ids.ts'
import type { Hub } from '../realtime/hub.ts'
import { applyChanges, type SyncItem } from './apply.ts'
import { buildSnapshot } from './snapshot.ts'

interface Deps {
  config: Config
  sqlite: Sqlite
  db: Db
  hub: Hub
  sendError: (reply: FastifyReply, error: unknown) => unknown
}

const MAX_ITEMS = 1000

const sha = (text: string) => createHash('sha256').update(text).digest()

// Each venue has its own secret, so one can be cut off without touching the others
function venueOf(config: Config, request: FastifyRequest): string {
  const venue = String(request.headers['x-venue-id'] ?? '')
  const bearer = /^Bearer (.+)$/.exec(String(request.headers.authorization ?? ''))?.[1] ?? ''
  const expected = config.syncTokens[venue]
  // Compared as hashes so the check takes the same time whatever is wrong
  const ok = expected !== undefined && timingSafeEqual(sha(bearer), sha(expected))
  if (!ok) throw new HttpError(401, 'This venue is not allowed to sync.')
  return venue
}

const competitionHolder = (sqlite: Sqlite, competitionId: string) =>
  sqlite.prepare('SELECT id, name, held_by AS heldBy, held_at AS heldAt FROM competitions WHERE id = ?').get(competitionId) as
    | { id: string; name: string; heldBy: string | null; heldAt: string | null }
    | undefined

// The cloud's half of syncing: venues download a competition they will run, and send back what happened
export function registerCloudSync(app: FastifyInstance, { config, sqlite, db, hub, sendError }: Deps) {
  const route = (path: string, handle: (venue: string, body: Record<string, unknown>) => unknown) =>
    app.post(`/api/sync/${path}`, async (request, reply) => {
      try {
        if (Object.keys(config.syncTokens).length === 0) throw new HttpError(404, 'Syncing is not set up on this server.')
        const venue = venueOf(config, request)
        return { data: handle(venue, (request.body ?? {}) as Record<string, unknown>) }
      } catch (error) {
        return sendError(reply, error)
      }
    })

  route('ping', () => ({ mode: config.mode, time: now() }))

  route('competitions', () =>
    sqlite
      .prepare(
        `SELECT c.id, c.name, c.date, c.venue, c.organizer, c.held_by AS heldBy, c.held_at AS heldAt,
                (SELECT count(*) FROM entries e JOIN events ev ON ev.id = e.event_id WHERE ev.competition_id = c.id AND e.scratched = 0) AS entries
         FROM competitions c ORDER BY c.date DESC`,
      )
      .all(),
  )

  // Hands over a competition: the venue now runs it, and entries and payments for it close online
  route('pull', (venue, body) => {
    const competitionId = String(body.competitionId ?? '')
    return sqlite.transaction(() => {
      const competition = competitionHolder(sqlite, competitionId)
      if (!competition) throw new HttpError(404, 'Competition not found')
      if (competition.heldBy && competition.heldBy !== venue) {
        throw new HttpError(409, `${competition.name} is already being run by ${competition.heldBy} (since ${competition.heldAt}). An admin can release it.`)
      }
      if (!competition.heldBy) {
        sqlite.prepare('UPDATE competitions SET held_by = ?, held_at = ? WHERE id = ?').run(venue, now(), competitionId)
        record(db, `venue:${venue}`, 'Venue took the competition', competition.name, { after: { heldBy: venue } })
      }
      return buildSnapshot(sqlite, competitionId)
    })()
  })

  route('upload', (venue, body) => {
    const items = Array.isArray(body.items) ? (body.items as SyncItem[]) : []
    if (items.length > MAX_ITEMS) throw new HttpError(400, `Send at most ${MAX_ITEMS} changes at a time.`)
    // Changes to a competition only count from the venue that holds it
    for (const item of items) {
      const competitionId = typeof item.payload?.competition_id === 'string' ? item.payload.competition_id : null
      if (competitionId && (item.entity === 'events' || item.entity === 'ranking_points')) {
        const holder = competitionHolder(sqlite, competitionId)?.heldBy
        if (holder !== venue) throw new HttpError(409, `This venue does not hold that competition${holder ? ` (${holder} does)` : ''}. Download it first.`)
      }
    }
    let applied
    try {
      applied = applyChanges(sqlite, items)
    } catch (error) {
      if (error instanceof Error && !(error instanceof HttpError)) throw new HttpError(422, error.message)
      throw error
    }
    // Spectators watching online see results the moment they arrive
    for (const round of applied.published) {
      const event = sqlite.prepare('SELECT competition_id AS c FROM events WHERE id = ?').get(round.eventId) as { c: string } | undefined
      if (event) hub.published({ competitionId: event.c, eventId: round.eventId, roundId: round.roundId })
    }
    if (applied.rankingsChanged) hub.rankings()
    if (applied.applied > 0) hub.changed('sync')
    return { applied: applied.applied }
  })

  // The venue is finished with the competition: entries and payments can change online again
  route('release', (venue, body) => {
    const competitionId = String(body.competitionId ?? '')
    const competition = competitionHolder(sqlite, competitionId)
    if (!competition) throw new HttpError(404, 'Competition not found')
    if (competition.heldBy !== venue) throw new HttpError(409, 'This venue does not hold that competition.')
    sqlite.transaction(() => {
      sqlite.prepare('UPDATE competitions SET held_by = NULL, held_at = NULL WHERE id = ?').run(competitionId)
      record(db, `venue:${venue}`, 'Venue released the competition', competition.name)
    })()
    return { released: true }
  })
}
