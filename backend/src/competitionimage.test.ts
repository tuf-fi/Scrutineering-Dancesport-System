import type { Competition } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// A competition's card photo for the home page: kept, checked, and left alone when an edit does not send one

let app: TestApp
let admin = ''
const SHOT = 'data:image/png;base64,iVBORw0KGgo='
const base = { name: 'Photo Cup', date: '2099-05-01', venue: 'Gym', organizer: 'Org' }

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  app.db.insert(t.staffUsers).values({ id: 's1', name: 'admin', username: 'admin@sample.example', role: 'admin', passwordHash: hashPassword('pw-admin'), disabled: false }).run()
  admin = await app.signIn.staff('admin', 'pw-admin')
})
afterAll(() => app.close())

describe('competition photo', () => {
  it('saves the photo, refuses anything that is not a picture, and keeps it through an edit that sends none, and always needs one', async () => {
    const made = await app.ok<Competition>('saveCompetition', [{ ...base, image: SHOT }], admin)
    expect(made.image).toMatch(new RegExp(`^/api/competition-image/${made.id}\\?v=`))
    expect((await app.call('saveCompetition', [{ ...base, image: 'not-a-picture' }], admin)).error).toMatch(/JPEG, PNG or WebP/)

    const edited = await app.ok<Competition>('saveCompetition', [{ ...base, venue: 'New Gym' }, made.id], admin)
    expect(edited).toMatchObject({ venue: 'New Gym', image: made.image })
    const list = await app.ok<Competition[]>('getCompetitions', [], admin)
    expect(list.find((c) => c.id === made.id)?.image).toBe(made.image)
    expect(JSON.stringify(list)).not.toContain('base64')

    // Sending back the address a read gave keeps the photo, as the edit form does
    const resent = await app.ok<Competition>('saveCompetition', [{ ...base, venue: 'Third Gym', image: made.image }, made.id], admin)
    expect(resent).toMatchObject({ venue: 'Third Gym', image: made.image })

    // A competition cannot be left without one, whether new or being edited
    expect((await app.call('saveCompetition', [base], admin)).error).toMatch(/Add the photo/)
    expect((await app.call('saveCompetition', [{ ...base, image: '' }, made.id], admin)).error).toMatch(/Add the photo/)
  })

  it('serves the photo from its own address, cacheable, and says when it has not changed', async () => {
    const made = (await app.ok<Competition[]>('getCompetitions', [])).find((c) => c.name === 'Photo Cup')!
    const first = await app.app.inject({ method: 'GET', url: made.image! })
    expect(first.statusCode).toBe(200)
    expect(first.headers['content-type']).toBe('image/png')
    expect(first.headers['cache-control']).toMatch(/immutable/)
    const again = await app.app.inject({ method: 'GET', url: made.image!, headers: { 'if-none-match': String(first.headers.etag) } })
    expect(again.statusCode).toBe(304)
    expect((await app.app.inject({ method: 'GET', url: '/api/competition-image/nobody' })).statusCode).toBe(404)
  })

  it('serves the home page pictures the same way, and keeps them out of the settings', async () => {
    expect((await app.app.inject({ method: 'GET', url: '/api/site-image/hero' })).statusCode).toBe(404)
    await app.ok('saveHeroImage', [SHOT], admin)
    const settings = await app.ok<{ heroImage: string | null; signInImage: string | null }>('getSiteSettings', [])
    expect(settings.heroImage).toMatch(/^\/api\/site-image\/hero\?v=/)
    expect(settings.signInImage).toBeNull()
    const served = await app.app.inject({ method: 'GET', url: settings.heroImage! })
    expect(served.statusCode).toBe(200)
    expect(served.headers['content-type']).toBe('image/png')
    expect((await app.app.inject({ method: 'GET', url: '/api/site-image/other' })).statusCode).toBe(404)
  })
})
