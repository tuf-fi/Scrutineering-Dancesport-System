import { AgeGroup } from './enums.ts'

// The age a dancer counts as in a competition is the competition's year minus the birth year. The oldest age that
// belongs to each group, from the WDSF age divisions as the organizer described them. TODO: confirm these limits (and
// whether Juvenile is split in two) with the organizer; they are the only place to change.
export const OLDEST_IN_GROUP: ReadonlyArray<readonly [AgeGroup, number]> = [
  [AgeGroup.Juvenile, 11],
  [AgeGroup.Junior1, 13],
  [AgeGroup.Junior2, 15],
  [AgeGroup.Youth, 18],
  [AgeGroup.Adult, 34],
]

export function ageGroupForAge(age: number): AgeGroup {
  return OLDEST_IN_GROUP.find(([, oldest]) => age <= oldest)?.[0] ?? AgeGroup.Senior
}

// A couple dances in the group of the older partner. Years that are not sensible give null.
export function ageGroupForBirthYears(birthYears: number[], competitionYear: number): AgeGroup | null {
  if (birthYears.length === 0) return null
  const ages = birthYears.map((year) => competitionYear - year)
  if (ages.some((age) => !Number.isInteger(age) || age < 3 || age > 100)) return null
  return ageGroupForAge(Math.max(...ages))
}
