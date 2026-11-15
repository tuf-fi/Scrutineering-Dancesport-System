import type { SheetSignatures, StaffUser } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

// Staff keep one signature on their account; the sheet reads the scrutineer's and the chairperson's

let app: TestApp
const who: Record<string, string> = {}
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

beforeAll(async () => {
  app = await startTestApp()
  for (const role of ['admin', 'scrutineer', 'chairperson', 'secretariat']) who[role] = await app.signIn.staff(role)
})
afterAll(() => app.close())

describe('a staff signature', () => {
  it('is kept on the account, returned to its owner only, and can be removed', async () => {
    expect(await app.ok('getMySignature', [], who.scrutineer)).toBeNull()
    expect(await app.ok('saveMyStaffSignature', [PNG], who.scrutineer)).toBe(PNG)
    expect(await app.ok('getMySignature', [], who.scrutineer)).toBe(PNG)
    expect(await app.ok('getMySignature', [], who.chairperson)).toBeNull()
    // Staff lists never carry it
    const list = await app.ok<StaffUser[]>('getStaffUsers', [], who.admin)
    expect(JSON.stringify(list)).not.toContain('DwAChwGA60e6kg')
    expect(await app.ok('saveMyStaffSignature', [null], who.scrutineer)).toBeNull()
    expect(await app.ok('getMySignature', [], who.scrutineer)).toBeNull()
  })

  it('must be a small PNG', async () => {
    expect((await app.call('saveMyStaffSignature', ['data:image/jpeg;base64,AAAA'], who.scrutineer)).error).toMatch(/PNG/)
    expect((await app.call('saveMyStaffSignature', [`data:image/png;base64,${'A'.repeat(160_000)}`], who.scrutineer)).error).toMatch(/150 KB/)
    expect((await app.call('saveMyStaffSignature', [42], who.scrutineer)).error).toMatch(/PNG/)
  })
})

describe('the signatures printed on an event', () => {
  it('are the scrutineer who approved the results and a chairperson', async () => {
    const row = app.sqlite.prepare('SELECT r.event_id AS eventId, s.id AS staffId, s.name AS name, s.role AS role FROM results r JOIN staff_users s ON s.id = r.approved_by LIMIT 1').get() as
      | { eventId: string; staffId: string; name: string; role: string }
      | undefined
    const eventId = row?.eventId ?? (app.sqlite.prepare('SELECT id FROM events LIMIT 1').get() as { id: string }).id
    await app.ok('saveMyStaffSignature', [PNG], who.chairperson)
    const sheet = await app.ok<SheetSignatures>('getSheetSignatures', [eventId], who.secretariat)
    expect(sheet.chairperson).toMatchObject({ signature: PNG })
    if (row?.role === 'scrutineer') expect(sheet.scrutineer?.name).toBe(row.name)
    else expect(sheet.scrutineer).toBeNull()
  })

  it('are readable by officials only', async () => {
    const eventId = (app.sqlite.prepare('SELECT id FROM events LIMIT 1').get() as { id: string }).id
    expect((await app.call('getSheetSignatures', [eventId], undefined)).status).toBe(401)
  })
})
