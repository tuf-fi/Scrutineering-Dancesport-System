import { DEFAULT_CERTIFICATE_LAYOUT, type CertificateLayout } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
const who: Record<string, string> = {}
const PICTURE = 'data:image/png;base64,iVBORw0KGgo='

beforeAll(async () => {
  app = await startTestApp()
  for (const role of ['admin', 'scrutineer', 'chairperson', 'secretariat']) who[role] = await app.signIn.staff(role)
})
afterAll(() => app.close())

describe('the certificate layout', () => {
  it('starts as the built-in layout, readable by staff', async () => {
    expect(await app.ok('getCertificateLayout', [], who.chairperson)).toEqual(DEFAULT_CERTIFICATE_LAYOUT)
  })

  it('is saved by the scrutineer, the chairperson or the admin, cleaned, and reset to the built-in one', async () => {
    const layout: CertificateLayout = structuredClone(DEFAULT_CERTIFICATE_LAYOUT)
    layout.orientation = 'portrait'
    layout.background = PICTURE
    layout.lines.name = { ...layout.lines.name, font: 'serif', size: 999, italic: true, text: 'Dancer {name}' }
    const saved = await app.ok<CertificateLayout>('saveCertificateLayout', [layout], who.scrutineer)
    expect(saved.orientation).toBe('portrait')
    expect(saved.lines.name).toMatchObject({ font: 'serif', size: 72, italic: true, text: 'Dancer {name}' })
    expect(await app.ok('getCertificateLayout', [], who.secretariat)).toEqual(saved)
    expect(await app.ok('saveCertificateLayout', [null], who.admin)).toEqual(DEFAULT_CERTIFICATE_LAYOUT)
  })

  it('cannot be changed by the secretariat, and takes only a picture as background', async () => {
    expect((await app.call('saveCertificateLayout', [DEFAULT_CERTIFICATE_LAYOUT], who.secretariat)).error).toBeTruthy()
    const bad = { ...DEFAULT_CERTIFICATE_LAYOUT, background: 'javascript:alert(1)' }
    expect((await app.call('saveCertificateLayout', [bad], who.admin)).error).toMatch(/picture/)
  })
})

describe('the certificate paper', () => {
  it('defaults to A4, keeps a known size and falls back to A4 for an unknown one', async () => {
    const layout = { ...structuredClone(DEFAULT_CERTIFICATE_LAYOUT), paper: 'letter' } as CertificateLayout
    expect((await app.ok<CertificateLayout>('saveCertificateLayout', [layout], who.admin)).paper).toBe('letter')
    const odd = { ...layout, paper: 'poster' } as unknown as CertificateLayout
    expect((await app.ok<CertificateLayout>('saveCertificateLayout', [odd], who.admin)).paper).toBe('a4')
    await app.ok('saveCertificateLayout', [null], who.admin)
  })
})

describe('the certificate colors and signatories', () => {
  it('keeps a valid font color and signature, and drops a bad color or a signature that is not a small PNG', async () => {
    const layout = structuredClone(DEFAULT_CERTIFICATE_LAYOUT)
    layout.lines.name.color = '#B3261E'
    layout.lines.title.color = 'red'
    layout.signatories.president = { name: 'Atty. Dela Cruz', signature: PICTURE, x: 0, y: 0, signX: 0, signY: 0, nameX: 0, nameY: 0 }
    layout.signatories.organizer = { name: '', signature: 'data:image/jpeg;base64,AAAA', x: 0, y: 0, signX: 0, signY: 0, nameX: 0, nameY: 0 }
    const saved = await app.ok<CertificateLayout>('saveCertificateLayout', [layout], who.scrutineer)
    expect(saved.lines.name.color).toBe('#b3261e')
    expect(saved.lines.title.color).toBe(DEFAULT_CERTIFICATE_LAYOUT.lines.title.color)
    expect(saved.signatories.president).toEqual({ name: 'Atty. Dela Cruz', signature: PICTURE, x: 0, y: 0, signX: 0, signY: 0, nameX: 0, nameY: 0 })
    expect(saved.signatories.organizer.signature).toBeNull()
    await app.ok('saveCertificateLayout', [null], who.admin)
  })
})

describe('moved elements and a chairperson signature set on the layout', () => {
  it('keeps where a line and a signature were dragged, within the sheet, and a chairperson name and signature set on the layout', async () => {
    const layout = structuredClone(DEFAULT_CERTIFICATE_LAYOUT)
    layout.lines.name.x = 12.34
    layout.lines.name.y = -5
    layout.lines.title.x = 99999
    layout.signatories.chairperson = { name: 'Hon. Santos', signature: PICTURE, x: -20, y: 3, signX: 5, signY: -4, nameX: 12, nameY: 2 }
    const saved = await app.ok<CertificateLayout>('saveCertificateLayout', [layout], who.admin)
    expect(saved.lines.name).toMatchObject({ x: 12.3, y: -5 })
    expect(saved.lines.title.x).toBe(300)
    expect(saved.signatories.chairperson).toEqual({ name: 'Hon. Santos', signature: PICTURE, x: -20, y: 3, signX: 5, signY: -4, nameX: 12, nameY: 2 })
    await app.ok('saveCertificateLayout', [null], who.admin)
  })
})
