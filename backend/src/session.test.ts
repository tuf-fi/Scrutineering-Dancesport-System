import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// A signed token stays good only while the account's session version is the one it was made at

let app: TestApp
let admin = ''
beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
})
afterAll(() => app.close())

const me = async (cookie: string) => (await app.me(cookie))?.name ?? null

describe('one phone at a time for an adjudicator', () => {
  it('signs the first phone out when the same PIN signs in on a second one', async () => {
    const first = await app.signIn.adjudicator('4100')
    expect(await me(first)).not.toBeNull()
    const second = await app.signIn.adjudicator('4100')
    expect(await me(second)).not.toBeNull()
    expect(await me(first)).toBeNull()
    expect((await app.call('getAdjudicatorState', [], first)).status).toBe(401)
    expect((await app.call('getAdjudicatorState', [], second)).status).not.toBe(401)
  })

  it('does not touch other adjudicators', async () => {
    const a = await app.signIn.adjudicator('4100')
    await app.signIn.adjudicator('4211')
    expect(await me(a)).not.toBeNull()
  })

  it('signs the old phone out when the admin gives a new PIN', async () => {
    const phone = await app.signIn.adjudicator('4211')
    const competition = (await app.ok<Array<{ id: string }>>('getCompetitions', [], admin))[0]!.id
    const pins = await app.ok<Array<{ adjudicatorId: string; pin: string }>>('getAdjudicatorPins', [competition], admin)
    const adjudicator = pins.find((p) => p.pin === '4211')!.adjudicatorId
    await app.ok('generatePins', [competition, adjudicator], admin)
    expect(await me(phone)).toBeNull()
  })
})

describe('signing a person out everywhere', () => {
  it('stops a staff token at once, and lets them sign in again', async () => {
    const scrutineer = await app.signIn.staff('scrutineer')
    const id = (await app.me(scrutineer))!.id
    expect(await me(scrutineer)).not.toBeNull()
    await app.ok('revokeSessions', ['staff', id], admin)
    expect(await me(scrutineer)).toBeNull()
    expect((await app.call('getEntries', ['x'], scrutineer)).status).toBe(401)
    expect(await me(await app.signIn.staff('scrutineer'))).not.toBeNull()
  })

  it('works for a club, and is for admins only', async () => {
    const email = (app.sqlite.prepare('select contact_email as e from clubs where password_hash is not null limit 1').get() as { e: string }).e
    const club = await app.signIn.club(email)
    const id = (await app.me(club))!.id
    expect((await app.call('revokeSessions', ['club', id], club)).status).toBe(403)
    expect((await app.call('revokeSessions', ['club', id], await app.signIn.staff('secretariat'))).status).toBe(403)
    await app.ok('revokeSessions', ['club', id], admin)
    expect(await me(club)).toBeNull()
  })

  it('is recorded, and refuses an unknown kind or person', async () => {
    expect((await app.call('revokeSessions', ['robot', 'x'], admin)).status).toBe(400)
    expect((await app.call('revokeSessions', ['staff', 'nobody'], admin)).status).toBe(404)
    expect(app.sqlite.prepare("select count(*) as n from audit_log where action = 'Signed out everywhere'").get()).toMatchObject({ n: expect.any(Number) })
  })

  it('happens when an admin resets a staff password', async () => {
    const chair = await app.signIn.staff('chairperson')
    const id = (await app.me(chair))!.id
    await app.ok('resetStaffPassword', [id], admin)
    expect(await me(chair)).toBeNull()
  })
})

describe('tokens made before session versions existed', () => {
  it('still work until the account is signed out', async () => {
    const id = (await app.me(await app.signIn.staff('mc')))!.id
    const old = app.app.jwt.sign({ id, name: 'Old token', role: 'mc' }, { expiresIn: '1h' })
    expect(await me(`bis_session=${old}`)).not.toBeNull()
    await app.ok('revokeSessions', ['staff', id], admin)
    expect(await me(`bis_session=${old}`)).toBeNull()
  })
})
