import { AgeGroup, ageGroupForBirthYear, ageGroupForBirthYears } from '@bis/shared'
import { describe, expect, it } from 'vitest'

describe('age group from birth years', () => {
  it('matches the birth years on the 2026 entry forms, at the edges too', () => {
    const forms: Array<[number, AgeGroup]> = [
      [2022, AgeGroup.Juvenile1],
      [2017, AgeGroup.Juvenile1],
      [2016, AgeGroup.Juvenile2],
      [2015, AgeGroup.Juvenile2],
      [2014, AgeGroup.Junior1],
      [2013, AgeGroup.Junior1],
      [2012, AgeGroup.Junior2],
      [2011, AgeGroup.Junior2],
      [2010, AgeGroup.Youth],
      [2008, AgeGroup.Youth],
      [2007, AgeGroup.Adult],
      [1992, AgeGroup.Adult],
      [1991, AgeGroup.Senior],
      [1950, AgeGroup.Senior],
    ]
    for (const [year, group] of forms) expect(ageGroupForBirthYear(year), `born ${year}`).toBe(group)
  })

  it('puts a couple in the group of the older partner', () => {
    expect(ageGroupForBirthYears([2014, 2000])).toBe(AgeGroup.Adult)
    expect(ageGroupForBirthYears([2012, 2013])).toBe(AgeGroup.Junior2)
  })

  it('refuses years that cannot be right', () => {
    expect(ageGroupForBirthYears([])).toBeNull()
    expect(ageGroupForBirthYears([new Date().getFullYear()])).toBeNull()
    expect(ageGroupForBirthYears([1800])).toBeNull()
    expect(ageGroupForBirthYears([2100])).toBeNull()
    expect(ageGroupForBirthYears([Number.NaN])).toBeNull()
  })
})
