import type { OfflineDayCounts, OfflineDayInfo } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// Handing a competition to a venue laptop: the online server keeps its hands off it until the day is loaded back

let online: TestApp
let venue: TestApp
let admin = ''
let scrutineer = ''
let competitionId = ''

beforeAll(async () => {
  online = await startTestApp()
  venue = await startTestApp({ env: { BIS_VENUE: 'true' } })
  admin = await online.signIn.staff('admin')
  scrutineer = await online.signIn.staff('scrutineer')
  competitionId = (online.sqlite.prepare('SELECT id FROM competitions WHERE floor_round_id IS NOT NULL').get() as { id: string }).id
})
afterAll(async () => {
  await online.close()
  await venue.close()
})

const get = (app: TestApp, url: string, cookie?: string) => app.app.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })
const post = (app: TestApp, url: string, payload: unknown, cookie?: string) => app.app.inject({ method: 'POST', url, payload: payload as object, headers: cookie ? { cookie } : {} })

describe('the offline day on the online server', () => {
  it('is for the admin only', async () => {
    expect((await online.call('getOfflineDays', [], scrutineer)).status).toBe(403)
    expect((await online.call('startOfflineDay', [competitionId], scrutineer)).status).toBe(403)
    expect((await get(online, '/api/offline/database', scrutineer)).statusCode).toBe(403)
    expect((await get(online, '/api/offline/database')).statusCode).toBe(401)
  })

  it('lists the competitions, hands one over, and pauses staff changes to it until it is taken back', async () => {
    const before = await online.ok<OfflineDayInfo>('getOfflineDays', [], admin)
    expect(before.venue).toBe(false)
    expect(before.competitions.find((c) => c.id === competitionId)!.heldAt).toBeNull()

    await online.ok('startOfflineDay', [competitionId], admin)
    expect((await online.ok<OfflineDayInfo>('getOfflineDays', [], admin)).competitions.find((c) => c.id === competitionId)!.heldAt).not.toBeNull()
    expect((await online.call('startOfflineDay', [competitionId], admin)).status).toBe(409)

    // Staff writes are paused, reads and the admin's own offline-day calls are not
    const paused = await online.call('clearFloor', [competitionId], scrutineer)
    expect(paused.status).toBe(409)
    expect(paused.error).toMatch(/venue laptop/)
    expect((await online.call('getHeats', [], scrutineer)).status).not.toBe(409)

    await online.ok('cancelOfflineDay', [competitionId], admin)
    expect((await online.call('cancelOfflineDay', [competitionId], admin)).status).toBe(409)
    expect((await online.call('clearFloor', [competitionId], scrutineer)).error ?? '').not.toMatch(/venue laptop/)
  })

  it('gives the admin a copy of the database for the laptop', async () => {
    const res = await get(online, '/api/offline/database', admin)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-disposition']).toContain('bis-venue-copy.db')
    expect(res.rawPayload.subarray(0, 15).toString()).toBe('SQLite format 3')
  })
})

describe('the day file', () => {
  it('goes from the venue laptop back to the online server, which then lets go of the competition', async () => {
    const venueAdmin = await venue.signIn.staff('admin')
    const file = await get(venue, `/api/offline/day?competition=${competitionId}`, venueAdmin)
    expect(file.statusCode).toBe(200)
    const pkg = JSON.parse(file.body)
    expect(pkg.format).toBe('bis-day-1')

    // Not handed over yet: refused, and nothing changes
    expect((await post(online, '/api/offline/day', pkg, admin)).statusCode).toBe(409)
    expect((await post(online, '/api/offline/day', pkg)).statusCode).toBe(401)
    expect((await post(online, '/api/offline/day', pkg, scrutineer)).statusCode).toBe(403)

    await online.ok('startOfflineDay', [competitionId], admin)
    expect((await post(online, '/api/offline/day', { format: 'nope' }, admin)).statusCode).toBe(400)

    // A trial run shows the counts and keeps the competition handed over
    const trial = await post(online, '/api/offline/day?dry=1', pkg, admin)
    expect(trial.statusCode).toBe(200)
    expect((trial.json().data as OfflineDayCounts).replaced.marks).toBeGreaterThan(0)
    expect((await online.ok<OfflineDayInfo>('getOfflineDays', [], admin)).competitions.find((c) => c.id === competitionId)!.heldAt).not.toBeNull()

    const done = await post(online, '/api/offline/day', pkg, admin)
    expect(done.statusCode).toBe(200)
    expect((await online.ok<OfflineDayInfo>('getOfflineDays', [], admin)).competitions.find((c) => c.id === competitionId)!.heldAt).toBeNull()
    expect(online.sqlite.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'Loaded the day from a venue laptop'").get()).toEqual({ n: 1 })
  })

  it('is not loaded on the venue laptop, and the laptop cannot hand a competition over', async () => {
    const venueAdmin = await venue.signIn.staff('admin')
    expect((await venue.call('startOfflineDay', [competitionId], venueAdmin)).status).toBe(400)
    expect((await post(venue, '/api/offline/day', { format: 'bis-day-1' }, venueAdmin)).statusCode).toBe(409)
  })
})
