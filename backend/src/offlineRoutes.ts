import { Role, type SessionUser } from '@bis/shared'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Backups } from './backup.ts'
import type { Config } from './config.ts'
import { record } from './core/audit.ts'
import { DAY_FORMAT, exportDay, importDay, type DayPackage } from './db/dayPackage.ts'
import type { Db, Sqlite } from './db/client.ts'
import type { Hub } from './realtime/hub.ts'

// The files of an offline day are too big for a normal call, so they have their own routes, for the admin only:
//   GET  /api/offline/database           the online server's database, to put on the venue laptop
//   GET  /api/offline/day?competition=   on the laptop: the day's work as one file
//   POST /api/offline/day?competition=   on the online server: load that file ("&dry=1" only shows what would change)
const MAX_DAY_BYTES = 200 * 1024 * 1024

interface Deps {
  config: Config
  sqlite: Sqlite
  db: Db
  hub: Hub
  backups: Backups
  sessionOf: (request: FastifyRequest) => SessionUser | null
}

export function registerOfflineRoutes(app: FastifyInstance, { config, sqlite, db, hub, backups, sessionOf }: Deps) {
  const adminOnly = (request: FastifyRequest, reply: FastifyReply): SessionUser | null => {
    const user = sessionOf(request)
    if (!user) {
      reply.code(401).send({ error: 'Sign in first.' })
      return null
    }
    if (user.role !== Role.Admin) {
      reply.code(403).send({ error: 'Only the admin can do this.' })
      return null
    }
    return user
  }
  const heldAt = (competitionId: string) =>
    (sqlite.prepare('SELECT offline_held_at AS heldAt FROM competitions WHERE id = ?').get(competitionId) as { heldAt: string | null } | undefined)

  app.get('/api/offline/database', async (request, reply) => {
    const user = adminOnly(request, reply)
    if (!user) return reply
    const dir = await mkdtemp(join(tmpdir(), 'bis-copy-'))
    const file = join(dir, 'bis.db')
    try {
      await sqlite.backup(file)
    } catch (error) {
      await rm(dir, { recursive: true, force: true })
      console.error(error)
      return reply.code(500).send({ error: 'Could not make a copy of the database.' })
    }
    record(db, user.id, 'Downloaded a copy of the database for a venue laptop', config.venue ? 'venue laptop' : 'online server')
    const stream = createReadStream(file)
    stream.on('close', () => void rm(dir, { recursive: true, force: true }))
    return reply
      .header('content-type', 'application/octet-stream')
      .header('content-disposition', 'attachment; filename="bis-venue-copy.db"')
      .header('cache-control', 'no-store')
      .send(stream)
  })

  app.get('/api/offline/day', async (request, reply) => {
    const user = adminOnly(request, reply)
    if (!user) return reply
    const id = String((request.query as { competition?: string }).competition ?? '')
    if (!heldAt(id)) return reply.code(404).send({ error: 'Competition not found.' })
    const pkg = exportDay(sqlite, id)
    record(db, user.id, 'Made the day file', pkg.competitionName)
    const name = pkg.competitionName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'competition'
    return reply
      .header('content-type', 'application/json')
      .header('content-disposition', `attachment; filename="bis-day-${name}.json"`)
      .header('cache-control', 'no-store')
      .send(JSON.stringify(pkg))
  })

  app.post('/api/offline/day', { bodyLimit: MAX_DAY_BYTES }, async (request, reply) => {
    const user = adminOnly(request, reply)
    if (!user) return reply
    if (config.venue) return reply.code(409).send({ error: 'Load the day on the online server, not on the venue laptop.' })
    const pkg = request.body as DayPackage | null
    if (!pkg || pkg.format !== DAY_FORMAT) return reply.code(400).send({ error: 'This is not a BIS competition day file.' })
    const held = heldAt(String(pkg.competitionId))
    if (!held) return reply.code(404).send({ error: 'This server does not have that competition.' })
    if (!held.heldAt) return reply.code(409).send({ error: 'This competition is not with a venue laptop. Start its offline day first.' })
    const dryRun = (request.query as { dry?: string }).dry === '1'
    try {
      const counts = importDay(sqlite, pkg, { dryRun })
      if (!dryRun) {
        record(db, user.id, 'Loaded the day from a venue laptop', pkg.competitionName)
        hub.changed('offline')
        backups.soon()
      }
      return { data: counts }
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'Could not load the file.' })
    }
  })
}
