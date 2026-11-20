import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
let admin: string
let secretariat: string

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, role] of [['s-admin', 'admin'], ['s-sec', 'secretariat']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: role, username: `${role}@sample.example`, role, passwordHash: hashPassword(`pw-${role}`), disabled: false }).run()
  }
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
})
afterAll(() => app.close())

describe('the audit log of one account', () => {
  it('lists only that account, and still finds it when others have filled the log', async () => {
    await app.ok('saveTeam', [{ name: 'Quiet Team', contactName: '', contactEmail: '', contactPhone: '' }], secretariat)
    for (let i = 0; i < 520; i++) {
      app.db.insert(t.auditLog).values({ id: `noise-${i}`, actorId: 's-admin', action: 'Noise', target: `n${i}`, at: new Date(Date.now() + 60_000 + i).toISOString() } as typeof t.auditLog.$inferInsert).run()
    }
    const all = await app.ok<Array<{ actorId: string }>>('getAuditLog', [], admin)
    expect(all.some((e) => e.actorId === 's-sec')).toBe(false)
    const mine = await app.ok<Array<{ actorId: string; action: string }>>('getAuditLog', ['s-sec'], admin)
    expect(mine.length).toBeGreaterThan(0)
    expect(mine.every((e) => e.actorId === 's-sec')).toBe(true)
  })
})
