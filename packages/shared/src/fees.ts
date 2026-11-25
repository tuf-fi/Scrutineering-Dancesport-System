import { birthYearsFit } from './ageGroup.ts'
import { DEFAULT_CATALOG, KIND_FIELD_LABEL, KindField, eventKindName, kindOf, type Catalog, type Checked } from './catalog.ts'
import type { CompetitorDetails, Event, FeeItem, FeeItemInput, FeeLine, MembershipFees } from './types.ts'

// What a new database charges until the organizer changes it
export const DEFAULT_MEMBERSHIP_FEES: MembershipFees = { athlete: 500, coach: 1000, summit: 1000 }

type FeeEvent = Pick<Event, 'number' | 'feeId'> & { id?: string }

export const feeOf = (fees: FeeItem[], event: Pick<Event, 'feeId'>) => fees.find((f) => f.id === event.feeId)

// Whether an entry at this price counts as a dancer's first, so that later ones are charged as extra
export const hasExtraPrice = (fees: FeeItem[], event: Pick<Event, 'feeId'>) => (feeOf(fees, event)?.extra ?? null) !== null

// The events of a set that no fee prices yet
export const unpricedEvents = <E extends FeeEvent>(fees: FeeItem[], events: E[]) => events.filter((e) => !feeOf(fees, e))

export const unpricedMessage = (events: Array<Pick<Event, 'number'>>) =>
  `No fee is set for ${events.map((e) => `E${e.number}`).join(', ')}. Set it under Fees and payment details.`

export const lateEntryFee = (fee: FeeItem, priorEntries = 0) => fee.late ?? (priorEntries > 0 ? (fee.extra ?? fee.amount) : fee.amount)

// What one dancer or couple pays for a set of events. A fee with an extra price charges the first such entry in full
// and the others at that price; a fee without one always charges in full. Then membership for every athlete who has
// not paid it this year, and the coach's own fees when they are being collected. priorEntries counts the entries with an
// extra price the dancer or couple already has in this competition. Events no fee prices are left out.
export function registrationFee(
  fees: FeeItem[],
  events: FeeEvent[],
  memberships: MembershipFees,
  newMembers: number,
  priorEntries = 0,
  coach: { membership: boolean; summit: boolean } = { membership: false, summit: false },
): { lines: FeeLine[]; total: number } {
  const lines: FeeLine[] = []
  let first = priorEntries === 0
  for (const event of [...events].sort((a, b) => a.number - b.number)) {
    const fee = feeOf(fees, event)
    if (!fee) continue
    const code = `E${event.number}`
    const of = event.id ? { eventId: event.id } : {}
    if (fee.extra === null) {
      lines.push({ ...of, label: `${code} entry`, amount: fee.amount })
      continue
    }
    lines.push({ ...of, label: first ? `${code} entry` : `${code} additional entry`, amount: first ? fee.amount : fee.extra })
    first = false
  }
  const charge = (label: string, amount: number) => {
    if (amount > 0) lines.push({ label, amount })
  }
  if (newMembers > 0) charge(newMembers === 1 ? 'Athlete membership' : `Athlete membership × ${newMembers}`, memberships.athlete * newMembers)
  if (coach.membership) charge('Coach membership', memberships.coach)
  if (coach.summit) charge('Coaches Summit', memberships.summit)
  return { lines, total: lines.reduce((sum, l) => sum + l.amount, 0) }
}

export const isPesoAmount = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100_000

// others are the competition's fees apart from the one being edited
export function checkFee(input: FeeItemInput | undefined, others: FeeItem[]): Checked<Omit<FeeItem, 'id' | 'competitionId'>> {
  const name = typeof input?.name === 'string' ? input.name.trim() : ''
  if (!input || !name) return { error: 'Enter the name of the fee.', status: 400 }
  if (name.length > 80) return { error: 'The name is too long. Use up to 80 characters.', status: 400 }
  const optional = (value: unknown) => value === null || isPesoAmount(value)
  if (!isPesoAmount(input.amount) || !optional(input.extra) || !optional(input.late)) return { error: 'Enter every price as whole pesos.', status: 400 }
  if (!Array.isArray(input.eventIds)) return { error: 'Choose the events this fee applies to.', status: 400 }
  if (others.some((f) => f.name.toLowerCase() === name.toLowerCase())) return { error: 'This competition already has a fee with this name.', status: 409 }
  return { values: { name, amount: input.amount, extra: input.extra, late: input.late } }
}

// A closed event is for one province; compared without caring about case or spaces
export const sameProvince = (a: string | undefined, b: string | undefined) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

// What the secretariat should look at before entering a dancer or couple: the kind's rules and age. They warn and
// never stop an entry. newMembers is how many of the dancers still owe this year's membership.
export function registrationWarnings(
  details: CompetitorDetails | undefined,
  names: number,
  events: Array<Pick<Event, 'number' | 'ageGroup' | 'kind' | 'province'>>,
  catalog: Catalog = DEFAULT_CATALOG,
  newMembers = 0,
): string[] {
  const warnings: string[] = []
  const birthYears = (details?.dancers ?? []).map((d) => Number(d.birthDate.slice(0, 4))).filter((y) => y > 0)
  const missing = (field: KindField) => {
    if (field === KindField.Membership) return details !== undefined && newMembers > 0
    const key = { [KindField.BirthDate]: 'birthDate', [KindField.Address]: 'address', [KindField.Email]: 'email', [KindField.Phone]: 'phone' }[field]
    return Array.from({ length: names }, (_, i) => details?.dancers[i]?.[key as 'birthDate']?.trim()).some((v) => !v)
  }
  for (const event of events) {
    const code = `E${event.number}`
    const kind = kindOf(catalog.kinds, event.kind)
    if (kind?.closedToProvince && !sameProvince(details?.province, event.province)) {
      warnings.push(`${code} is closed to ${event.province}. This entry is from ${details?.province?.trim() || 'no province'}, so it cannot be entered.`)
    }
    for (const field of kind?.requires ?? []) {
      if (missing(field)) warnings.push(`${code} (${eventKindName(catalog.kinds, event.kind ?? '')}) needs the ${KIND_FIELD_LABEL[field]} of every dancer.`)
    }
    const age = birthYears.length === names ? birthYearsFit(event.ageGroup, birthYears, names > 1, catalog.ageGroups) : null
    if (age && !age.fits) warnings.push(`${code}: ${age.message}`)
  }
  return warnings
}
