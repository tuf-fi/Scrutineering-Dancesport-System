import { AgeGroup } from './enums.ts'

// The age a dancer counts as in a competition is the competition's year minus the birth year. The oldest age that
// belongs to each group, from the organizer's 2026 entry forms (Juvenile 1 born 2017 or later, Juvenile 2 2015-2016,
// Junior 1 2013-2014, Junior 2 2011-2012, Youth 2008-2010). They are the only place to change. Adult and Senior follow
// WDSF Competition Rules 2018, E.2: Adult 19 and over (Youth ends at 18), Senior from 35. TODO: WDSF also has Under 21,
// Senior I-IV (35, 45, 55, 65) and a minimum for the younger partner; none is modelled, as the forms stop at Youth.
export const OLDEST_IN_GROUP: ReadonlyArray<readonly [AgeGroup, number]> = [
  [AgeGroup.Juvenile1, 9],
  [AgeGroup.Juvenile2, 11],
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
