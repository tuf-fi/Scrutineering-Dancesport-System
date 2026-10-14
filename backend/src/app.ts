import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import fastifyStatic from '@fastify/static'
import { ScoringError } from '@bis/scoring'
import type { SessionUser } from '@bis/shared'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { sql } from 'drizzle-orm'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { adjudicatorSession, AttemptLimiter, clubSession, resolveSession, signUpClub, staffSession } from './auth/signin.ts'
import { noBackups, type Backups } from './backup.ts'
import type { Config } from './config.ts'
import { HttpError, type Ctx } from './core/context.ts'
import type { Db, Sqlite } from './db/client.ts'
import * as t from './db/schema.ts'
import { now } from './ids.ts'
import { createSocketHub, SESSION_COOKIE } from './realtime/socket.ts'
import type { Hub } from './realtime/hub.ts'
import { allowed, endpoint } from './registry.ts'
import { submissionSnapshot } from './services/rounds.ts'
import { registerMessengerWebhook } from './messengerWebhook.ts'
import { registerCloudSync } from './sync/cloud.ts'
import { createSyncService } from './sync/venue.ts'

export interface AppDeps {
  config: Config
  sqlite: Sqlite
  db: Db
  // Tests pass a silent hub; the real server attaches Socket.IO
  hub?: Hub
  backups?: Backups
  // How often the live board is checked for a phone that went quiet; 0 turns it off
  liveBoardMs?: number
  // Venue with a cloud address: keep sending changes to the cloud in the background
  startSync?: boolean
}

const SESSION_HOURS = 12

export async function buildApp({ config, sqlite, db, hub: givenHub, backups = noBackups(), liveBoardMs = 3000, startSync = false }: AppDeps) {
  const options = { logger: false, bodyLimit: 8 * 1024 * 1024, trustProxy: config.trustProxy }
  // With a certificate the server speaks HTTPS, so phones will keep an offline copy of the app
  const tls = config.tlsCert && config.tlsKey ? { cert: readFileSync(config.tlsCert), key: readFileSync(config.tlsKey) } : null
  const app = (tls ? Fastify({ ...options, https: tls }) : Fastify(options)) as unknown as FastifyInstance
  await app.register(cookie)
  await app.register(jwt, { secret: config.cookieSecret })

  const verifyToken = (token: string): SessionUser | null => {
    try {
      return app.jwt.verify<SessionUser>(token)
    } catch {
      return null
    }
  }
  const hub = givenHub ?? createSocketHub(app.server, verifyToken)
  // A backup folder that stops (or starts) working is shown on the scrutineer's screen at once
  backups.onChange(() => hub.changed('backups'))

  // At a venue: sends changes to the cloud. Online there is nothing to send.
  const sync = config.mode === 'venue' ? createSyncService({ config, sqlite, hub }) : null

  const baseContext = (user: SessionUser | null, deferred: Array<() => void> = []): Ctx => ({
    db,
    sqlite,
    hub,
    backups,
    sync,
    config,
    user,
    defer: (task) => void deferred.push(task),
    afterApproval: () => void backups.run(),
  })

  const sessionOf = (request: FastifyRequest): SessionUser | null => {
    const token = request.cookies[SESSION_COOKIE]
    const claims = token ? verifyToken(token) : null
    return claims ? resolveSession(baseContext(null), claims) : null
  }

  const sendError = (reply: FastifyReply, error: unknown) => {
    if (error instanceof HttpError) return reply.code(error.status).send({ error: error.message })
    if (error instanceof ScoringError) return reply.code(409).send({ error: error.issues.join(' ') })
    console.error(error)
    return reply.code(500).send({ error: 'Something went wrong on the server.' })
  }

  const startSession = (reply: FastifyReply, user: SessionUser) => {
    const token = app.jwt.sign({ id: user.id, name: user.name, role: user.role, letter: user.letter }, { expiresIn: `${SESSION_HOURS}h` })
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
      maxAge: SESSION_HOURS * 3600,
    })
    return { data: user }
  }

  // The venue Wi-Fi and the online site both read this
  app.get('/api/health', async (_request, reply) => {
    try {
      sqlite.prepare('select 1').get()
    } catch {
      return reply.code(503).send({ status: 'error', mode: config.mode, database: false, time: now() })
    }
    return { status: 'ok', mode: config.mode, database: true, time: now() }
  })

  // ---- Sign-in ----

  const limiter = new AttemptLimiter()
  const attempt = async (request: FastifyRequest, reply: FastifyReply, identity: string, make: (ctx: Ctx) => SessionUser) => {
    const key = `${request.ip}|${identity.toLowerCase()}`
    try {
      limiter.check(key)
      const user = make(baseContext(null))
      limiter.succeeded(key)
      return startSession(reply, user)
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) limiter.failed(key)
      return sendError(reply, error)
    }
  }
  const body = (request: FastifyRequest) => (request.body ?? {}) as Record<string, string>

  app.post('/api/auth/staff', (request, reply) =>
    attempt(request, reply, String(body(request).username ?? ''), (ctx) => staffSession(ctx, String(body(request).username ?? ''), String(body(request).password ?? ''))),
  )
  app.post('/api/auth/club', (request, reply) =>
    attempt(request, reply, String(body(request).email ?? ''), (ctx) => clubSession(ctx, String(body(request).email ?? ''), String(body(request).password ?? ''))),
  )
  // Adjudicators mark at the venue; online there is no PIN sign-in
  if (config.mode === 'venue') app.post('/api/auth/adjudicator', (request, reply) =>
    attempt(request, reply, 'pin', (ctx) => adjudicatorSession(ctx, String(body(request).pin ?? ''))),
  )
  app.post('/api/auth/club-signup', async (request, reply) => {
    try {
      const user = sqlite.transaction(() => signUpClub(baseContext(null), request.body as never))()
      return startSession(reply, user)
    } catch (error) {
      return sendError(reply, error)
    }
  })
  app.post('/api/auth/sign-out', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { data: null }
  })
  app.get('/api/auth/me', async (request) => ({ data: sessionOf(request) }))

  // ---- Online: venues download competitions and send results back ----

  if (config.mode === 'cloud') registerCloudSync(app, { config, sqlite, db, hub, sendError })
  if (config.mode === 'cloud' && config.messenger.verifyToken) registerMessengerWebhook(app, { config, db })

  // ---- Every other call: POST /api/call/<name> with { args: [...] } ----

  app.post('/api/call/:name', async (request, reply) => {
    const { name } = request.params as { name: string }
    const route = endpoint(name)
    if (!route || (route.mode === 'venue' && config.mode === 'cloud') || (route.mode === 'cloud' && config.mode === 'venue')) {
      return reply.code(404).send({ error: route ? 'This is not available here.' : 'Unknown request.' })
    }
    const deferred: Array<() => void> = []
    const ctx = baseContext(sessionOf(request), deferred)
    const args = Array.isArray((request.body as { args?: unknown } | null)?.args) ? ((request.body as { args: unknown[] }).args) : []
    try {
      allowed(route.access, ctx)
      const data = route.async ? await route.run(ctx, args) : route.write ? sqlite.transaction(() => route.run(ctx, args))() : route.run(ctx, args)
      // Only after the change is saved do other screens hear about it
      for (const task of deferred) {
        try {
          task()
        } catch (error) {
          console.error(error)
        }
      }
      if (route.write) {
        hub.changed(name)
        // Every change is copied to the backup folders, and sent to the cloud, within a moment
        backups.soon()
        sync?.soon()
      }
      return { data: data ?? null }
    } catch (error) {
      return sendError(reply, error)
    }
  })

  // ---- Live board: tell the scrutineer when a phone goes quiet ----

  const lastBoard = new Map<string, string>()
  let sweep: ReturnType<typeof setInterval> | undefined
  if (liveBoardMs > 0) {
    sweep = setInterval(() => {
      try {
        const ctx = baseContext(null)
        const onFloor = db.select().from(t.competitions).where(sql`${t.competitions.floorRoundId} is not null`).all()
        for (const competition of onFloor) {
          const roundId = competition.floorRoundId!
          const snapshot = submissionSnapshot(ctx, roundId)
          const key = JSON.stringify(snapshot)
          if (lastBoard.get(roundId) !== key) {
            lastBoard.set(roundId, key)
            hub.submissions(roundId, snapshot)
          }
        }
      } catch (error) {
        console.error(error)
      }
    }, liveBoardMs)
    sweep.unref()
  }

  // ---- The built frontend, so other devices only need a browser ----

  const frontend = config.frontendDir ? resolve(config.frontendDir) : null
  if (frontend && existsSync(resolve(frontend, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: frontend,
      wildcard: false,
      // The page, the service worker and the manifest must always be checked with the server, or a phone could keep
      // an old version for good. Files with a hash in their name never change, so they are kept.
      setHeaders: (res, path) => {
        const name = path.replace(/\\/g, '/')
        res.header('cache-control', /\/assets\//.test(name) ? 'public, max-age=31536000, immutable' : 'no-cache')
      },
    })
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api/')) return reply.sendFile('index.html')
      return reply.code(404).send({ error: 'Unknown request.' })
    })
  } else {
    app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: 'Unknown request.' }))
  }

  if (startSync) sync?.start()

  app.addHook('onClose', async () => {
    sync?.stop()
    if (sweep) clearInterval(sweep)
    backups.stop()
    await hub.close()
  })

  return app
}
