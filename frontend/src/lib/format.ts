import { DEFAULT_AGE_GROUPS, ageGroupName } from '@bis/shared'
import type {
  Dance,
  Discipline,
  Event,
  FeeMode,
  PayMethod,
  PaymentStatus,
  ProgramRow,
  ProgramStatus,
  Role,
  RoundType,
} from '@bis/shared'

// How an event kind is priced, in the admin's words
export const FEE_MODE_LABEL: Record<FeeMode, string> = {
  standard: 'By age group, solo or couple',
  couple_juvenile: 'Couple, juvenile price',
  couple_older: 'Couple, older price',
  fixed: 'One fixed price',
}

export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  unpaid: 'Not paid yet',
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  bank: 'Bank transfer',
}

export const DISCIPLINE_LABEL: Record<Discipline, string> = {
  latin: 'Latin',
  standard: 'Standard',
}

export const DANCE_LABEL: Record<Dance, string> = {
  samba: 'Samba',
  cha_cha_cha: 'Cha Cha Cha',
  rumba: 'Rumba',
  paso_doble: 'Paso Doble',
  jive: 'Jive',
  waltz: 'Waltz',
  tango: 'Tango',
  viennese_waltz: 'Viennese Waltz',
  foxtrot: 'Foxtrot',
  quickstep: 'Quickstep',
}

export const ROUND_TYPE_LABEL: Record<RoundType, string> = {
  round_1: 'Round 1',
  round_2: 'Round 2',
  quarter_final: 'Quarter-final',
  semi_final: 'Semi-final',
  final: 'Final',
}

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  for_checking: 'For checking',
  approved: 'Approved',
  rejected: 'Rejected',
  paid_at_venue: 'Paid at venue',
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  secretariat: 'Secretariat',
  scrutineer: 'Scrutineer',
  chairperson: 'Chairperson of Adjudicators',
  adjudicator: 'Adjudicator',
  athlete: 'Athlete',
  coach: 'Coach',
  team: 'Team',
  compere: 'Compere',
  barker: 'Barker',
  public: 'Public',
}

// Today as "YYYY-MM-DD" in local time, to compare with competition dates
export function todayIso() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// "10 October 2026"
export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

// "2026-10-10" -> { day: "10", month: "Oct", year: "2026" }
export function dateParts(iso: string) {
  const date = new Date(`${iso}T00:00:00`)
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString('en-GB', { month: 'short' }),
    year: String(date.getFullYear()),
  }
}

// ["A","B","C","E"] -> "A–C, E": a panel's letters as compact ranges
export function letterRanges(letters: string[]): string {
  const sorted = [...letters].sort()
  const groups: string[][] = []
  for (const letter of sorted) {
    const last = groups[groups.length - 1]
    if (last && letter.charCodeAt(0) === last[last.length - 1].charCodeAt(0) + 1) last.push(letter)
    else groups.push([letter])
  }
  return groups
    .map((g) => (g.length > 2 ? `${g[0]}–${g[g.length - 1]}` : g.join(', ')))
    .join(', ')
}

// "₱1,300"
export const formatPeso = (amount: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount)

// "10 Oct 2026, 2:30 pm"
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

// The event number as printed on sheets, e.g. E47
export const eventCode = (event: Pick<Event, 'number'>) => `E${event.number}`

export const eventDances = (event: Pick<Event, 'dances'>) =>
  event.dances.map((d) => DANCE_LABEL[d]).join(', ')

// The name of a built-in age group; screens use the admin's names from useCatalog
export const defaultAgeGroupLabel = (id: string) => ageGroupName(DEFAULT_AGE_GROUPS, id)

// "Junior I · E1 · Latin"
export const eventGrade = (event: Pick<Event, 'ageGroup' | 'class' | 'discipline'>, ageGroupLabel: (id: string) => string = defaultAgeGroupLabel) =>
  `${ageGroupLabel(event.ageGroup)} · ${event.class} · ${DISCIPLINE_LABEL[event.discipline]}`

export const competitorName = (names: string[]) => names.join(' & ')

// "Mia A. Santos" -> "MS"; a trailing year or number is ignored ("Naga Cup 2025" -> "NC")
export function initials(name: string): string {
  const parts = name
    .replace(/\./g, '')
    .split(/\s+/)
    .filter((part) => part && !/^\d+$/.test(part))
  if (parts.length === 0) return ''
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export function ordinal(n: number): string {
  const rest = n % 100
  if (rest >= 11 && rest <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`
}

// Shared places are stored as the lowest place number of the group: 7 is the semi-final, 13 and up earlier rounds
export function placeLabel(place: number): string {
  if (place <= 6) return ordinal(place)
  if (place === 7) return 'Semi-final'
  return 'Earlier round'
}

// A tie in a final as a range, "3rd–4th"; null when the place is not shared, or is from an earlier round
export function placeRange(r: { placeFrom?: number; placeTo?: number }): string | null {
  if (r.placeFrom === undefined || r.placeTo === undefined || r.placeTo <= r.placeFrom || r.placeFrom > 6) return null
  return `${ordinal(r.placeFrom)}–${ordinal(r.placeTo)}`
}

// "07:00" as "7:00 AM"; a dash until a start time is set
export function formatClock(time: string | null): string {
  if (!time) return '—'
  const [h, m] = time.split(':').map(Number) as [number, number]
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export const PROGRAM_KIND_LABEL = { round: 'Round', break: 'Break', awarding: 'Awarding' } as const

export const PROGRAM_STATUS_LABEL: Record<ProgramStatus, string> = {
  upcoming: '',
  next: 'Up next',
  current: 'On the floor',
  completed: 'Completed',
}

// What a program line is called in titles and messages
export const programLineName = (row: ProgramRow) =>
  row.kind === 'round' && row.eventNumber !== null && row.roundType
    ? `${eventCode({ number: row.eventNumber })} ${eventDances(row)} · ${ROUND_TYPE_LABEL[row.roundType]}`
    : (row.label ?? PROGRAM_KIND_LABEL[row.kind])

// What happens to the field in a round: "Select 24" while rounds remain, "Rank 6" in a final
export const programAction = (row: Pick<ProgramRow, 'kind' | 'recallNumber' | 'entryCount'>) =>
  row.kind !== 'round' ? '' : row.recallNumber !== null ? `Select ${row.recallNumber}` : `Rank ${row.entryCount}`

// "10/Oct/2026", as on the paper result sheets
export function sheetDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return `${String(d.getDate()).padStart(2, '0')}/${d.toLocaleDateString('en-GB', { month: 'short' })}/${d.getFullYear()}`
}
