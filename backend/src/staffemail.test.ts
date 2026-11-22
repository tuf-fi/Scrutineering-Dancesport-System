import type { StaffUser } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAdmin } from './auth/bootstrap.ts'
import { TEST_PHOTO, startTestApp, type TestApp } from './testing.ts'

let app: TestApp
let admin: string

beforeAll(async () => {
  app = await startTestApp({ env: { STAFF_EMAIL_DOMAIN: 'boss2026.com' } })
  admin = await app.signIn.staff('admin')
})
afterAll(() => app.close())

const create = (role: string, username?: string) =>
  app.call<{ user: StaffUser }>('createStaffUser', [{ name: 'Test Person', username, role, photo: TEST_PHOTO }], admin)

describe('staff emails follow the role', () => {
  it('shows the domain to the screens', async () => {
    expect((await app.ok<{ staffEmailDomain: string }>('getSiteSettings', [])).staffEmailDomain).toBe('boss2026.com')
  })

  it('fills the email in from the role when none is typed', async () => {
    const reply = await create('barker')
    expect(reply.status).toBe(200)
    expect(reply.data.user.username).toBe('barker@boss2026.com')
  })

  it('refuses another email, and a second account for the same role', async () => {
    expect((await create('compere', 'someone@boss2026.com')).error).toBe('The email of a compere is compere@boss2026.com.')
    expect((await create('barker')).status).toBe(409)
  })

  it('changes the email with the role, unless that one is taken', async () => {
    const barker = (await app.ok<StaffUser[]>('getStaffUsers', [], admin)).find((u) => u.username === 'barker@boss2026.com')!
    const moved = await app.ok<StaffUser>('updateStaffUser', [barker.id, { name: barker.name, role: 'compere' }], admin)
    expect(moved.username).toBe('compere@boss2026.com')
    expect((await app.call('updateStaffUser', [moved.id, { name: moved.name, role: 'scrutineer' }], admin)).status).toBe(200)
    // The compere address is free again, so a new compere takes it and the first account cannot go back
    expect((await create('compere')).status).toBe(200)
    expect((await app.call('updateStaffUser', [moved.id, { name: moved.name, role: 'compere' }], admin)).status).toBe(409)
  })

  it('holds the first admin to admin@boss2026.com too', () => {
    const { db } = app
    expect(() => createAdmin(db, { username: 'me@example.com', name: 'Me', staffEmailDomain: 'boss2026.com' })).toThrow('admin@boss2026.com')
  })
})

describe('without the setting', () => {
  it('leaves the email free, as in development', async () => {
    const dev = await startTestApp()
    const cookie = await dev.signIn.staff('admin')
    const reply = await dev.call<{ user: StaffUser }>('createStaffUser', [{ name: 'Free Person', username: 'free@example.com', role: 'compere', photo: TEST_PHOTO }], cookie)
    expect(reply.data.user.username).toBe('free@example.com')
    await dev.close()
  })
})
