import { DEFAULT_FEE_SCHEDULE, ageGroupFits, ageGroupForBirthYears, registrationFee, registrationWarnings, type AgeGroupDef, type Catalog, type Competition, type Event, type EventKindDef } from '@bis/shared'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

// The admin keeps the kinds of event and the age groups; events, fees and warnings follow them

let app: TestApp
let admin = ''
let secretariat = ''
let competitionId = ''

const kindInput = { name: 'Inter-school', feeMode: 'couple_older', disciplines: ['latin', 'standard'], beginnersOnly: false, closedToProvince: false, requires: [] }
const groupInput = { name: 'Masters', short: 'MST', bornFrom: 1982, bornTo: 1991, juvenileFee: false }
const eventInput = { number: 901, ageGroup: 'adult', class: 'D', discipline: 'latin', dances: ['samba'], isSolo: false }

beforeAll(async () => {
  app = await startTestApp()
  admin = await app.signIn.staff('admin')
  secretariat = await app.signIn.staff('secretariat')
  competitionId = (await app.ok<Competition[]>('getCompetitions', [], admin))[0]!.id
})
afterAll(() => app.close())

describe('event kinds', () => {
  it('starts with the built-in kinds and age groups, readable without signing in', async () => {
    const catalog = await app.ok<Catalog>('getCatalog', [])
    expect(catalog.kinds.map((k) => k.id)).toEqual(['standard', 'bgb', 'ranking', 'inter_elementary', 'inter_high_school', 'inter_collegiate', 'closed'])
    expect(catalog.ageGroups.map((g) => g.id)).toEqual(['juvenile_1', 'juvenile_2', 'junior_1', 'junior_2', 'youth', 'adult', 'senior'])
    expect(catalog.kinds.find((k) => k.id === 'closed')).toMatchObject({ closedToProvince: true, feeMode: 'standard', disciplines: ['latin', 'standard'] })
    expect(catalog.kinds.find((k) => k.id === 'bgb')).toMatchObject({ beginnersOnly: true })
  })

  it('adds, edits and deletes a kind, and keeps the secretariat out', async () => {
    expect((await app.call('saveEventKind', [kindInput], secretariat)).status).toBe(403)
    const made = await app.ok<EventKindDef>('saveEventKind', [kindInput], admin)
    expect(made).toMatchObject({ id: 'inter_school', name: 'Inter-school', feeMode: 'couple_older' })
    expect((await app.call('saveEventKind', [{ ...kindInput, name: 'inter-SCHOOL' }], admin)).error).toMatch(/already exists/)
    expect((await app.call('saveEventKind', [{ ...kindInput, name: ' ' }], admin)).error).toMatch(/name/)
    expect((await app.call('saveEventKind', [{ ...kindInput, feeMode: 'free' }], admin)).error).toMatch(/priced/)
    expect((await app.call('saveEventKind', [{ ...kindInput, requires: ['shoe_size'] }], admin)).error).toMatch(/entry form/)

    const renamed = await app.ok<EventKindDef>('saveEventKind', [{ ...kindInput, name: 'Inter-school cup', requires: ['email', 'email', 'phone'] }, made.id], admin)
    expect(renamed).toMatchObject({ id: 'inter_school', name: 'Inter-school cup', requires: ['email', 'phone'] })
    expect((await app.ok<Catalog>('getCatalog', [])).kinds.at(-1)).toMatchObject({ id: 'inter_school', name: 'Inter-school cup' })

    await app.ok('deleteEventKind', [made.id], admin)
    expect((await app.ok<Catalog>('getCatalog', [])).kinds.some((k) => k.id === made.id)).toBe(false)
  })

  it('lets an event use a new kind, and deletes a kind with its events only when told to', async () => {
    const made = await app.ok<EventKindDef>('saveEventKind', [{ ...kindInput, name: 'Cup' }], admin)
    expect((await app.call('saveEvent', [competitionId, { ...eventInput, kind: 'nonsense' }], secretariat)).error).toMatch(/Choose a kind/)
    expect((await app.call('saveEvent', [competitionId, { ...eventInput, kind: made.id, ageGroup: 'nonsense' }], secretariat)).error).toMatch(/age group/)
    const event = await app.ok<Event>('saveEvent', [competitionId, { ...eventInput, kind: made.id }], secretariat)
    expect(event.kind).toBe(made.id)

    const refusal = await app.call('deleteEventKind', [made.id], admin)
    expect(refusal.status).toBe(409)
    expect(refusal.error).toMatch(/Cup has related data/)
    const impact = await app.ok<{ items: Array<{ label: string; count: number }> }>('getDeleteImpact', ['eventKind', made.id], admin)
    expect(impact.items).toEqual([expect.objectContaining({ label: 'Events', count: 1 })])
    await app.ok('deleteEventKind', [made.id, true], admin)
    expect((await app.ok<Event[]>('getEvents', [competitionId])).some((e) => e.id === event.id)).toBe(false)
  })

  it('requires a province for any kind closed to one', async () => {
    const made = await app.ok<EventKindDef>('saveEventKind', [{ ...kindInput, name: 'Home cup', closedToProvince: true }], admin)
    expect((await app.call('saveEvent', [competitionId, { ...eventInput, kind: made.id }], secretariat)).error).toMatch(/province/)
    const event = await app.ok<Event>('saveEvent', [competitionId, { ...eventInput, kind: made.id, province: 'Albay' }], secretariat)
    expect(event.province).toBe('Albay')
    await app.ok('deleteEvent', [event.id], secretariat)
    await app.ok('deleteEventKind', [made.id], admin)
  })
})

describe('kind disciplines', () => {
  it('keeps the events of a kind to its disciplines', async () => {
    const made = await app.ok<EventKindDef>('saveEventKind', [{ ...kindInput, name: 'Latin cup', disciplines: ['latin'] }], admin)
    expect(made.disciplines).toEqual(['latin'])
    expect((await app.call('saveEventKind', [{ ...kindInput, name: 'None', disciplines: [] }], admin)).error).toMatch(/Latin, Standard or both/)
    const refused = await app.call('saveEvent', [competitionId, { ...eventInput, kind: made.id, discipline: 'standard', dances: ['waltz'] }], secretariat)
    expect(refused.error).toMatch(/not danced in standard/)
    const event = await app.ok<Event>('saveEvent', [competitionId, { ...eventInput, kind: made.id }], secretariat)
    await app.ok('deleteEvent', [event.id], secretariat)
    await app.ok('deleteEventKind', [made.id], admin)
  })
})

describe('age groups', () => {
  it('adds, renames and deletes an age group by its years of birth, and lets groups overlap', async () => {
    expect((await app.call('saveAgeGroup', [groupInput], secretariat)).status).toBe(403)
    expect((await app.call('saveAgeGroup', [{ ...groupInput, name: 'x'.repeat(101) }], admin)).error).toMatch(/too long/)
    expect((await app.call('saveAgeGroup', [{ ...groupInput, short: 'y'.repeat(31) }], admin)).error).toMatch(/too long/)
    // Names and printed names up to 100 and 30 characters are fine
    const long = await app.ok<AgeGroupDef>('saveAgeGroup', [{ ...groupInput, name: 'Long '.repeat(15).trim(), short: 'LONG PRINTED NAME OF A GROUP' }], admin)
    await app.ok('deleteAgeGroup', [long.id], admin)
    expect((await app.call('saveAgeGroup', [{ ...groupInput, bornFrom: 1800 }], admin)).error).toMatch(/whole number from 1900/)
    expect((await app.call('saveAgeGroup', [{ ...groupInput, bornFrom: null, bornTo: null }], admin)).error).toMatch(/first or the last/)
    expect((await app.call('saveAgeGroup', [{ ...groupInput, bornFrom: 1995, bornTo: 1990 }], admin)).error).toMatch(/comes before/)
    expect((await app.call('saveAgeGroup', [{ ...groupInput, name: 'ADULT' }], admin)).error).toMatch(/already exists/)

    const made = await app.ok<AgeGroupDef>('saveAgeGroup', [groupInput], admin)
    expect(made).toMatchObject({ id: 'masters', name: 'Masters', bornFrom: 1982, bornTo: 1991 })
    // Another group may cover the same years, as the Senior group already does
    const twin = await app.ok<AgeGroupDef>('saveAgeGroup', [{ ...groupInput, name: 'Masters B', short: 'MSB' }], admin)
    await app.ok('deleteAgeGroup', [twin.id], admin)
    const groups = (await app.ok<Catalog>('getCatalog', [])).ageGroups.map((g) => g.id)
    expect(groups.indexOf('masters')).toBe(groups.indexOf('senior') - 1)

    const renamed = await app.ok<AgeGroupDef>('saveAgeGroup', [{ ...groupInput, name: 'Masters 35 to 44' }, made.id], admin)
    expect(renamed).toMatchObject({ id: 'masters', name: 'Masters 35 to 44' })
    await app.ok('deleteAgeGroup', [made.id], admin)
  })

  it('deletes an age group with its events only when told to', async () => {
    const made = await app.ok<AgeGroupDef>('saveAgeGroup', [groupInput], admin)
    const event = await app.ok<Event>('saveEvent', [competitionId, { ...eventInput, ageGroup: made.id }], secretariat)
    const refusal = await app.call('deleteAgeGroup', [made.id], admin)
    expect(refusal.status).toBe(409)
    expect(refusal.error).toMatch(/Masters has related data/)
    await app.ok('deleteAgeGroup', [made.id, true], admin)
    expect((await app.ok<Event[]>('getEvents', [competitionId])).some((e) => e.id === event.id)).toBe(false)
  })

  it('keeps what a group meant for events that have started, and moves the rest to the new version', async () => {
    const made = await app.ok<AgeGroupDef>('saveAgeGroup', [{ ...groupInput, name: 'Veterans', short: 'VET' }], admin)
    const started = await app.ok<Event>('saveEvent', [competitionId, { ...eventInput, number: 902, ageGroup: made.id }], secretariat)
    const upcoming = await app.ok<Event>('saveEvent', [competitionId, { ...eventInput, number: 903, ageGroup: made.id }], secretariat)
    app.db.insert(t.rounds).values({ id: 'veterans-round', eventId: started.id, type: 'final', position: 1, recallNumber: null, status: 'marking' }).run()

    const next = await app.ok<AgeGroupDef>('saveAgeGroup', [{ ...groupInput, name: 'Veterans 35 to 49', short: 'VET', bornFrom: 1977 }, made.id], admin)
    expect(next.id).not.toBe(made.id)
    expect(next.family).toBe(made.id)

    const catalog = await app.ok<Catalog>('getCatalog', [])
    expect(catalog.ageGroups.find((g) => g.id === made.id)).toMatchObject({ name: 'Veterans', bornFrom: 1982, retired: true })
    expect(catalog.ageGroups.find((g) => g.id === next.id)).toMatchObject({ name: 'Veterans 35 to 49', bornFrom: 1977 })
    const eventGroup = async (id: string) => (await app.ok<Event[]>('getEvents', [competitionId], admin)).find((e) => e.id === id)?.ageGroup
    expect(await eventGroup(started.id)).toBe(made.id)
    expect(await eventGroup(upcoming.id)).toBe(next.id)

    // A new event and a new birth year only see the current version, and the old version can no longer be edited
    expect((await app.call('saveEvent', [competitionId, { ...eventInput, number: 904, ageGroup: made.id }], secretariat)).error).toMatch(/age group/)
    expect(ageGroupForBirthYears([1980], catalog.ageGroups)).toBe(next.id)
    expect((await app.call('saveAgeGroup', [groupInput, made.id], admin)).status).toBe(409)

    // Changing nothing makes no new version; one with no started events changes in place
    expect((await app.ok<AgeGroupDef>('saveAgeGroup', [{ name: next.name, short: next.short, bornFrom: 1977, bornTo: 1991, juvenileFee: false }, next.id], admin)).id).toBe(next.id)
    await app.ok('deleteEvent', [upcoming.id], secretariat)
    app.db.delete(t.rounds).where(eq(t.rounds.id, 'veterans-round')).run()
    await app.ok('deleteEvent', [started.id], secretariat)
  })
})

describe('rules follow the catalog', () => {
  const catalog: Catalog = {
    kinds: [
      { id: 'standard', name: 'Standard', feeMode: 'standard', beginnersOnly: false, closedToProvince: false, disciplines: ['latin', 'standard'], requires: [] },
      { id: 'school', name: 'School cup', feeMode: 'couple_older', beginnersOnly: false, closedToProvince: false, disciplines: ['latin', 'standard'], requires: ['email', 'membership'] },
      { id: 'open_day', name: 'Open day', feeMode: 'fixed', beginnersOnly: false, closedToProvince: false, disciplines: ['latin', 'standard'], requires: [] },
    ],
    ageGroups: [
      { id: 'tiny', name: 'Tiny', short: 'TNY', bornFrom: 2018, bornTo: null, juvenileFee: true },
      { id: 'rest', name: 'Rest', short: 'RST', bornFrom: null, bornTo: 2017, juvenileFee: false },
    ],
  }

  it('prices an event by the kind and the age group it points at', () => {
    const event = { number: 1, isSolo: true, kind: 'standard' }
    const fee = (e: object) => registrationFee(DEFAULT_FEE_SCHEDULE, [{ ...event, ageGroup: 'tiny', ...e }], 0, 0, undefined, catalog).total
    expect(fee({})).toBe(DEFAULT_FEE_SCHEDULE.soloJuvenile.first)
    expect(fee({ ageGroup: 'rest' })).toBe(DEFAULT_FEE_SCHEDULE.soloOlder.first)
    expect(fee({ kind: 'school' })).toBe(DEFAULT_FEE_SCHEDULE.coupleOlder.first)
    expect(fee({ kind: 'open_day' })).toBe(DEFAULT_FEE_SCHEDULE.fixed)
  })

  it('puts a couple in the older partner group or older, and a solo only in its own', () => {
    // A Junior I and a Youth dancer make a Youth couple
    expect(ageGroupForBirthYears([2013, 2008])).toBe('youth')
    expect(ageGroupFits('youth', 'youth', true)).toBe(true)
    expect(ageGroupFits('adult', 'youth', true)).toBe(true)
    expect(ageGroupFits('junior_1', 'youth', true)).toBe(false)
    expect(ageGroupFits('adult', 'youth', false)).toBe(false)
    expect(ageGroupFits('senior', 'adult', true)).toBe(true)
    expect(registrationWarnings({ province: '', coachId: null, dancers: [{ birthDate: '2013-01-01', address: '', email: '', phone: '' }, { birthDate: '2008-01-01', address: '', email: '', phone: '' }], beginner: false, memberYear: null }, 2, [{ number: 1, ageGroup: 'junior_1', kind: 'standard', province: '' }, { number: 2, ageGroup: 'adult', kind: 'standard', province: '' }]).filter((w) => w.includes('birth dates'))).toHaveLength(1)
  })

  it('works out the age group from birth years with the groups it is given', () => {
    expect(ageGroupForBirthYears([2020], catalog.ageGroups)).toBe('tiny')
    expect(ageGroupForBirthYears([2000, 2020], catalog.ageGroups)).toBe('rest')
  })

  it('warns about the data a kind requires, and names the age group by its name', () => {
    const dancer = { birthDate: '2016-01-01', address: 'Naga', email: '', phone: '09' }
    const details = { province: 'Albay', coachId: null, dancers: [dancer], beginner: false, memberYear: null }
    const warn = (newMembers: number) => registrationWarnings(details, 1, [{ number: 4, ageGroup: 'tiny', kind: 'school', province: '' }], catalog, newMembers)
    expect(warn(1)).toEqual([
      'E4 (School cup) needs the email of every dancer.',
      'E4 (School cup) needs the paid membership of every dancer.',
      'E4 is Tiny, but the birth dates make this Rest.',
    ])
    expect(warn(0)).toContain('E4 (School cup) needs the email of every dancer.')
    expect(warn(0).some((w) => w.includes('membership'))).toBe(false)
  })
})
