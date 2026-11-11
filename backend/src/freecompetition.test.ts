import type { Competition, RegistrationQuote, RegistrationResult } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// A competition can be free: no fee, no membership and no payment or screenshot to enter

let app: TestApp
let admin = ''
let secretariat = ''
let freeEvent = ''
let paidEvent = ''
let competitorId = ''
const image = 'data:image/png;base64,iVBORw0KGgo='
const event = { number: 1, ageGroup: 'juvenile_1', class: 'C', discipline: 'latin', dances: ['samba'], isSolo: true }

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  for (const [id, username, role] of [['s1', 'admin', 'admin'], ['s2', 'secretariat', 'secretariat']] as const) {
    app.db.insert(t.staffUsers).values({ id, name: username, username: `${username}@sample.example`, role, passwordHash: hashPassword('pw-' + username), disabled: false }).run()
  }
  admin = await app.signIn.staff('admin', 'pw-admin')
  secretariat = await app.signIn.staff('secretariat', 'pw-secretariat')
  app.db.insert(t.teams).values({ id: 'team-1', name: 'Naga Dancers', contactName: 'Coach', contactEmail: 'c@test.example', contactPhone: '1' }).run()
  const free = await app.ok<Competition>('saveCompetition', [{ name: 'Free Cup', date: '2099-07-01', venue: 'Gym', organizer: 'Org', image, paymentRequired: false }], admin)
  const paid = await app.ok<Competition>('saveCompetition', [{ name: 'Paid Cup', date: '2099-08-01', venue: 'Gym', organizer: 'Org', image }], admin)
  freeEvent = (await app.ok<{ id: string }>('saveEvent', [free.id, event], secretariat)).id
  paidEvent = (await app.ok<{ id: string }>('saveEvent', [paid.id, { ...event, number: 2 }], secretariat)).id
  competitorId = (
    await app.ok<{ id: string }>('createCompetitor', [{ names: ['Ana Cruz'], teamId: 'team-1', details: { province: 'Camarines Sur', coachId: null, dancers: [{ birthDate: '2017-03-02', address: 'Naga', email: 'ana@test.example', phone: '0917' }], beginner: false, memberYear: null } }], secretariat)
  ).id
})
afterAll(() => app.close())

describe('a competition that needs no payment', () => {
  it('needs payment unless it is turned off, and keeps the choice when edited', async () => {
    const list = await app.ok<Competition[]>('getCompetitions', [])
    expect(list.find((c) => c.name === 'Paid Cup')?.paymentRequired).toBe(true)
    const free = list.find((c) => c.name === 'Free Cup')!
    expect(free.paymentRequired).toBe(false)
    const edited = await app.ok<Competition>('saveCompetition', [{ name: 'Free Cup 2', date: '2099-07-01', venue: 'Gym', organizer: 'Org' }, free.id], admin)
    expect(edited.paymentRequired).toBe(false)
  })

  it('charges nothing, and takes the entry with no payment method or payment record', async () => {
    const quote = await app.ok<RegistrationQuote>('quoteRegistration', [competitorId, [freeEvent]], secretariat)
    expect(quote.total).toBe(0)
    expect(quote.lines).toEqual([])
    const result = await app.ok<RegistrationResult>('registerCompetitor', [{ competitorId, eventIds: [freeEvent] }], secretariat)
    expect(result.total).toBe(0)
    expect(app.db.select().from(t.payments).all()).toHaveLength(0)
    expect(app.db.select().from(t.entries).all().map((e) => e.paymentId)).toEqual([null])
  })

  it('still asks how a paid competition was paid', async () => {
    const refused = await app.call('registerCompetitor', [{ competitorId, eventIds: [paidEvent] }], secretariat)
    expect(refused.status).toBe(400)
    expect(refused.error).toMatch(/how it was paid/)
  })
})
