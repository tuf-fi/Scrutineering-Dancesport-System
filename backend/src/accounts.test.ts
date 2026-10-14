import type { PaymentSettings } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SAMPLE_PASSWORD } from './db/seed.ts'
import { readPaymentSettings, writePaymentSettings } from './paymentSettings.ts'
import { removeOldReceipts } from './services/accounts.ts'
import { applySnapshot } from './sync/apply.ts'
import { buildSnapshot } from './sync/snapshot.ts'
import { startTestApp, type TestApp } from './testing.ts'

// The online server: fees, payment details, club accounts and what is kept about people

let cloud: TestApp
let venue: TestApp
let admin = ''
let secretariat = ''
let club = ''

const clubEmail = () => (cloud.sqlite.prepare('select contact_email as e from clubs where password_hash is not null order by name limit 1').get() as { e: string }).e
const clubId = () => (cloud.sqlite.prepare('select id from clubs where contact_email = ?').get(clubEmail()) as { id: string }).id

beforeAll(async () => {
  cloud = await startTestApp({ env: { MODE: 'cloud' } })
  venue = await startTestApp()
  admin = await cloud.signIn.staff('admin')
  secretariat = await cloud.signIn.staff('secretariat')
  club = await cloud.signIn.club(clubEmail())
})
afterAll(async () => {
  await cloud.close()
  await venue.close()
})

describe('fees and payment details', () => {
  const next: PaymentSettings = {
    fees: { solo: 600, couple: 900 },
    methods: [{ name: 'GCash', accountName: 'Bicol Dance Org', number: '0917 123 4567' }],
  }

  it('are saved by an admin, shown to clubs, and checked', async () => {
    expect((await cloud.ok<PaymentSettings>('getPaymentSettings', [], admin)).fees).toEqual({ solo: 500, couple: 800 })
    expect(await cloud.ok('savePaymentSettings', [next], admin)).toEqual(next)
    expect(await cloud.ok('getPaymentMethods', [], club)).toEqual(next.methods)

    expect((await cloud.call('savePaymentSettings', [{ fees: { solo: -1, couple: 900 }, methods: [] }], admin)).status).toBe(400)
    expect((await cloud.call('savePaymentSettings', [{ fees: next.fees, methods: [{ name: 'GCash', accountName: '', number: '1' }] }], admin)).status).toBe(400)
    expect((await cloud.call('savePaymentSettings', [next], secretariat)).status).toBe(403)
    expect((await cloud.call('savePaymentSettings', [next], club)).status).toBe(403)
    expect((await cloud.call('getPaymentSettings', [], club)).status).toBe(403)
  })

  it('price new entries at the saved fees, and close entries while none are set', async () => {
    const dancers = await cloud.ok<Array<{ id: string }>>('getClubDancers', [], club)
    const options = await cloud.ok<Array<{ fee: number }>>('getEntryOptions', [dancers[0]!.id], club)
    expect(options.length).toBeGreaterThan(0)
    expect(options.every((o) => o.fee === 600 || o.fee === 900)).toBe(true)

    cloud.sqlite.prepare("delete from settings where key = 'payment_settings'").run()
    const closed = await cloud.call('registerClubEntries', [dancers[0]!.id, []], club)
    expect(closed.status).toBe(409)
    expect(closed.error).toMatch(/not set the entry fees/)
    writePaymentSettings(cloud.sqlite, next)
  })

  it('reach the venue with the download, since late entries there need the fees', async () => {
    const sent: PaymentSettings = { fees: { solo: 700, couple: 1000 }, methods: [] }
    writePaymentSettings(cloud.sqlite, sent)
    const competition = (cloud.sqlite.prepare('select id from competitions limit 1').get() as { id: string }).id
    venue.sqlite.prepare("delete from settings where key = 'payment_settings'").run()
    applySnapshot(venue.sqlite, buildSnapshot(cloud.sqlite, competition))
    expect(readPaymentSettings(venue.sqlite)).toEqual(sent)
    writePaymentSettings(cloud.sqlite, next)
  })

  it('are not set by a venue, which only receives them', async () => {
    const venueAdmin = await venue.signIn.staff('admin')
    expect((await venue.call('savePaymentSettings', [next], venueAdmin)).status).toBe(404)
  })
})

describe('club accounts', () => {
  it('need agreement to the privacy notice, which is recorded', async () => {
    const body = { name: 'Privacy Club', contactName: 'Coach', contactEmail: 'p@club.example', contactPhone: '1', password: 'long-enough-1' }
    const refused = await cloud.app.inject({ method: 'POST', url: '/api/auth/club-signup', payload: body })
    expect(refused.statusCode).toBe(400)
    expect(refused.body).toMatch(/privacy notice/)
    const accepted = await cloud.app.inject({ method: 'POST', url: '/api/auth/club-signup', payload: { ...body, agreed: true } })
    expect(accepted.statusCode).toBe(200)
    expect((cloud.sqlite.prepare("select consent_at as c from clubs where contact_email = 'p@club.example'").get() as { c: string }).c).toBeTruthy()
  })

  it('let a club change its own password, only knowing the old one', async () => {
    expect((await cloud.call('changeClubPassword', ['wrong-one', 'new-password-1'], club)).status).toBe(403)
    expect((await cloud.call('changeClubPassword', [SAMPLE_PASSWORD, 'short'], club)).status).toBe(400)
    const email = clubEmail()
    await cloud.ok('changeClubPassword', [SAMPLE_PASSWORD, 'new-password-1'], club)
    await expect(cloud.signIn.club(email, SAMPLE_PASSWORD)).rejects.toThrow()
    club = await cloud.signIn.club(email, 'new-password-1')
  })

  it('let an admin give a forgetful club a temporary password', async () => {
    const { tempPassword } = await cloud.ok<{ tempPassword: string }>('resetClubPassword', [clubId()], admin)
    expect(tempPassword.length).toBeGreaterThanOrEqual(8)
    club = await cloud.signIn.club(clubEmail(), tempPassword)
    expect((await cloud.call('resetClubPassword', [clubId()], secretariat)).status).toBe(403)
    expect(cloud.sqlite.prepare("select count(*) as n from audit_log where action = 'Reset a club password'").get()).toEqual({ n: 1 })
  })
})

describe('what is kept about people', () => {
  it('erases a club account but keeps its name for the published results', async () => {
    const row = cloud.sqlite.prepare("select id from clubs where contact_email = 'p@club.example'").get() as { id: string }
    await cloud.ok('eraseClubAccount', [row.id], admin)
    const after = cloud.sqlite.prepare('select * from clubs where id = ?').get(row.id) as Record<string, unknown>
    expect(after).toMatchObject({ name: 'Privacy Club', contact_name: 'Removed', contact_phone: '', password_hash: null, consent_at: null })
    expect(String(after.contact_email)).toMatch(/@removed\.invalid$/)
    expect((await cloud.call('eraseClubAccount', [row.id], secretariat)).status).toBe(403)
  })

  it('refuses to erase a club while a payment of theirs is waiting to be checked', async () => {
    const waiting = cloud.sqlite.prepare("select club_id as c from payments where status = 'for_checking' limit 1").get() as { c: string }
    expect((await cloud.call('eraseClubAccount', [waiting.c], admin)).status).toBe(409)
  })

  it('removes payment proofs after the retention time, and not before', async () => {
    const payment = cloud.sqlite.prepare("select id, competition_id as c from payments where status = 'for_checking' limit 1").get() as { id: string; c: string }
    const proof = () => cloud.sqlite.prepare('select receipt from payments where id = ?').get(payment.id) as { receipt: string | null }
    const dated = (daysAgo: number) =>
      cloud.sqlite.prepare('update competitions set date = ? where id = ?').run(new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10), payment.c)
    cloud.sqlite.prepare("update payments set receipt = 'data:image/png;base64,AAAA' where id = ?").run(payment.id)

    dated(30)
    removeOldReceipts(cloud, 'test')
    expect(proof().receipt).not.toBeNull()

    dated(120)
    expect(await cloud.ok<number>('clearOldReceipts', [], admin)).toBeGreaterThan(0)
    expect(proof().receipt).toBeNull()
  })

  it('shows a payment proof only to admins and the club that sent it', async () => {
    const payment = cloud.sqlite.prepare("select id from payments where status = 'for_checking' limit 1").get() as { id: string }
    cloud.sqlite.prepare("update payments set receipt = 'data:image/png;base64,AAAA' where id = ?").run(payment.id)
    const proofSeenBy = async (cookie: string) =>
      (await cloud.ok<Array<{ id: string; receiptUrl: string | null }>>('getPaymentDetails', [], cookie)).find((p) => p.id === payment.id)?.receiptUrl ?? null
    expect(await proofSeenBy(admin)).toBe('data:image/png;base64,AAAA')
    expect(await proofSeenBy(secretariat)).toBeNull()
    expect((await cloud.call('getPaymentDetails', [], club)).status).toBe(403)
    expect((await cloud.call('getPaymentDetails', [])).status).toBe(401)
  })
})

describe('only paid entries dance', () => {
  it('refuses to start a round while an entry of the event is unpaid, until it is paid', async () => {
    const scrutineer = await venue.signIn.staff('scrutineer')
    const target = venue.sqlite
      .prepare(
        `SELECT r.id AS roundId, e.id AS entryId, e.payment_id AS paymentId FROM rounds r JOIN entries e ON e.event_id = r.event_id
         WHERE r.status = 'pending' AND r.position = 1 AND e.scratched = 0 AND e.payment_id IS NOT NULL LIMIT 1`,
      )
      .get() as { roundId: string; entryId: string; paymentId: string } | undefined
    expect(target, 'the sample competition has a round waiting to start').toBeDefined()
    venue.sqlite.prepare("update payments set status = 'unpaid' where id = ?").run(target!.paymentId)
    venue.sqlite.prepare('update competitions set floor_round_id = null').run()

    const refused = await venue.call('startRound', [target!.roundId], scrutineer)
    expect(refused.status).toBe(409)
    expect(refused.error).toMatch(/not been paid/)

    venue.sqlite.prepare("update payments set status = 'paid_at_venue' where status in ('unpaid', 'for_checking', 'rejected')").run()
    expect((await venue.call('startRound', [target!.roundId], scrutineer)).error ?? '').not.toMatch(/not been paid/)
  })
})
