import type { MessengerLink } from '@bis/shared'
import { createHmac } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { linkCode } from './messenger.ts'
import { startTestApp, type TestApp } from './testing.ts'

const SECRET = 'app-secret-for-tests'
const ENV = {
  MODE: 'cloud',
  MESSENGER_PAGE_TOKEN: 'page-token',
  MESSENGER_PAGE_USERNAME: 'BicolDanceSport',
  MESSENGER_VERIFY_TOKEN: 'verify-me',
  MESSENGER_APP_SECRET: SECRET,
}

let app: TestApp
let admin = ''
let club = ''
let clubId = ''
// The code is signed with the server's cookie secret, which the test app leaves at its default
const loadedConfig = () => ({ cookieSecret: 'change-me-before-the-competition' }) as never
const graph = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()

const sentTexts = () => graph.mock.calls.map(([, init]) => (JSON.parse(String(init?.body)) as { recipient: { id: string }; message: { text: string } }))

async function webhook(body: object, signature?: string) {
  const raw = JSON.stringify(body)
  const header = signature ?? `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}`
  return app.app.inject({ method: 'POST', url: '/api/messenger/webhook', payload: raw, headers: { 'content-type': 'application/json', 'x-hub-signature-256': header } })
}
const opened = (psid: string, ref: string) => ({ entry: [{ messaging: [{ sender: { id: psid }, referral: { ref } }] }] })

beforeAll(async () => {
  app = await startTestApp({ env: ENV })
  admin = await app.signIn.staff('admin')
  const row = app.sqlite.prepare("select c.id, c.contact_email as e from clubs c join payments p on p.club_id = c.id where p.status = 'for_checking' limit 1").get() as { id: string; e: string }
  clubId = row.id
  club = await app.signIn.club(row.e)
})
afterAll(() => app.close())
afterEach(() => graph.mockClear())

beforeAll(() => {
  graph.mockImplementation(async () => new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', graph)
})
afterAll(() => vi.unstubAllGlobals())

describe('linking a club to Messenger', () => {
  it('offers a link that carries a signed code for this club', async () => {
    const link = await app.ok<MessengerLink>('getMessengerLink', [], club)
    expect(link).toMatchObject({ available: true, linked: false })
    expect(link.url).toContain('https://m.me/BicolDanceSport?ref=')
    expect(decodeURIComponent(link.url!.split('ref=')[1]!)).toContain(clubId)
  })

  it('answers Facebook\'s check only with the right token', async () => {
    const good = await app.app.inject({ method: 'GET', url: '/api/messenger/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=1234' })
    expect(good.statusCode).toBe(200)
    expect(good.body).toBe('1234')
    expect((await app.app.inject({ method: 'GET', url: '/api/messenger/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1' })).statusCode).toBe(403)
  })

  it('refuses calls that are not signed by Facebook', async () => {
    const ref = linkCode(loadedConfig(), clubId)
    expect((await webhook(opened('psid-1', ref), 'sha256=00')).statusCode).toBe(403)
    expect((await app.app.inject({ method: 'POST', url: '/api/messenger/webhook', payload: '{}', headers: { 'content-type': 'application/json' } })).statusCode).toBe(403)
    expect(app.sqlite.prepare('select messenger_id as m from clubs where id = ?').get(clubId)).toEqual({ m: null })
  })

  it('ignores a forged or someone else\'s code', async () => {
    const forged = `club.${clubId}.${'0'.repeat(24)}`
    expect((await webhook(opened('psid-evil', forged))).statusCode).toBe(200)
    expect(app.sqlite.prepare('select messenger_id as m from clubs where id = ?').get(clubId)).toEqual({ m: null })
    expect(graph).not.toHaveBeenCalled()
  })

  it('links the club when it opens its own link, and says so on Messenger', async () => {
    const link = await app.ok<MessengerLink>('getMessengerLink', [], club)
    const ref = decodeURIComponent(link.url!.split('ref=')[1]!)
    expect((await webhook(opened('psid-1', ref))).statusCode).toBe(200)
    expect(app.sqlite.prepare('select messenger_id as m from clubs where id = ?').get(clubId)).toEqual({ m: 'psid-1' })
    await vi.waitFor(() => expect(graph).toHaveBeenCalled())
    expect(sentTexts()[0]).toMatchObject({ recipient: { id: 'psid-1' } })
    expect(sentTexts()[0]!.message.text).toMatch(/is connected/)
    expect(await app.ok<MessengerLink>('getMessengerLink', [], club)).toMatchObject({ linked: true, url: null })
  })
})

describe('payment decisions', () => {
  const waiting = () => app.sqlite.prepare("select id from payments where status = 'for_checking' and club_id = ? limit 1").get(clubId) as { id: string } | undefined

  it('are sent to a linked club when approved', async () => {
    const payment = waiting()!
    await app.ok('approvePayment', [payment.id], admin)
    await vi.waitFor(() => expect(graph).toHaveBeenCalledTimes(1))
    expect(sentTexts()[0]).toMatchObject({ recipient: { id: 'psid-1' } })
    expect(sentTexts()[0]!.message.text).toMatch(/was approved/)
    const [url, init] = graph.mock.calls[0]!
    expect(String(url)).toContain('graph.facebook.com')
    expect(JSON.parse(String(init?.body))).toMatchObject({ messaging_type: 'MESSAGE_TAG', tag: 'CONFIRMED_EVENT_UPDATE' })
  })

  it('carry the reason when rejected, and a failed message never undoes the decision', async () => {
    app.sqlite.prepare("update payments set status = 'for_checking' where club_id = ? and id = (select id from payments where club_id = ? limit 1)").run(clubId, clubId)
    const payment = waiting()!
    graph.mockRejectedValueOnce(new Error('network down'))
    await app.ok('rejectPayment', [payment.id, 'Amount does not match'], admin)
    await vi.waitFor(() => expect(graph).toHaveBeenCalledTimes(1))
    expect(app.sqlite.prepare('select status from payments where id = ?').get(payment.id)).toEqual({ status: 'rejected' })
  })

  it('say nothing to a club that has not linked', async () => {
    app.sqlite.prepare('update clubs set messenger_id = null where id = ?').run(clubId)
    app.sqlite.prepare("update payments set status = 'for_checking' where id = (select id from payments where club_id = ? limit 1)").run(clubId)
    await app.ok('approvePayment', [waiting()!.id], admin)
    await new Promise((r) => setTimeout(r, 50))
    expect(graph).not.toHaveBeenCalled()
  })
})

describe('turning it off', () => {
  it('lets a club unlink', async () => {
    app.sqlite.prepare("update clubs set messenger_id = 'psid-1' where id = ?").run(clubId)
    await app.ok('unlinkMessenger', [], club)
    expect(await app.ok<MessengerLink>('getMessengerLink', [], club)).toMatchObject({ linked: false })
  })

  it('is unavailable without a Page, and has no webhook', async () => {
    const plain = await startTestApp({ env: { MODE: 'cloud' } })
    const email = (plain.sqlite.prepare('select contact_email as e from clubs where password_hash is not null limit 1').get() as { e: string }).e
    const cookie = await plain.signIn.club(email)
    expect(await plain.ok<MessengerLink>('getMessengerLink', [], cookie)).toEqual({ available: false, linked: false, url: null })
    expect((await plain.app.inject({ method: 'GET', url: '/api/messenger/webhook' })).statusCode).toBe(404)
    await plain.close()
  })
})

