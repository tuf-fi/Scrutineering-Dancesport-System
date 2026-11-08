import { ageGroupFits, ageGroupForBirthYears } from './ageGroup.ts'
import { DEFAULT_CATALOG, FeeMode, KIND_FIELD_LABEL, KindField, ageGroupName, eventKindName, kindOf, type Catalog } from './catalog.ts'
import type { CompetitorDetails, Event, FeeLine, FeeSchedule, FeeTier } from './types.ts'

// The organizer's 2026 entry form (Bicol Grassroots). Used until the organizer saves a schedule of their own.
export const DEFAULT_FEE_SCHEDULE: FeeSchedule = {
  soloJuvenile: { first: 400, additional: 200 },
  soloOlder: { first: 600, additional: 200 },
  coupleJuvenile: { first: 700, additional: 200 },
  coupleOlder: { first: 850, additional: 250 },
  fixed: 1000,
  athleteMembership: 500,
  coachMembership: 1000,
  coachesSummit: 1000,
}

type FeeEvent = Pick<Event, 'number' | 'isSolo' | 'ageGroup' | 'kind'>

// A kind's fee mode decides: fixed events have one price, the school events follow a couple tier by level, and the
// rest follow the age group's tier. A kind that is not in the catalog is priced as a standard event.
function tierOf(schedule: FeeSchedule, event: FeeEvent, catalog: Catalog): FeeTier | null {
  switch (kindOf(catalog.kinds, event.kind)?.feeMode ?? FeeMode.Standard) {
    case FeeMode.Fixed:
      return null
    case FeeMode.CoupleJuvenile:
      return schedule.coupleJuvenile
    case FeeMode.CoupleOlder:
      return schedule.coupleOlder
    default:
      if (catalog.ageGroups.find((g) => g.id === event.ageGroup)?.juvenileFee) return event.isSolo ? schedule.soloJuvenile : schedule.coupleJuvenile
      return event.isSolo ? schedule.soloOlder : schedule.coupleOlder
  }
}

// Whether an event is charged the one fixed price, so it does not count as a dancer's first or additional entry
export const isFixedFee = (catalog: Catalog, kind: string | undefined) => kindOf(catalog.kinds, kind)?.feeMode === FeeMode.Fixed

// What one dancer or couple pays for a set of events: the first entry at a tier's full price, every other
// entry at its additional price, ranking and inter-collegiate events at the fixed price, and membership for
// every athlete who has not paid it this year, and the coach's own fees when they are being collected. Entries the dancer or couple already has in this competition
// count as the first, so a later entry is charged as an additional one.
export function registrationFee(
  schedule: FeeSchedule,
  events: FeeEvent[],
  newMembers: number,
  priorEntries = 0,
  coach: { membership: boolean; summit: boolean } = { membership: false, summit: false },
  catalog: Catalog = DEFAULT_CATALOG,
): { lines: FeeLine[]; total: number } {
  const lines: FeeLine[] = []
  let first = priorEntries === 0
  for (const event of [...events].sort((a, b) => a.number - b.number)) {
    const tier = tierOf(schedule, event, catalog)
    const code = `E${event.number}`
    if (!tier) {
      lines.push({ label: `${code} entry`, amount: schedule.fixed })
      continue
    }
    lines.push({ label: first ? `${code} entry` : `${code} additional entry`, amount: first ? tier.first : tier.additional })
    first = false
  }
  if (newMembers > 0) {
    lines.push({
      label: newMembers === 1 ? 'Athlete membership' : `Athlete membership × ${newMembers}`,
      amount: schedule.athleteMembership * newMembers,
    })
  }
  if (coach.membership) lines.push({ label: 'Coach membership', amount: schedule.coachMembership })
  if (coach.summit) lines.push({ label: 'Coaches Summit', amount: schedule.coachesSummit })
  return { lines, total: lines.reduce((sum, l) => sum + l.amount, 0) }
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
  const bornIn = birthYears.length === names ? ageGroupForBirthYears(birthYears, catalog.ageGroups) : null
  const missing = (field: KindField) => {
    if (field === KindField.Membership) return details !== undefined && newMembers > 0
    const key = { [KindField.BirthDate]: 'birthDate', [KindField.Address]: 'address', [KindField.Email]: 'email', [KindField.Phone]: 'phone' }[field]
    return Array.from({ length: names }, (_, i) => details?.dancers[i]?.[key as 'birthDate']?.trim()).some((v) => !v)
  }
  for (const event of events) {
    const code = `E${event.number}`
    const kind = kindOf(catalog.kinds, event.kind)
    if (details && details.beginner && !kind?.beginnersOnly) {
      warnings.push(`${code}: a beginner (BGB) athlete may not enter solo, couples or ranking events.`)
    }
    if (details && !details.beginner && kind?.beginnersOnly) {
      warnings.push(`${code} is for beginners. This entry is not marked as a beginner.`)
    }
    if (kind?.closedToProvince && !sameProvince(details?.province, event.province)) {
      warnings.push(`${code} is closed to ${event.province}. This entry is from ${details?.province?.trim() || 'no province'}, so it cannot be entered.`)
    }
    for (const field of kind?.requires ?? []) {
      if (missing(field)) warnings.push(`${code} (${eventKindName(catalog.kinds, event.kind ?? '')}) needs the ${KIND_FIELD_LABEL[field]} of every dancer.`)
    }
    if (bornIn && !ageGroupFits(event.ageGroup, bornIn, names > 1, catalog.ageGroups)) {
      warnings.push(`${code} is ${ageGroupName(catalog.ageGroups, event.ageGroup)}, but the birth dates make this ${ageGroupName(catalog.ageGroups, bornIn)}.`)
    }
  }
  return warnings
}
