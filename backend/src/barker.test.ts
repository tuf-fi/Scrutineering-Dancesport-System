import type { BarkerBoard } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// The barker has a staff account and one screen: the rounds on the floor and the next one, with back numbers and names

let app: TestApp
let barker = ''

beforeAll(async () => {
  app = await startTestApp()
  app.db.insert(t.staffUsers).values({ id: 'barker-1', name: 'Barker One', username: 'barker@sample.example', role: 'barker', passwordHash: hashPassword('pw-barker'), disabled: false }).run()
  barker = await app.signIn.staff('barker', 'pw-barker')
})
afterAll(() => app.close())

describe('barker', () => {
  it('signs in as a staff member and reads the board', async () => {
    expect(await app.me(barker)).toMatchObject({ role: 'barker', name: 'Barker One' })
    const board = await app.ok<BarkerBoard>('getBarkerBoard', [], barker)
    expect(board.competitionName).toEqual(expect.any(String))
    expect(Array.isArray(board.ongoing)).toBe(true)
    for (const event of [...board.ongoing, ...(board.next ? [board.next] : [])]) {
      for (const heat of event.heats) for (const c of heat.competitors) expect(c).toEqual({ backNumber: expect.toSatisfy((n: unknown) => n === null || typeof n === 'number'), names: expect.any(Array) })
    }
  })

  it('is kept out of everything but its own board', async () => {
    expect((await app.call('getBarkerBoard', [])).status).toBe(401)
    expect((await app.call('getAnnouncements', [], barker)).status).toBe(403)
    expect((await app.call('getCompetitorRows', [], barker)).status).toBe(403)
    expect((await app.call('saveEvent', ['x', {}], barker)).status).toBe(403)
  })

  it('can be created by the admin', async () => {
    const admin = await app.signIn.staff('admin')
    const made = await app.ok<{ user: { role: string } }>('createStaffUser', [{ name: 'Second Barker', username: 'barker2@test.example', role: 'barker', photo: 'data:image/png;base64,iVBORw0KGgo=' }], admin)
    expect(made.user.role).toBe('barker')
  })
})
