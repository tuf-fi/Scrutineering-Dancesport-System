import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import fastifyStatic from '@fastify/static'
import { ScoringError } from '@bis/scoring'
import { Role, type SessionUser } from '@bis/shared'
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify'
import { sql } from 'drizzle-orm'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { RequestLimiter } from './auth/ratelimit.ts'
import { adjudicatorSession, athleteSession, memberSession, AttemptLimiter, resolveSession, staffSession, startVersion } from './auth/signin.ts'
import { createAthlete } from './services/athletes.ts'
import { createMember } from './services/members.ts'
import { record } from './core/audit.ts'
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

export interface AppDeps {
  config: Config
  sqlite: Sqlite
  db: Db
  // Tests pass a silent hub; the real server attaches Socket.IO
  hub?: Hub
  backups?: Backups
  // How often the live board is checked for a phone that went quiet; 0 turns it off
  liveBoardMs?: number
}

const SESSION_HOURS = 12

// When the admin was last told about a wrong PIN
let lastPinAlert = 0

export async function buildApp({ config, sqlite, db, hub: givenHub, backups = noBackups(), liveBoardMs = 3000 }: AppDeps) {
  const options = { logger: false, bodyLimit: 8 * 1024 * 1024, trustProxy: typeof config.trustProxy === 'number' ? (_address: string, hop: number) => hop < (config.trustProxy as number) : config.trustProxy }
  const app = Fastify(options) as unknown as FastifyInstance
  await app.register(cookie)
  await app.register(jwt, { secret: config.cookieSecret })

  type Claims = SessionUser & { sv?: number }
  const verifyToken = (token: string): Claims | null => {
    try {
      return app.jwt.verify<Claims>(token)
    } catch {
      return null
    }
  }
  // A token counts only while its account still exists and has not been signed out; sockets obey the same rule
  const resolveToken = (token: string): SessionUser | null => {
    const claims = verifyToken(token)
    return claims ? resolveSession(baseContext(null), claims) : null
  }
  const hub = givenHub ?? createSocketHub(app.server, resolveToken)
  // A backup folder that stops (or starts) working is shown on the scrutineer's screen at once
  backups.onChange(() => hub.changed('backups'))

  const baseContext = (user: SessionUser | null, deferred: Array<() => void> = []): Ctx => ({
    db,
    sqlite,
    hub,
    backups,
    config,
    user,
    defer: (task) => void deferred.push(task),
    afterApproval: () => void backups.run(),
  })

  const sessionOf = (request: FastifyRequest): SessionUser | null => {
    const token = request.cookies[SESSION_COOKIE]
    return token ? resolveToken(token) : null
  }

  const sendError = (reply: FastifyReply, error: unknown) => {
    if (error instanceof HttpError) return reply.code(error.status).send({ error: error.message })
    if (error instanceof ScoringError) return reply.code(409).send({ error: error.issues.join(' ') })
    console.error(error)
    return reply.code(500).send({ error: 'Something went wrong on the server.' })
  }

  const startSession = (reply: FastifyReply, user: SessionUser, version = 0) => {
    const token = app.jwt.sign({ id: user.id, name: user.name, role: user.role, letter: user.letter, sv: version }, { expiresIn: `${SESSION_HOURS}h` })
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
      maxAge: SESSION_HOURS * 3600,
    })
    return { data: user }
  }

  // The host's health check reads this
  app.get('/api/health', async (_request, reply) => {
    try {
      sqlite.prepare('select 1').get()
    } catch {
      return reply.code(503).send({ status: 'error', database: false, time: now() })
    }
    return { status: 'ok', database: true, time: now() }
  })

  // ---- Sign-in ----

  // Wrong guesses are counted three ways: per address and name; per account from anywhere, so guessing spread over many
  // addresses still runs out; and for PINs across everyone, because a PIN has only 9,000 values and a success must not
  // reset that count (a valid PIN in the attacker's hands would otherwise buy more guesses).
  const limiter = new AttemptLimiter()
  const accounts = new AttemptLimiter(20, 15 * 60_000)
  const pins = new AttemptLimiter(25, 10 * 60_000)
  const attempt = async (request: FastifyRequest, reply: FastifyReply, identity: string, make: (ctx: Ctx) => SessionUser, kind: 'account' | 'pin' = 'account') => {
    const key = `${request.ip}|${identity.toLowerCase()}`
    const wide = kind === 'pin' ? pins : accounts
    const wideKey = kind === 'pin' ? 'pin' : identity.toLowerCase()
    try {
      limiter.check(key)
      wide.check(wideKey)
      const ctx = baseContext(null)
      const user = make(ctx)
      limiter.succeeded(key)
      if (kind === 'account') wide.succeeded(wideKey)
      else record(db, user.id, 'Adjudicator signed in', user.name)
      return startSession(reply, user, startVersion(ctx, user))
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        limiter.failed(key)
        wide.failed(wideKey)
        if (kind === 'pin') {
          record(db, 'pin-sign-in', 'Failed PIN sign-in', request.ip)
          // A wrong PIN now and then is normal; the admin hears about it at most once a minute
          if (Date.now() - lastPinAlert > 60_000) {
            lastPinAlert = Date.now()
            hub.alert([Role.Admin], { title: 'Wrong PIN tried', detail: 'Someone entered a PIN that is not registered', link: '/admin/security' })
          }
        }
      }
      return sendError(reply, error)
    }
  }
  // Nothing sent to these routes is large, unlike a payment receipt
  const small = { bodyLimit: 16 * 1024 }
  const body = (request: FastifyRequest) => (request.body ?? {}) as Record<string, string>

  app.post('/api/auth/staff', small, (request, reply) =>
    attempt(request, reply, String(body(request).username ?? ''), (ctx) => staffSession(ctx, String(body(request).username ?? ''), String(body(request).password ?? ''), String(body(request).code ?? ''))),
  )
  app.post('/api/auth/adjudicator', small, (request, reply) =>
    attempt(request, reply, 'pin', (ctx) => adjudicatorSession(ctx, String(body(request).pin ?? '')), 'pin'),
  )
  app.post('/api/auth/athlete', small, (request, reply) =>
    attempt(request, reply, String(body(request).email ?? ''), (ctx) => athleteSession(ctx, String(body(request).email ?? ''), String(body(request).password ?? ''))),
  )
  // Anyone can make an account, so a few per address per hour keeps one visitor from filling the database
  const signUps = new RequestLimiter(5, 60 * 60_000)
  app.post('/api/auth/athlete/sign-up', small, async (request, reply) => {
    if (!signUps.take(request.ip)) return reply.code(429).header('retry-after', '3600').send({ error: 'Too many new accounts from this connection. Try again later.' })
    try {
      const input = body(request)
      const user = sqlite.transaction(() => createAthlete(baseContext(null), { name: String(input.name ?? ''), email: String(input.email ?? ''), password: String(input.password ?? ''), photo: String(input.photo ?? '') }))()
      return startSession(reply, user, 0)
    } catch (error) {
      return sendError(reply, error)
    }
  })
  for (const role of ['coach', 'team'] as const) {
    app.post(`/api/auth/${role}`, small, (request, reply) =>
      attempt(request, reply, String(body(request).email ?? ''), (ctx) => memberSession(ctx, role, String(body(request).email ?? ''), String(body(request).password ?? ''))),
    )
    app.post(`/api/auth/${role}/sign-up`, small, async (request, reply) => {
      if (!signUps.take(request.ip)) return reply.code(429).header('retry-after', '3600').send({ error: 'Too many new accounts from this connection. Try again later.' })
      try {
        const input = body(request)
        const user = sqlite.transaction(() => createMember(baseContext(null), role, { name: String(input.name ?? ''), email: String(input.email ?? ''), password: String(input.password ?? ''), photo: String(input.photo ?? '') }))()
        return startSession(reply, user, 0)
      } catch (error) {
        return sendError(reply, error)
      }
    })
  }
  app.post('/api/auth/sign-out', async (_request, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { data: null }
  })
  app.get('/api/auth/me', async (request) => ({ data: sessionOf(request) }))

  // ---- Every other call: POST /api/call/<name> with { args: [...] } ----

  // Signed-in people are not counted: they are known, and a scrutineer's screen asks often. Everyone else shares a cap
  // per address, so a visitor hammering the public pages cannot slow the competition down.
  const publicLimiter = config.publicRatePerMinute === null ? null : new RequestLimiter(config.publicRatePerMinute)

  app.post('/api/call/:name', async (request, reply) => {
    const { name } = request.params as { name: string }
    const route = endpoint(name)
    if (!route) return reply.code(404).send({ error: 'Unknown request.' })
    const deferred: Array<() => void> = []
    const ctx = baseContext(sessionOf(request), deferred)
    if (!ctx.user && publicLimiter && !publicLimiter.take(request.ip)) {
      return reply.code(429).header('retry-after', '60').send({ error: 'Too many requests. Wait a minute and try again.' })
    }
    const args = Array.isArray((request.body as { args?: unknown } | null)?.args) ? ((request.body as { args: unknown[] }).args) : []
    try {
      allowed(route.access, ctx)
      const data = route.write ? sqlite.transaction(() => route.run(ctx, args))() : route.run(ctx, args)
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
        // Every change is copied to the backup folders within a moment
        backups.soon()
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
      // The page must always be checked with the server, or a phone could keep an old version for good. Files with a
      // hash in their name never change, so they are kept.
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

  app.addHook('onClose', async () => {
    if (sweep) clearInterval(sweep)
    backups.stop()
    await hub.close()
  })

  return app
}
