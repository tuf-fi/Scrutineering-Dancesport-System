import { DEFAULT_AGE_GROUPS, byAge, type AgeGroupDef } from './catalog.ts'
import type { AgeGroup } from './enums.ts'

// A group covers the dancers born in its years, whatever year the competition is in (see DEFAULT_AGE_GROUPS for the
// organizer's 2026 groups); the admin keeps the list and changes the years when a new season starts. Groups may overlap:
// the youngest one that holds the year wins. TODO: WDSF also has Under 21, Senior I-IV (35, 45, 55, 65) and a minimum for
// the younger partner; none is modelled, as the forms stop at Youth.
export function ageGroupForBirthYear(year: number, groups: AgeGroupDef[] = DEFAULT_AGE_GROUPS): AgeGroup | null {
  return [...groups]
    .filter((g) => !g.retired)
    .sort(byAge)
    .find((g) => (g.bornFrom === null || year >= g.bornFrom) && (g.bornTo === null || year <= g.bornTo))?.id ?? null
}

// A solo dances in the dancer's own age group. A couple dances in its older partner's group or an older one, never a
// younger: a Junior and a Youth dancer are a Youth couple, so a Junior event is refused to them but an Adult one is not.
export function ageGroupFits(eventGroup: string, bracket: string, couple: boolean, groups: AgeGroupDef[] = DEFAULT_AGE_GROUPS): boolean {
  if (eventGroup === bracket) return true
  if (!couple) return false
  // How far back the group's dancers were born; the one reaching back further is the older
  const start = (id: string) => {
    const group = groups.find((g) => g.id === id)
    return group ? (group.bornFrom ?? -Infinity) : null
  }
  const event = start(eventGroup)
  const own = start(bracket)
  return event !== null && own !== null && event <= own
}

// A couple dances in the group of the older partner. Years that are not sensible give null.
export function ageGroupForBirthYears(birthYears: number[], groups: AgeGroupDef[] = DEFAULT_AGE_GROUPS): AgeGroup | null {
  if (birthYears.length === 0) return null
  if (birthYears.some((year) => !Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() - 3)) return null
  return ageGroupForBirthYear(Math.min(...birthYears), groups)
}
