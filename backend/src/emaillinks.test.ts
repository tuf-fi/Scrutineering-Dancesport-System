import type { AthletePage, MemberAccount } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import * as t from './db/schema.ts'
import { brevoMailer } from './mail.ts'
import { startTestApp, type TestApp } from './testing.ts'

// Confirming an email address by a link, and forgetting a password, for athletes, coaches and teams

let app: TestApp

beforeAll(async () => {
  app = await startTestApp({ seed: false, mail: true })
})
afterAll(() => app.close())

const post = (url: string, payload: object) => app.app.inject({ method: 'POST', url, payload })
const tokenIn = (text: string) => /token=([\w-]+)/.exec(text)![1]!
const lastMail = () => app.outbox[app.outbox.length - 1]!

describe('confirming an email address', () => {
  let athlete = ''

  it('sends a link when an athlete signs up, and the account starts unconfirmed', async () => {
    athlete = await app.signIn.athleteSignUp('Ana Cruz', 'ana@test.example', 'a-long-password')
    expect(lastMail()).toMatchObject({ to: 'ana@test.example', subject: 'Confirm your email address' })
    expect(lastMail().text).toContain('/verify-email?token=')
    expect((await app.ok<AthletePage>('getMyAthlete', [], athlete)).profile.emailVerified).toBe(false)
  })

  it('keeps an unconfirmed account from linking to a record, until the link is used', async () => {
    app.db.insert(t.athleteRecords).values({ id: 'r1', name: 'Ana Cruz' }).run()
    expect((await app.call('claimAthleteRecord', ['r1'], athlete)).status).toBe(403)
    expect((await post('/api/auth/verify', { token: 'made-up' })).statusCode).toBe(400)

    const link = tokenIn(lastMail().text)
    expect((await post('/api/auth/verify', { token: link })).statusCode).toBe(200)
    expect((await app.ok<AthletePage>('getMyAthlete', [], athlete)).profile.emailVerified).toBe(true)
    await app.ok('claimAthleteRecord', ['r1'], athlete)
    // The link works once
    expect((await post('/api/auth/verify', { token: link })).statusCode).toBe(400)
  })

  it('sends it again on request, replacing the first link, and refuses once confirmed', async () => {
    const ben = await app.signIn.memberSignUp('coach', 'Ben Reyes', 'ben@test.example', 'a-long-password')
    const first = tokenIn(lastMail().text)
    await app.ok('resendVerification', [], ben)
    const second = tokenIn(lastMail().text)
    expect(second).not.toBe(first)
    expect((await post('/api/auth/verify', { token: first })).statusCode).toBe(400)
    expect((await post('/api/auth/verify', { token: second })).statusCode).toBe(200)
    expect((await app.call('resendVerification', [], ben)).status).toBe(409)
    expect((await app.ok<MemberAccount>('getMyMember', [], ben)).emailVerified).toBe(true)
  })

  it('refuses a link that has expired', async () => {
    await app.signIn.memberSignUp('team', 'Naga Dancers', 'naga@test.example', 'a-long-password')
    app.db.update(t.emailTokens).set({ expiresAt: new Date(Date.now() - 1000).toISOString() }).run()
    expect((await post('/api/auth/verify', { token: tokenIn(lastMail().text) })).body).toContain('expired')
  })
})

describe('forgot password', () => {
  it('sends a reset link that sets a new password once, and signs the account out everywhere', async () => {
    const dana = await app.signIn.athleteSignUp('Dana Lopez', 'dana@test.example', 'a-long-password')
    const before = app.outbox.length
    expect((await post('/api/auth/forgot', { role: 'athlete', email: 'Dana@Test.example' })).statusCode).toBe(200)
    expect(app.outbox).toHaveLength(before + 1)
    expect(lastMail()).toMatchObject({ to: 'dana@test.example', subject: 'Reset your password' })

    const token = tokenIn(lastMail().text)
    expect((await post('/api/auth/reset', { token, password: 'short' })).statusCode).toBe(400)
    expect((await post('/api/auth/reset', { token, password: 'a-new-long-password' })).statusCode).toBe(200)
    expect(await app.me(dana)).toBeNull()
    await expect(app.signIn.athlete('dana@test.example', 'a-long-password')).rejects.toThrow(/Wrong email or password/)
    expect(await app.signIn.athlete('dana@test.example', 'a-new-long-password')).toContain('=')
    expect((await post('/api/auth/reset', { token, password: 'another-long-password' })).statusCode).toBe(400)
  })

  it('answers the same for an email with no account, and sends nothing', async () => {
    const before = app.outbox.length
    expect((await post('/api/auth/forgot', { role: 'athlete', email: 'nobody@test.example' })).statusCode).toBe(200)
    expect(app.outbox).toHaveLength(before)
  })

  it('works for coaches and teams in their own role only, and never for staff', async () => {
    await app.signIn.memberSignUp('coach', 'Eli Cruz', 'eli@test.example', 'a-long-password')
    const before = app.outbox.length
    // The same address as a team finds nothing
    await post('/api/auth/forgot', { role: 'team', email: 'eli@test.example' })
    expect(app.outbox).toHaveLength(before)
    await post('/api/auth/forgot', { role: 'coach', email: 'eli@test.example' })
    expect(app.outbox).toHaveLength(before + 1)
    app.db.insert(t.staffUsers).values({ id: 'st1', name: 'Staff', username: 'staff@test.example', role: 'secretariat', passwordHash: hashPassword('pw-staff-long'), disabled: false }).run()
    expect((await post('/api/auth/forgot', { role: 'secretariat', email: 'staff@test.example' })).statusCode).toBe(400)
    expect(app.outbox).toHaveLength(before + 1)
  })

  it('limits how often one email can ask', async () => {
    const codes = []
    for (let i = 0; i < 4; i++) codes.push((await post('/api/auth/forgot', { role: 'athlete', email: 'ana@test.example' })).statusCode)
    expect(codes).toEqual([200, 200, 200, 429])
  })
})

describe('without a mail provider', () => {
  it('does not ask anyone to confirm an address that cannot be confirmed', async () => {
    const plain = await startTestApp({ seed: false })
    const cookie = await plain.signIn.athleteSignUp('Gia Reyes', 'gia@test.example', 'a-long-password')
    expect((await plain.ok<AthletePage>('getMyAthlete', [], cookie)).profile.emailVerified).toBe(true)
    await plain.close()
  })
})

describe('the mail provider', () => {
  it('posts the message to Brevo with the key, sender and recipient', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const mailer = brevoMailer('key-123', 'BIS <no-reply@example.com>', (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return new Response('{}', { status: 201 })
    }) as unknown as typeof fetch)
    await mailer.send({ to: 'a@test.example', subject: 'Hi', text: 'Open https://x.example/a?b=1' })
    expect(seen!.url).toBe('https://api.brevo.com/v3/smtp/email')
    expect((seen!.init.headers as Record<string, string>)['api-key']).toBe('key-123')
    const sent = JSON.parse(String(seen!.init.body))
    expect(sent).toMatchObject({ sender: { name: 'BIS', email: 'no-reply@example.com' }, to: [{ email: 'a@test.example' }], subject: 'Hi' })
    expect(sent.htmlContent).toContain('<a href="https://x.example/a?b=1">')
    const failing = brevoMailer('k', 'a@b.example', (async () => new Response('bad key', { status: 401 })) as unknown as typeof fetch)
    await expect(failing.send({ to: 'a@test.example', subject: 'Hi', text: 'x' })).rejects.toThrow(/401/)
  })
})
