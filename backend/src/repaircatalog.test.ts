import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { repairCatalogRefs } from './db/repair-catalog.ts'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp

beforeAll(async () => {
  app = await startTestApp({ seed: false })
})
afterAll(() => app.close())

describe('putting back catalog entries that rows still name', () => {
  it('restores a missing age group as retired and a missing kind, and does nothing the second time', () => {
    app.sqlite.prepare("insert into competitions (id, name, date, venue, organizer, image) values ('c1', 'C', '2099-01-01', 'V', 'O', 'x')").run()
    app.sqlite.prepare("insert into events (id, competition_id, number, position, age_group, class, discipline, dances, is_solo, kind, province) values ('e1', 'c1', 1, 1, 'juvenile_1', 'E1', 'latin', '[\"samba\"]', 1, 'standard', '')").run()
    app.sqlite.prepare("insert into events (id, competition_id, number, position, age_group, class, discipline, dances, is_solo, kind, province) values ('e2', 'c1', 2, 2, 'mystery_group', 'E1', 'latin', '[\"samba\"]', 1, 'odd_kind', '')").run()
    app.sqlite.prepare("delete from age_groups where id = 'juvenile_1'").run()
    app.sqlite.prepare("delete from event_kinds where id = 'standard'").run()

    const done = repairCatalogRefs(app.sqlite)
    expect(done.ageGroups.sort()).toEqual(['juvenile_1', 'mystery_group'])
    expect(done.kinds.sort()).toEqual(['odd_kind', 'standard'])

    const group = app.sqlite.prepare("select name, short, retired from age_groups where id = 'juvenile_1'").get() as { name: string; short: string; retired: number }
    expect(group).toEqual({ name: 'Juvenile 1', short: 'JUV 1', retired: 1 })
    expect(app.sqlite.prepare("select name from age_groups where id = 'mystery_group'").get()).toEqual({ name: 'Mystery group' })
    expect(app.sqlite.prepare("select name from event_kinds where id = 'standard'").get()).toEqual({ name: 'Standard' })

    expect(repairCatalogRefs(app.sqlite)).toEqual({ ageGroups: [], kinds: [] })
  })
})
