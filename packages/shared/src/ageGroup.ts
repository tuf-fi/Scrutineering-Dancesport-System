import { DEFAULT_AGE_GROUPS, type AgeGroupDef } from './catalog.ts'
import type { AgeGroup } from './enums.ts'

// The age a dancer counts as in a competition is the competition's year minus the birth year. Each group has the oldest
// age that belongs to it (see DEFAULT_AGE_GROUPS for the organizer's 2026 groups); the admin keeps the list. The oldest
// group has no limit. TODO: WDSF also has Under 21, Senior I-IV (35, 45, 55, 65) and a minimum for the younger partner;
// none is modelled, as the forms stop at Youth.
export function ageGroupForAge(age: number, groups: AgeGroupDef[] = DEFAULT_AGE_GROUPS): AgeGroup | null {
  const current = groups.filter((g) => !g.retired)
  const bounded = current.filter((g) => g.oldestAge !== null).sort((a, b) => a.oldestAge! - b.oldestAge!)
  return bounded.find((g) => age <= g.oldestAge!)?.id ?? current.find((g) => g.oldestAge === null)?.id ?? null
}

// A solo dances in the dancer's own age group. A couple dances in its older partner's group or an older one, never a
// younger: a Junior and a Youth dancer are a Youth couple, so a Junior event is refused to them but an Adult one is not.
export function ageGroupFits(eventGroup: string, bracket: string, couple: boolean, groups: AgeGroupDef[] = DEFAULT_AGE_GROUPS): boolean {
  if (eventGroup === bracket) return true
  if (!couple) return false
  const limit = (id: string) => {
    const group = groups.find((g) => g.id === id)
    return group ? (group.oldestAge ?? Infinity) : null
  }
  const event = limit(eventGroup)
  const own = limit(bracket)
  return event !== null && own !== null && event >= own
}

// A couple dances in the group of the older partner. Years that are not sensible give null.
export function ageGroupForBirthYears(birthYears: number[], competitionYear: number, groups: AgeGroupDef[] = DEFAULT_AGE_GROUPS): AgeGroup | null {
  if (birthYears.length === 0) return null
  const ages = birthYears.map((year) => competitionYear - year)
  if (ages.some((age) => !Number.isInteger(age) || age < 3 || age > 100)) return null
  return ageGroupForAge(Math.max(...ages), groups)
}
