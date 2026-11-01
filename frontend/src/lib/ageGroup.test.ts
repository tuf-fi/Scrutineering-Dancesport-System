import { AgeGroup, ageGroupForAge, ageGroupForBirthYears } from '@bis/shared'
import { describe, expect, it } from 'vitest'

describe('age group from birth years', () => {
  it('puts each age in its group, at the edges too', () => {
    const edges: Array<[number, AgeGroup]> = [
      [6, AgeGroup.Juvenile1],
      [9, AgeGroup.Juvenile1],
      [10, AgeGroup.Juvenile2],
      [11, AgeGroup.Juvenile2],
      [12, AgeGroup.Junior1],
      [13, AgeGroup.Junior1],
      [14, AgeGroup.Junior2],
      [15, AgeGroup.Junior2],
      [16, AgeGroup.Youth],
      [18, AgeGroup.Youth],
      [19, AgeGroup.Adult],
      [34, AgeGroup.Adult],
      [35, AgeGroup.Senior],
      [60, AgeGroup.Senior],
    ]
    for (const [age, group] of edges) expect(ageGroupForAge(age), `age ${age}`).toBe(group)
  })

  it('counts age as the competition year minus the birth year', () => {
    expect(ageGroupForBirthYears([2014], 2026)).toBe(AgeGroup.Junior1)
    expect(ageGroupForBirthYears([2015], 2026)).toBe(AgeGroup.Juvenile2)
  })

  it('matches the birth years on the 2026 entry forms', () => {
    const forms: Array<[number, AgeGroup]> = [
      [2017, AgeGroup.Juvenile1],
      [2016, AgeGroup.Juvenile2],
      [2015, AgeGroup.Juvenile2],
      [2014, AgeGroup.Junior1],
      [2013, AgeGroup.Junior1],
      [2012, AgeGroup.Junior2],
      [2011, AgeGroup.Junior2],
      [2010, AgeGroup.Youth],
      [2008, AgeGroup.Youth],
    ]
    for (const [year, group] of forms) expect(ageGroupForBirthYears([year], 2026), `born ${year}`).toBe(group)
  })

  it('puts a couple in the group of the older partner', () => {
    expect(ageGroupForBirthYears([2014, 2000], 2026)).toBe(AgeGroup.Adult)
    expect(ageGroupForBirthYears([2012, 2013], 2026)).toBe(AgeGroup.Junior2)
  })

  it('refuses years that cannot be right', () => {
    expect(ageGroupForBirthYears([], 2026)).toBeNull()
    expect(ageGroupForBirthYears([2026], 2026)).toBeNull()
    expect(ageGroupForBirthYears([1800], 2026)).toBeNull()
    expect(ageGroupForBirthYears([2030], 2026)).toBeNull()
    expect(ageGroupForBirthYears([Number.NaN], 2026)).toBeNull()
  })
})
