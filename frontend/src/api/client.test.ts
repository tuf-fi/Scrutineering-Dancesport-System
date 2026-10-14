import { API_FUNCTIONS } from '@bis/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as client from './client.ts'
import { ApiError, isNetworkError, onReachability, onSessionEnded } from './http.ts'

// What the client sent, one entry per request
const sent: Array<{ url: string; body: unknown; method: string }> = []

function reply(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
}

function record(url: string, init?: RequestInit) {
  sent.push({ url, method: String(init?.method), body: init?.body ? JSON.parse(String(init.body)) : undefined })
}

// The next request gets this answer instead of the default one, and is recorded all the same
function answerNext(make: () => Promise<Response>) {
  vi.mocked(fetch).mockImplementationOnce((url, init) => {
    record(String(url), init)
    return make()
  })
}

beforeEach(() => {
  sent.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      record(url, init)
      return reply(200, { data: { ok: true } })
    }),
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  onReachability(() => {})
  onSessionEnded(() => {})
})

// Functions that are not server calls
const OTHER = new Set([
  'signInStaff',
  'signInClub',
  'signInAdjudicator',
  'signUpNewClub',
  'signOut',
  'getSession',
  'subscribeSubmissions',
  'getSubmissionSnapshot',
  'getDemoRounds',
  'startDemoRoundOnFloor',
  'getSampleCredentials',
])

describe('the client and the server agree', () => {
  it('has a function for every one the server offers', () => {
    const exported = Object.keys(client)
    expect(API_FUNCTIONS.filter((name) => !exported.includes(name))).toEqual([])
  })

  it('offers nothing the server does not, apart from sign-in and the sample-only stubs', () => {
    const functions = Object.entries(client)
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k)
    const strangers = functions.filter((name) => !(API_FUNCTIONS as readonly string[]).includes(name) && !OTHER.has(name))
    expect(strangers).toEqual([])
  })

  it('posts every function to its own name', async () => {
    for (const name of API_FUNCTIONS) {
      sent.length = 0
      const fn = (client as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>)[name]!
      await fn('a', 'b', 'c', 'd')
      expect(sent, name).toHaveLength(1)
      expect(sent[0]!.url, name).toBe(`/api/call/${name}`)
      expect(sent[0]!.method).toBe('POST')
    }
  })
})

describe('arguments', () => {
  it('drops the actor id: the server uses the signed-in session', async () => {
    const input = { name: 'x', date: '2026-01-01', venue: 'v', organizer: 'o' }
    await client.saveCompetition('staff-1', input, 'comp-1')
    expect(sent[0]!.body).toEqual({ args: [input, 'comp-1'] })
    sent.length = 0
    await client.approvePayment('staff-1', 'pay-1')
    expect(sent[0]!.body).toEqual({ args: ['pay-1'] })
    sent.length = 0
    await client.proposeTieDecision('staff-1', 'round-1', 'more')
    expect(sent[0]!.body).toEqual({ args: ['round-1', 'more'] })
  })

  it("drops an adjudicator's and a club's own id", async () => {
    await client.getAdjudicatorState('adj-a')
    expect(sent[0]!.body).toEqual({ args: [] })
    sent.length = 0
    const marks = [{ dance: 'samba' as const, competitorIds: ['c1'] }]
    await client.submitAdjudicatorMarks('adj-a', 'round-1', marks)
    expect(sent[0]!.body).toEqual({ args: ['round-1', marks] })
    sent.length = 0
    await client.registerClubEntries('club-1', 'dancer-1', ['e1'])
    expect(sent[0]!.body).toEqual({ args: ['dancer-1', ['e1']] })
  })

  it('sends reads as they are', async () => {
    await client.getEvents('comp-1')
    await client.getRankingPoints({ ageGroup: 'adult' })
    expect(sent.map((s) => s.body)).toEqual([{ args: ['comp-1'] }, { args: [{ ageGroup: 'adult' }] }])
  })

  it('sends the CSV text for the server to read', async () => {
    await client.importCompetitorsCsv('staff-1', '"Cruz, Mia",,Club')
    expect(sent[0]!.body).toEqual({ args: ['"Cruz, Mia",,Club'] })
  })
})

describe('answers', () => {
  it('returns the data the server sent', async () => {
    answerNext(() => reply(200, { data: [{ id: 'c1' }] }))
    expect(await client.getCompetitions()).toEqual([{ id: 'c1' }])
  })

  it('turns a server message into an error with its status', async () => {
    answerNext(() => reply(409, { error: 'Back number 4 is already taken.' }))
    const error = await client.setBackNumber('s', 'c1', 4).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 409, message: 'Back number 4 is already taken.' })
    expect(isNetworkError(error)).toBe(false)
  })

  it('reports a server that cannot be reached, and that it can be reached again', async () => {
    const reach = vi.fn()
    onReachability(reach)
    answerNext(() => Promise.reject(new TypeError('Failed to fetch')))
    const error = await client.getCompetitions().catch((e: unknown) => e)
    expect(isNetworkError(error)).toBe(true)
    expect(reach).toHaveBeenLastCalledWith(false)
    await client.getCompetitions()
    expect(reach).toHaveBeenLastCalledWith(true)
  })

  it('copes with something other than the venue server answering', async () => {
    answerNext(() => Promise.resolve(new Response('<html>Bad gateway</html>', { status: 502 })))
    await expect(client.getCompetitions()).rejects.toMatchObject({ status: 502 })
  })
})

describe('the session', () => {
  it('tells the app when the server ends it, but not when a sign-in is simply wrong', async () => {
    const ended = vi.fn()
    onSessionEnded(ended)
    answerNext(() => reply(401, { error: 'Sign in first.' }))
    await client.getStaffUsers().catch(() => {})
    expect(ended).toHaveBeenCalledTimes(1)

    answerNext(() => reply(401, { error: 'Wrong username or password.' }))
    await expect(client.signInStaff('admin', 'nope')).rejects.toMatchObject({ message: 'Wrong username or password.' })
    expect(ended).toHaveBeenCalledTimes(1)
  })

  it('signs in and out through the auth routes', async () => {
    answerNext(() => reply(200, { data: { id: 'u', name: 'Admin', role: 'admin' } }))
    expect(await client.signInStaff('admin', 'pw')).toMatchObject({ role: 'admin' })
    await client.signInAdjudicator('4100')
    await client.signInClub('a@b.c', 'pw')
    await client.signUpNewClub({ name: 'n', contactName: 'c', contactEmail: 'e@e.e', contactPhone: '1', password: 'longenough' })
    await client.signOut()
    expect(sent.map((s) => s.url)).toEqual([
      '/api/auth/staff',
      '/api/auth/adjudicator',
      '/api/auth/club',
      '/api/auth/club-signup',
      '/api/auth/sign-out',
    ])
    expect(sent[0]!.body).toEqual({ username: 'admin', password: 'pw' })
  })

  it('asks the server who the cookie belongs to', async () => {
    answerNext(() => reply(200, { data: null }))
    expect(await client.getSession()).toBeNull()
    expect(sent[0]).toMatchObject({ url: '/api/auth/me', method: 'GET' })
  })
})
