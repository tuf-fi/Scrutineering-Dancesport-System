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
    expect(made.image).toBe(SHOT)
    expect((await app.call('saveCompetition', [{ ...base, image: 'not-a-picture' }], admin)).error).toMatch(/JPEG, PNG or WebP/)

    const edited = await app.ok<Competition>('saveCompetition', [{ ...base, venue: 'New Gym' }, made.id], admin)
    expect(edited).toMatchObject({ venue: 'New Gym', image: SHOT })
    const list = await app.ok<Competition[]>('getCompetitions', [], admin)
    expect(list.find((c) => c.id === made.id)?.image).toBe(SHOT)

    // A competition cannot be left without one, whether new or being edited
    expect((await app.call('saveCompetition', [base], admin)).error).toMatch(/Add the photo/)
    expect((await app.call('saveCompetition', [{ ...base, image: '' }, made.id], admin)).error).toMatch(/Add the photo/)
  })
})
