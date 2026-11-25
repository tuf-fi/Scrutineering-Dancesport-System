import { AgeGroup, Class, Discipline, EventKind } from './enums.ts'

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

// A kind of event, which sets who may enter
export interface EventKindDef {
  id: EventKind
  name: string
  // The disciplines its events are danced in
  disciplines: Discipline[]
  // Open only to one province, named on each event
  closedToProvince: boolean
  // What every dancer entering must have on the entry form
  requires: KindField[]
}

// An age group: the dancers born from bornFrom up to bornTo (both years included). A group with no bornFrom reaches back
// to the oldest dancers, one with no bornTo up to the youngest. Groups may overlap.
export interface AgeGroupDef {
  id: AgeGroup
  name: string
  // As printed on result sheets, e.g. "JUN 1"
  short: string
  bornFrom: number | null
  bornTo: number | null
  // Replaced by a newer version after events ran in it: kept for those events, never offered for new ones
  retired?: boolean
  // Versions of one group share a family; rankings add them together
  family?: string
}

// A class, from E1 up. Its name is what events and result sheets show, and the list keeps the order.
export interface ClassDef {
  name: string
}
export type ClassInput = ClassDef

export interface Catalog {
  kinds: EventKindDef[]
  ageGroups: AgeGroupDef[]
  // From the lowest class to the highest
  classes: ClassDef[]
}

// What the admin sends for a kind
export interface EventKindInput {
  name: string
  disciplines: Discipline[]
  closedToProvince: boolean
  requires: KindField[]
}
export type AgeGroupInput = Omit<AgeGroupDef, 'id' | 'retired' | 'family'>

// What a new database starts with, from the organizer's 2026 entry forms
const BOTH: Discipline[] = [Discipline.Latin, Discipline.Standard]
const kind = (id: string, name: string, limits: { closedToProvince?: boolean } = {}): EventKindDef => ({
  id,
  name,
  disciplines: [...BOTH],
  closedToProvince: limits.closedToProvince ?? false,
  requires: [],
})
export const DEFAULT_EVENT_KINDS: EventKindDef[] = [
  kind(EventKind.Standard, 'Standard'),
  kind(EventKind.Ranking, 'Ranking'),
  kind(EventKind.InterElementary, 'Inter-elementary'),
  kind(EventKind.InterHighSchool, 'Inter-high school'),
  kind(EventKind.InterCollegiate, 'Inter-collegiate'),
  kind(EventKind.Closed, 'Closed to a province', { closedToProvince: true }),
]

// The birth years are from the organizer's 2026 entry forms (Juvenile 1 born 2017 or later, Juvenile 2 2015-2016,
// Junior 1 2013-2014, Junior 2 2011-2012, Youth 2008-2010). Adult and Senior follow WDSF Competition Rules 2018, E.2
// (Adult 19 and over, Senior from 35), counted for 2026.
export const DEFAULT_AGE_GROUPS: AgeGroupDef[] = [
  { id: AgeGroup.Juvenile1, name: 'Juvenile 1', short: 'JUV 1', bornFrom: 2017, bornTo: null },
  { id: AgeGroup.Juvenile2, name: 'Juvenile 2', short: 'JUV 2', bornFrom: 2015, bornTo: 2016 },
  { id: AgeGroup.Junior1, name: 'Junior I', short: 'JUN 1', bornFrom: 2013, bornTo: 2014 },
  { id: AgeGroup.Junior2, name: 'Junior II', short: 'JUN 2', bornFrom: 2011, bornTo: 2012 },
  { id: AgeGroup.Youth, name: 'Youth', short: 'YTH', bornFrom: 2008, bornTo: 2010 },
  { id: AgeGroup.Adult, name: 'Adult', short: 'ADT', bornFrom: 1992, bornTo: 2007 },
  { id: AgeGroup.Senior, name: 'Senior', short: 'SEN', bornFrom: null, bornTo: 1991 },
]

// The groups from the youngest dancers to the oldest
const compare = (x: number, y: number) => (x === y ? 0 : x > y ? 1 : -1)
export const byAge = (a: Pick<AgeGroupDef, 'bornFrom' | 'bornTo'>, b: Pick<AgeGroupDef, 'bornFrom' | 'bornTo'>) =>
  compare(b.bornFrom ?? -Infinity, a.bornFrom ?? -Infinity) || compare(b.bornTo ?? Infinity, a.bornTo ?? Infinity)

export const DEFAULT_CLASSES: ClassDef[] = Object.values(Class).map((name) => ({ name }))

export const DEFAULT_CATALOG: Catalog = { kinds: DEFAULT_EVENT_KINDS, ageGroups: DEFAULT_AGE_GROUPS, classes: DEFAULT_CLASSES }

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

const KIND_FIELDS: string[] = Object.values(KindField)
const DISCIPLINES: string[] = Object.values(Discipline)

const trimmed = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

export type CheckedKind = Omit<EventKindDef, 'id'>

// others are the kinds apart from the one being edited
export function checkEventKind(input: EventKindInput | undefined, others: EventKindDef[]): Checked<CheckedKind> {
  const name = trimmed(input?.name)
  if (!input || !name) return { error: 'Enter the name of the kind.', status: 400 }
  if (name.length > 60) return { error: 'The name is too long.', status: 400 }
  if (!Array.isArray(input.disciplines) || input.disciplines.length === 0 || input.disciplines.some((d) => !DISCIPLINES.includes(d))) {
    return { error: 'Choose Latin, Standard or both.', status: 400 }
  }
  if (typeof input.closedToProvince !== 'boolean') {
    return { error: 'Choose whether the kind is closed to a province.', status: 400 }
  }
  if (!Array.isArray(input.requires) || input.requires.some((f) => !KIND_FIELDS.includes(f))) {
    return { error: 'Choose the data from the entry form.', status: 400 }
  }
  if (others.some((k) => k.name.toLowerCase() === name.toLowerCase())) return { error: 'A kind with this name already exists.', status: 409 }
  return {
    values: {
      name,
      disciplines: DISCIPLINES.filter((d) => input.disciplines.includes(d as Discipline)) as Discipline[],
      closedToProvince: input.closedToProvince,
      requires: [...new Set(input.requires)],
    },
  }
}

// others are the classes apart from the one being edited
export function checkClass(input: ClassInput | undefined, others: ClassDef[]): Checked<ClassInput> {
  const name = trimmed(input?.name)
  if (!name) return { error: 'Enter the name of the class.', status: 400 }
  if (name.length > 20) return { error: 'The name is too long. Use up to 20 characters.', status: 400 }
  if (others.some((c) => c.name.toLowerCase() === name.toLowerCase())) return { error: 'A class with this name already exists.', status: 409 }
  return { values: { name } }
}

const MIN_YEAR = 1900
const MAX_YEAR = 2100

// others are the age groups apart from the one being edited
export function checkAgeGroup(input: AgeGroupInput | undefined, others: AgeGroupDef[]): Checked<AgeGroupInput> {
  const name = trimmed(input?.name)
  const short = trimmed(input?.short)
  if (!input || !name) return { error: 'Enter the name of the age group.', status: 400 }
  if (!short) return { error: 'Enter how it is printed on result sheets.', status: 400 }
  if (name.length > 100 || short.length > 30) return { error: 'The name or the printed name is too long.', status: 400 }
  const bornFrom = input.bornFrom ?? null
  const bornTo = input.bornTo ?? null
  const year = (y: number | null) => y === null || (Number.isInteger(y) && y >= MIN_YEAR && y <= MAX_YEAR)
  if (!year(bornFrom) || !year(bornTo)) return { error: `A year of birth is a whole number from ${MIN_YEAR} to ${MAX_YEAR}.`, status: 400 }
  if (bornFrom === null && bornTo === null) return { error: 'Enter the first or the last year of birth.', status: 400 }
  if (bornFrom !== null && bornTo !== null && bornFrom > bornTo) return { error: 'The first year of birth comes before the last.', status: 400 }
  if (others.some((g) => g.name.toLowerCase() === name.toLowerCase())) return { error: 'An age group with this name already exists.', status: 409 }
  return { values: { name, short, bornFrom, bornTo } }
}

// A readable id from the name, such as "inter_school"; a number is added if it is taken
export function freshId(name: string, taken: string[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item'
  let candidate = base
  for (let n = 2; taken.includes(candidate); n++) candidate = `${base}_${n}`
  return candidate
}

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
