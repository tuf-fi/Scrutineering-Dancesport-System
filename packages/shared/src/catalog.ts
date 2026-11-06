import { AgeGroup, EventKind } from './enums.ts'

// How an event's entry is priced from the fee schedule: by age group and solo or couple, at the couple price of the
// younger or older tier, or at the one fixed price
export const FeeMode = {
  Standard: 'standard',
  CoupleJuvenile: 'couple_juvenile',
  CoupleOlder: 'couple_older',
  Fixed: 'fixed',
} as const
export type FeeMode = (typeof FeeMode)[keyof typeof FeeMode]

// What the entry form holds about each dancer, which a kind can require
export const KindField = {
  BirthDate: 'birth_date',
  Address: 'address',
  Email: 'email',
  Phone: 'phone',
  Membership: 'membership',
} as const
export type KindField = (typeof KindField)[keyof typeof KindField]

export const KIND_FIELD_LABEL: Record<KindField, string> = {
  birth_date: 'birth date',
  address: 'address',
  email: 'email',
  phone: 'phone number',
  membership: 'paid membership',
}

// A kind of event, which sets its fee and who may enter
export interface EventKindDef {
  id: EventKind
  name: string
  feeMode: FeeMode
  // Only beginner (BGB) athletes enter it, and they may enter nothing else
  beginnersOnly: boolean
  // Open only to one province, named on each event
  closedToProvince: boolean
  // What every dancer entering must have on the entry form
  requires: KindField[]
}

// An age group: the dancers whose age is above the group before it and up to oldestAge. The oldest group has no limit.
export interface AgeGroupDef {
  id: AgeGroup
  name: string
  // As printed on result sheets, e.g. "JUN 1"
  short: string
  oldestAge: number | null
  // Pays the juvenile price in a standard event
  juvenileFee: boolean
  // Replaced by a newer version after events ran in it: kept for those events, never offered for new ones
  retired?: boolean
  // Versions of one group share a family; rankings add them together
  family?: string
}

export interface Catalog {
  kinds: EventKindDef[]
  ageGroups: AgeGroupDef[]
}

export type EventKindInput = Omit<EventKindDef, 'id'>
export type AgeGroupInput = Omit<AgeGroupDef, 'id' | 'retired' | 'family'>

// What a new database starts with, from the organizer's 2026 entry forms
export const DEFAULT_EVENT_KINDS: EventKindDef[] = [
  { id: EventKind.Standard, name: 'Standard', feeMode: FeeMode.Standard, beginnersOnly: false, closedToProvince: false, requires: [] },
  { id: EventKind.Beginners, name: 'Beginners (BGB)', feeMode: FeeMode.Standard, beginnersOnly: true, closedToProvince: false, requires: [] },
  { id: EventKind.Ranking, name: 'Ranking', feeMode: FeeMode.Fixed, beginnersOnly: false, closedToProvince: false, requires: [] },
  { id: EventKind.InterElementary, name: 'Inter-elementary', feeMode: FeeMode.CoupleJuvenile, beginnersOnly: false, closedToProvince: false, requires: [] },
  { id: EventKind.InterHighSchool, name: 'Inter-high school', feeMode: FeeMode.CoupleOlder, beginnersOnly: false, closedToProvince: false, requires: [] },
  { id: EventKind.InterCollegiate, name: 'Inter-collegiate', feeMode: FeeMode.Fixed, beginnersOnly: false, closedToProvince: false, requires: [] },
  { id: EventKind.Closed, name: 'Closed to a province', feeMode: FeeMode.Standard, beginnersOnly: false, closedToProvince: true, requires: [] },
]

// The oldest age of each group is from the organizer's 2026 entry forms (Juvenile 1 born 2017 or later, Juvenile 2
// 2015-2016, Junior 1 2013-2014, Junior 2 2011-2012, Youth 2008-2010). Adult and Senior follow WDSF Competition Rules
// 2018, E.2: Adult 19 and over (Youth ends at 18), Senior from 35.
export const DEFAULT_AGE_GROUPS: AgeGroupDef[] = [
  { id: AgeGroup.Juvenile1, name: 'Juvenile 1', short: 'JUV 1', oldestAge: 9, juvenileFee: true },
  { id: AgeGroup.Juvenile2, name: 'Juvenile 2', short: 'JUV 2', oldestAge: 11, juvenileFee: true },
  { id: AgeGroup.Junior1, name: 'Junior I', short: 'JUN 1', oldestAge: 13, juvenileFee: false },
  { id: AgeGroup.Junior2, name: 'Junior II', short: 'JUN 2', oldestAge: 15, juvenileFee: false },
  { id: AgeGroup.Youth, name: 'Youth', short: 'YTH', oldestAge: 18, juvenileFee: false },
  { id: AgeGroup.Adult, name: 'Adult', short: 'ADT', oldestAge: 34, juvenileFee: false },
  { id: AgeGroup.Senior, name: 'Senior', short: 'SEN', oldestAge: null, juvenileFee: false },
]

export const DEFAULT_CATALOG: Catalog = { kinds: DEFAULT_EVENT_KINDS, ageGroups: DEFAULT_AGE_GROUPS }

// A group or kind that was deleted after an event used it cannot happen (the server refuses), but a label is
// still readable from the id if one is ever missing
const readable = (id: string) => id.replace(/_/g, ' ')

export const ageGroupName = (groups: AgeGroupDef[], id: string) => groups.find((g) => g.id === id)?.name ?? readable(id)
export const ageGroupShort = (groups: AgeGroupDef[], id: string) => groups.find((g) => g.id === id)?.short ?? readable(id).toUpperCase()
export const eventKindName = (kinds: EventKindDef[], id: string) => kinds.find((k) => k.id === id)?.name ?? readable(id)

// The kind an event has when it names none
export const kindOf = (kinds: EventKindDef[], id: string | undefined): EventKindDef | undefined =>
  kinds.find((k) => k.id === (id ?? EventKind.Standard))

// ---- Checking what the admin sends, for the server and the sample data alike ----

export type Checked<T> = { values: T } | { error: string; status: number }

const FEE_MODES: string[] = Object.values(FeeMode)
const KIND_FIELDS: string[] = Object.values(KindField)

const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

// others are the kinds apart from the one being edited
export function checkEventKind(input: EventKindInput | undefined, others: EventKindDef[]): Checked<EventKindInput> {
  const name = trimmed(input?.name)
  if (!input || !name) return { error: 'Enter the name of the kind.', status: 400 }
  if (name.length > 60) return { error: 'The name is too long.', status: 400 }
  if (!FEE_MODES.includes(input.feeMode)) return { error: 'Choose how the kind is priced.', status: 400 }
  if (typeof input.beginnersOnly !== 'boolean' || typeof input.closedToProvince !== 'boolean') {
    return { error: 'Choose whether the kind is for beginners or closed to a province.', status: 400 }
  }
  if (!Array.isArray(input.requires) || input.requires.some((f) => !KIND_FIELDS.includes(f))) {
    return { error: 'Choose the data from the entry form.', status: 400 }
  }
  if (others.some((k) => k.name.toLowerCase() === name.toLowerCase())) return { error: 'A kind with this name already exists.', status: 409 }
  return { values: { name, feeMode: input.feeMode, beginnersOnly: input.beginnersOnly, closedToProvince: input.closedToProvince, requires: [...new Set(input.requires)] } }
}

// others are the age groups apart from the one being edited
export function checkAgeGroup(input: AgeGroupInput | undefined, others: AgeGroupDef[]): Checked<AgeGroupInput> {
  const name = trimmed(input?.name)
  const short = trimmed(input?.short)
  if (!input || !name) return { error: 'Enter the name of the age group.', status: 400 }
  if (!short) return { error: 'Enter how it is printed on result sheets.', status: 400 }
  if (name.length > 40 || short.length > 12) return { error: 'The name or the printed name is too long.', status: 400 }
  const oldestAge = input.oldestAge ?? null
  if (oldestAge !== null && (!Number.isInteger(oldestAge) || oldestAge < 3 || oldestAge > 100)) {
    return { error: 'The oldest age is a whole number from 3 to 100, or empty for the oldest group.', status: 400 }
  }
  if (typeof input.juvenileFee !== 'boolean') return { error: 'Choose whether it pays the juvenile price.', status: 400 }
  if (others.some((g) => g.name.toLowerCase() === name.toLowerCase())) return { error: 'An age group with this name already exists.', status: 409 }
  if (others.some((g) => g.oldestAge === oldestAge)) {
    return { error: oldestAge === null ? 'Only the oldest group can have no limit.' : `Another age group already ends at ${oldestAge}.`, status: 409 }
  }
  return { values: { name, short, oldestAge, juvenileFee: input.juvenileFee } }
}

// A readable id from the name, such as "inter_school"; a number is added if it is taken
export function freshId(name: string, taken: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'
  let candidate = base
  for (let n = 2; taken.includes(candidate); n++) candidate = `${base}_${n}`
  return candidate
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
