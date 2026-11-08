import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
beforeAll(async () => {
  app = await startTestApp()
})
afterAll(() => app.close())

// The sign-in routes take 16 KB; a sign-up also sends the photo, which is far bigger
describe('sign-up with a real photo', () => {
  const photo = (size: number) => `data:image/jpeg;base64,${'A'.repeat(size)}`
  const signUp = (role: string, size: number) =>
    app.app.inject({ method: 'POST', url: `/api/auth/${role}/sign-up`, payload: { name: 'Big Photo', email: `${role}-${size}@test.example`, password: 'a-long-password', photo: photo(size) } })

  it('accepts a photo of 300 KB for an athlete, a coach and a team', async () => {
    for (const role of ['athlete', 'coach', 'team']) expect((await signUp(role, 300_000)).statusCode).toBe(200)
  })

  it('still refuses a photo over the photo limit', async () => {
    expect((await signUp('athlete', 450_000)).statusCode).toBe(413)
  })
})
