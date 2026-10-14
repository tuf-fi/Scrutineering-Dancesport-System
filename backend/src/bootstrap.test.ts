import { afterEach, describe, expect, it } from 'vitest'
import { createAdmin } from './auth/bootstrap.ts'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
afterEach(() => app.close())

describe('the first admin of a new database', () => {
  it('can be created on an empty database and then signs in', async () => {
    app = await startTestApp({ seed: false })
    expect(app.sqlite.prepare('select count(*) as n from staff_users').get()).toEqual({ n: 0 })
    const admin = createAdmin(app.db, { username: ' Amelia ', name: 'Amelia Rosales' })
    expect(admin.username).toBe('amelia')
    expect(admin.password).toHaveLength(10)
    const cookie = await app.signIn.staff('amelia', admin.password)
    expect(await app.me(cookie)).toMatchObject({ role: 'admin', name: 'Amelia Rosales' })
    // The admin can then set everything else up from the screens
    expect((await app.call('getStaffUsers', [], cookie)).data).toHaveLength(1)
    expect(app.sqlite.prepare("select count(*) as n from audit_log where action = 'Created the first admin'").get()).toEqual({ n: 1 })
  })

  it('has the default points table ready on an empty database', async () => {
    app = await startTestApp({ seed: false })
    const table = await app.call<Array<{ place: number | null; points: number }>>('getPointsTable', [])
    expect(table.data.map((r) => r.points)).toEqual([10, 8, 6, 5, 4, 3, 2, 1])
    expect(table.data.at(-1)!.place).toBeNull()
  })

  it('uses a chosen password, and refuses a short one, a blank name and a repeated username', async () => {
    app = await startTestApp({ seed: false })
    expect(createAdmin(app.db, { username: 'a', name: 'A', password: 'long-enough-1' }).password).toBe('long-enough-1')
    expect(() => createAdmin(app.db, { username: 'b', name: 'B', password: 'short' })).toThrow(/at least 8/)
    expect(() => createAdmin(app.db, { username: 'a', name: 'Other' })).toThrow(/already taken/)
    expect(() => createAdmin(app.db, { username: 'c', name: '  ' })).toThrow(/username and a name/)
  })
})
