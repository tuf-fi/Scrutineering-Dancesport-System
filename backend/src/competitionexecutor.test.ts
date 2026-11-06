import type { Competition } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// The executor printed on result sheets is kept per competition; empty means the organizer

let app: TestApp
let admin = ''
const base = { name: 'Executor Cup', date: '2099-07-01', venue: 'Gym', organizer: 'Org', image: 'data:image/png;base64,iVBORw0KGgo=' }

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
})
afterAll(() => app.close())

describe('competition executor', () => {
  it('is empty until set, then kept and changeable', async () => {
    const made = await app.ok<Competition>('saveCompetition', [base], admin)
    expect(made.executor).toBeUndefined()
    const set = await app.ok<Competition>('saveCompetition', [{ ...base, executor: ' BN IT Scrutineer ' }, made.id], admin)
    expect(set.executor).toBe('BN IT Scrutineer')
    expect((await app.ok<Competition[]>('getCompetitions', [])).find((c) => c.id === made.id)?.executor).toBe('BN IT Scrutineer')
    const cleared = await app.ok<Competition>('saveCompetition', [{ ...base, executor: '' }, made.id], admin)
    expect(cleared.executor).toBeUndefined()
  })
})
