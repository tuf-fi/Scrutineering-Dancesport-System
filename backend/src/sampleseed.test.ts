// The full sample data, as `pnpm seed` loads it, can be tried out: every event has a fee
import { afterAll, expect, it } from 'vitest'
import { addSampleAthleteData, addSampleCompetitorData, addSampleEntryData, addSamplePanels, addSampleUpcoming } from './db/seed.ts'
import { startTestApp } from './testing.ts'

let app: Awaited<ReturnType<typeof startTestApp>>
afterAll(() => app.close())

it('leaves no sample event without a fee, even when it is loaded twice', async () => {
  app = await startTestApp()
  for (let run = 0; run < 2; run++) {
    for (const add of [addSampleUpcoming, addSampleAthleteData, addSampleCompetitorData, addSampleEntryData, addSamplePanels]) add(app.db)
  }
  expect(app.sqlite.prepare('SELECT competition_id, number FROM events WHERE fee_id IS NULL').all()).toEqual([])
})
