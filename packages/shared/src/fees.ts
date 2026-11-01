import { ageGroupForBirthYears } from './ageGroup.ts'
import { AgeGroup, EventKind } from './enums.ts'
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

const JUVENILE: string[] = [AgeGroup.Juvenile1, AgeGroup.Juvenile2]

type FeeEvent = Pick<Event, 'number' | 'isSolo' | 'ageGroup' | 'kind'>

// Inter-collegiate and ranking events have one price; the school events follow the couple tiers by level
function tierOf(schedule: FeeSchedule, event: FeeEvent): FeeTier | null {
  switch (event.kind) {
    case EventKind.Ranking:
    case EventKind.InterCollegiate:
      return null
    case EventKind.InterElementary:
      return schedule.coupleJuvenile
    case EventKind.InterHighSchool:
      return schedule.coupleOlder
    default:
      if (JUVENILE.includes(event.ageGroup)) return event.isSolo ? schedule.soloJuvenile : schedule.coupleJuvenile
      return event.isSolo ? schedule.soloOlder : schedule.coupleOlder
  }
}

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
): { lines: FeeLine[]; total: number } {
  const lines: FeeLine[] = []
  let first = priorEntries === 0
  for (const event of [...events].sort((a, b) => a.number - b.number)) {
    const tier = tierOf(schedule, event)
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

const words = (group: string) => group.replace('_', ' ')

// What the secretariat should look at before entering a dancer or couple: beginner rules and age. They warn and
// never stop an entry.
export function registrationWarnings(
  details: CompetitorDetails | undefined,
  names: number,
  events: Array<Pick<Event, 'number' | 'ageGroup' | 'kind' | 'province'>>,
  competitionYear: number,
): string[] {
  const warnings: string[] = []
  const birthYears = (details?.dancers ?? []).map((d) => Number(d.birthDate.slice(0, 4))).filter((y) => y > 0)
  const bornIn = birthYears.length === names ? ageGroupForBirthYears(birthYears, competitionYear) : null
  for (const event of events) {
    const code = `E${event.number}`
    if (details && details.beginner && event.kind !== EventKind.Beginners) {
      warnings.push(`${code}: a beginner (BGB) athlete may not enter solo, couples or ranking events.`)
    }
    if (details && !details.beginner && event.kind === EventKind.Beginners) {
      warnings.push(`${code} is for beginners. This entry is not marked as a beginner.`)
    }
    if (event.kind === EventKind.Closed && !sameProvince(details?.province, event.province)) {
      warnings.push(`${code} is closed to ${event.province}. This entry is from ${details?.province?.trim() || 'no province'}, so it cannot be entered.`)
    }
    if (bornIn && bornIn !== event.ageGroup) {
      warnings.push(`${code} is ${words(event.ageGroup)}, but the birth dates make this ${words(bornIn)}.`)
    }
  }
  return warnings
}
