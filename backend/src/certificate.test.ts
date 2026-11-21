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

const sig = (layout: CertificateLayout, id: string) => layout.signatories.find((x) => x.id === id)!

describe('the certificate colors', () => {
  it('keeps a valid font color and drops a bad one', async () => {
    const layout = structuredClone(DEFAULT_CERTIFICATE_LAYOUT)
    layout.lines.name.color = '#B3261E'
    layout.lines.title.color = 'red'
    const saved = await app.ok<CertificateLayout>('saveCertificateLayout', [layout], who.scrutineer)
    expect(saved.lines.name.color).toBe('#b3261e')
    expect(saved.lines.title.color).toBe(DEFAULT_CERTIFICATE_LAYOUT.lines.title.color)
    await app.ok('saveCertificateLayout', [null], who.admin)
  })

  it('no longer has an event or a back number line', async () => {
    const saved = await app.ok<CertificateLayout>('getCertificateLayout', [], who.admin)
    expect(Object.keys(saved.lines)).not.toContain('event')
    expect(Object.keys(saved.lines)).not.toContain('number')
  })
})

describe('the signatories', () => {
  it('start as the organizer, the chairperson and the PDSF president', async () => {
    const saved = await app.ok<CertificateLayout>('getCertificateLayout', [], who.admin)
    expect(saved.signatories.map((s) => [s.kind, s.title])).toEqual([
      ['organizer', 'Organizer'],
      ['chairperson', 'Chairperson of Adjudicators'],
      ['person', 'PDSF President'],
    ])
  })

  it('can be added to and removed from, with any title, a name and a small PNG signature', async () => {
    const layout = structuredClone(DEFAULT_CERTIFICATE_LAYOUT)
    layout.signatories = layout.signatories.filter((s) => s.id !== 'organizer')
    layout.signatories.push({ ...layout.signatories[0]!, id: 'guest', kind: 'person', title: 'Guest of Honor', name: 'Atty. Dela Cruz', signature: PICTURE })
    layout.signatories.push({ ...layout.signatories[0]!, id: 'bad', kind: 'person', title: '', name: '', signature: 'data:image/jpeg;base64,AAAA' })
    const saved = await app.ok<CertificateLayout>('saveCertificateLayout', [layout], who.scrutineer)
    expect(saved.signatories.map((s) => s.id)).toEqual(['chairperson', 'president', 'guest', 'bad'])
    expect(sig(saved, 'guest')).toMatchObject({ title: 'Guest of Honor', name: 'Atty. Dela Cruz', signature: PICTURE })
    expect(sig(saved, 'bad').signature).toBeNull()
    await app.ok('saveCertificateLayout', [{ ...layout, signatories: [] }], who.admin)
    expect((await app.ok<CertificateLayout>('getCertificateLayout', [], who.admin)).signatories).toEqual([])
    await app.ok('saveCertificateLayout', [null], who.admin)
  })

  it('keep at most six, with their own ids', async () => {
    const layout = structuredClone(DEFAULT_CERTIFICATE_LAYOUT)
    layout.signatories = Array.from({ length: 9 }, () => ({ ...DEFAULT_CERTIFICATE_LAYOUT.signatories[2]!, id: 'same' }))
    const saved = await app.ok<CertificateLayout>('saveCertificateLayout', [layout], who.admin)
    expect(saved.signatories).toHaveLength(6)
    expect(new Set(saved.signatories.map((s) => s.id)).size).toBe(6)
    await app.ok('saveCertificateLayout', [null], who.admin)
  })

  it('still read a layout saved when the three signatories were fixed', async () => {
    const old = { ...structuredClone(DEFAULT_CERTIFICATE_LAYOUT), signatories: { president: { title: 'President', name: 'Old Name', signature: null } } }
    const saved = await app.ok<CertificateLayout>('saveCertificateLayout', [old], who.admin)
    expect(saved.signatories.map((s) => s.id)).toEqual(['organizer', 'chairperson', 'president'])
    expect(sig(saved, 'president')).toMatchObject({ title: 'President', name: 'Old Name' })
    await app.ok('saveCertificateLayout', [null], who.admin)
  })

  it('keep where a line and a signature were dragged, within the sheet', async () => {
    const layout = structuredClone(DEFAULT_CERTIFICATE_LAYOUT)
    layout.lines.name.x = 12.34
    layout.lines.name.y = -5
    layout.lines.title.x = 99999
    layout.signatories[1] = { ...layout.signatories[1]!, name: 'Hon. Santos', signature: PICTURE, x: -20, y: 3, signX: 5, signY: -4, nameX: 12, nameY: 2 }
    const saved = await app.ok<CertificateLayout>('saveCertificateLayout', [layout], who.admin)
    expect(saved.lines.name).toMatchObject({ x: 12.3, y: -5 })
    expect(saved.lines.title.x).toBe(300)
    expect(sig(saved, 'chairperson')).toMatchObject({ name: 'Hon. Santos', signature: PICTURE, x: -20, y: 3, signX: 5, signY: -4, nameX: 12, nameY: 2 })
    await app.ok('saveCertificateLayout', [null], who.admin)
  })
})
