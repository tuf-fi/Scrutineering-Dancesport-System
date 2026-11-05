import type { PaymentSettings } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// Fees and payment details

let cloud: TestApp
// A second server on its own database, for the test that starts a round and changes payments
let floor: TestApp
let admin = ''
let secretariat = ''

beforeAll(async () => {
  cloud = await startTestApp()
  floor = await startTestApp()
  admin = await cloud.signIn.staff('admin')
  secretariat = await cloud.signIn.staff('secretariat')
})
afterAll(async () => {
  await cloud.close()
  await floor.close()
})

describe('fees and payment details', () => {
  const next: PaymentSettings = {
    fees: { solo: 600, couple: 900 },
    methods: [{ name: 'GCash', accountName: 'Bicol Dance Org', number: '0917 123 4567' }],
  }

  it('are saved by an admin, shown to the secretariat, and checked', async () => {
    expect((await cloud.ok<PaymentSettings>('getPaymentSettings', [], admin)).fees).toEqual({ solo: 500, couple: 800 })
    expect(await cloud.ok<PaymentSettings>('savePaymentSettings', [next], admin)).toMatchObject(next)
    expect((await cloud.ok<PaymentSettings>('getPaymentSettings', [], secretariat)).methods).toEqual(next.methods)

    expect((await cloud.call('savePaymentSettings', [{ fees: { solo: -1, couple: 900 }, methods: [] }], admin)).status).toBe(400)
    expect((await cloud.call('savePaymentSettings', [{ fees: next.fees, methods: [{ name: 'GCash', accountName: '', number: '1' }] }], admin)).status).toBe(400)
    expect((await cloud.call('savePaymentSettings', [next], secretariat)).status).toBe(403)
    expect((await cloud.call('getPaymentSettings', [])).status).toBe(401)
  })

  it('close late entries while no flat fees are set', async () => {
    cloud.sqlite.prepare("delete from settings where key = 'payment_settings'").run()
    const events = await cloud.ok<Array<{ id: string }>>('getEvents', [])
    const dancer = (await cloud.ok<Array<{ id: string }>>('getCompetitorRows', [], secretariat))[0]!
    const closed = await cloud.call('createLateEntry', [{ competitorId: dancer.id, eventId: events[0]!.id, paidInCash: true }], secretariat)
    expect(closed.status).toBe(409)
    expect(closed.error).toMatch(/not set the entry fees/)
  })
})

describe('only paid entries dance', () => {
  it('refuses to start a round while an entry of the event is unpaid, until it is paid', async () => {
    const scrutineer = await floor.signIn.staff('scrutineer')
    const target = floor.sqlite
      .prepare(
        `SELECT r.id AS roundId, e.id AS entryId, e.payment_id AS paymentId FROM rounds r JOIN entries e ON e.event_id = r.event_id
         WHERE r.status = 'pending' AND r.position = 1 AND e.scratched = 0 AND e.payment_id IS NOT NULL LIMIT 1`,
      )
      .get() as { roundId: string; entryId: string; paymentId: string } | undefined
    expect(target, 'the sample competition has a round waiting to start').toBeDefined()
    floor.sqlite.prepare("update payments set status = 'unpaid' where id = ?").run(target!.paymentId)
    floor.sqlite.prepare('update competitions set floor_round_id = null').run()

    const refused = await floor.call('startRound', [target!.roundId], scrutineer)
    expect(refused.status).toBe(409)
    expect(refused.error).toMatch(/not been paid/)

    floor.sqlite.prepare("update payments set status = 'paid_at_venue' where status in ('unpaid', 'for_checking', 'rejected')").run()
    expect((await floor.call('startRound', [target!.roundId], scrutineer)).error ?? '').not.toMatch(/not been paid/)
  })
})

describe('a staff member changing their own account', () => {
  it('changes the password only with the current one, and signs in with the new one', async () => {
    const mine = await cloud.signIn.staff('scrutineer')
    expect((await cloud.call('changeMyStaffPassword', ['wrong-password', 'a-long-password1'], mine)).error).toMatch(/current password/)
    expect((await cloud.call('changeMyStaffPassword', ['bis2026', 'short'], mine)).error).toMatch(/at least 8/)
    expect((await cloud.call('changeMyStaffPassword', ['bis2026', 'bis2026'], mine)).status).toBe(400)
    await cloud.ok('changeMyStaffPassword', ['bis2026', 'a-long-password1'], mine)
    await expect(cloud.signIn.staff('scrutineer', 'bis2026')).rejects.toThrow()
    expect(await cloud.signIn.staff('scrutineer', 'a-long-password1')).toContain('=')
  })

  it('changes only their own name', async () => {
    const mine = await cloud.signIn.staff('compere')
    expect((await cloud.call('saveMyStaffName', ['  '], mine)).status).toBe(400)
    const saved = await cloud.ok<{ name: string; username: string }>('saveMyStaffName', ['  Mina   Cruz '], mine)
    expect(saved).toMatchObject({ name: 'Mina Cruz', username: 'compere@sample.example' })
    expect((await cloud.call('changeMyStaffPassword', ['x', 'y'])).status).toBe(401)
  })
})
