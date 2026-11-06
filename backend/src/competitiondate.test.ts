import type { Competition } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'
import { eq } from 'drizzle-orm'

// A finished competition cannot be added, and a competition cannot be moved into the past

let app: TestApp
let admin = ''
const base = { name: 'Date Cup', venue: 'Gym', organizer: 'Org', image: 'data:image/png;base64,iVBORw0KGgo=' }
const day = (offset: number) => new Date(Date.now() + 8 * 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10)

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
})
afterAll(() => app.close())

describe('competition dates', () => {
  it('refuses a past date when adding, but accepts today and later', async () => {
    const refused = await app.call('saveCompetition', [{ ...base, date: day(-1) }], admin)
    expect(refused.status).toBe(400)
    expect(refused.error).toMatch(/finished competition cannot be added/)
    await app.ok('saveCompetition', [{ ...base, name: 'Today Cup', date: day(0) }], admin)
    await app.ok('saveCompetition', [{ ...base, name: 'Later Cup', date: day(30) }], admin)
  })

  it('refuses moving a competition into the past, yet lets an already past one keep its date', async () => {
    const made = await app.ok<Competition>('saveCompetition', [{ ...base, name: 'Moving Cup', date: day(10) }], admin)
    expect((await app.call('saveCompetition', [{ ...base, name: 'Moving Cup', date: day(-3) }, made.id], admin)).status).toBe(400)

    // A competition that is already over (an old one, or one held earlier) can still have its other details corrected
    app.db.update(t.competitions).set({ date: day(-20) }).where(eq(t.competitions.id, made.id)).run()
    const corrected = await app.ok<Competition>('saveCompetition', [{ ...base, name: 'Moving Cup 2', date: day(-20) }, made.id], admin)
    expect(corrected.name).toBe('Moving Cup 2')
  })
})
