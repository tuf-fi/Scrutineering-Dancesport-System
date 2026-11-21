import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanSlate, countCleanSlate } from './db/clean-slate.ts'
import { addTestData } from './db/testdata.ts'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp

beforeAll(async () => {
  app = await startTestApp()
  addTestData(app.db)
})
afterAll(() => app.close())

describe('a clean slate', () => {
  it('removes the competitions and the people, keeps staff and adjudicators, and can reset the catalog', () => {
    const before = countCleanSlate(app.sqlite)
    expect(before.competitions).toBeGreaterThan(0)
    expect(before.competitors).toBeGreaterThan(0)
    app.sqlite.prepare("delete from age_groups where id = 'adult'").run()
    const staff = (app.sqlite.prepare('select count(*) as n from staff_users').get() as { n: number }).n
    const adjudicators = (app.sqlite.prepare('select count(*) as n from adjudicators').get() as { n: number }).n

    cleanSlate(app.sqlite, { catalog: true })

    const after = countCleanSlate(app.sqlite)
    expect(Object.values(after).every((n) => n === 0)).toBe(true)
    expect((app.sqlite.prepare('select count(*) as n from staff_users').get() as { n: number }).n).toBe(staff)
    expect((app.sqlite.prepare('select count(*) as n from adjudicators').get() as { n: number }).n).toBe(adjudicators)
    expect((app.sqlite.prepare('select count(*) as n from age_groups where retired = 0').get() as { n: number }).n).toBe(7)
    expect(app.sqlite.prepare("select name from age_groups where id = 'adult'").get()).toEqual({ name: 'Adult' })
    expect(app.sqlite.pragma('foreign_key_check')).toEqual([])
  })
})
