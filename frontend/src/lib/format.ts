import type {
  AgeGroup,
  Dance,
  Discipline,
  Event,
  PaymentStatus,
  Role,
  RoundType,
} from '@bis/shared'

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  juvenile: 'Juvenile',
  junior_1: 'Junior I',
  junior_2: 'Junior II',
  youth: 'Youth',
  adult: 'Adult',
  senior: 'Senior',
}

// As printed on result sheets, e.g. "JUN 1 - E1"
export const AGE_GROUP_SHORT: Record<AgeGroup, string> = {
  juvenile: 'JUV',
  junior_1: 'JUN 1',
  junior_2: 'JUN 2',
  youth: 'YTH',
  adult: 'ADT',
  senior: 'SEN',
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
  mc: 'MC',
  club: 'Club',
  public: 'Public',
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

// "Junior I · E1 · Latin"
export const eventGrade = (event: Pick<Event, 'ageGroup' | 'class' | 'discipline'>) =>
  `${AGE_GROUP_LABEL[event.ageGroup]} · ${event.class} · ${DISCIPLINE_LABEL[event.discipline]}`

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
