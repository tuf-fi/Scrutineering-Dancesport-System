import type { SiteSettings } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
let admin = ''
let secretariat = ''
const picture = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
  secretariat = await app.signIn.staff('secretariat')
})
afterAll(() => app.close())

describe('the home page picture', () => {
  it('starts on the built-in picture, readable by anyone', async () => {
    expect(await app.ok<SiteSettings>('getSiteSettings', [])).toEqual({ heroImage: null })
  })

  it('is changed and reset by the admin only, and only to a real picture', async () => {
    expect((await app.call('saveHeroImage', [picture], secretariat)).status).toBe(403)
    expect((await app.call('saveHeroImage', ['not a picture'], admin)).status).toBe(400)
    expect((await app.call('saveHeroImage', ['data:image/svg+xml;base64,PHN2Zz4='], admin)).status).toBe(400)

    await app.ok('saveHeroImage', [picture], admin)
    expect(await app.ok<SiteSettings>('getSiteSettings', [])).toEqual({ heroImage: picture })

    await app.ok('saveHeroImage', [null], admin)
    expect(await app.ok<SiteSettings>('getSiteSettings', [])).toEqual({ heroImage: null })
  })
})
