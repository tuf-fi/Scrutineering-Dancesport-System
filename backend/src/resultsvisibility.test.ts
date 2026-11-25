// A round's marks and recalls are for staff until it is published, whoever else is signed in
import { afterAll, beforeAll, expect, it } from 'vitest'
import { startTestApp } from './testing.ts'

let app: Awaited<ReturnType<typeof startTestApp>>
const outsiders: Array<[string, string | undefined]> = []
const staff: string[] = []
let round: { id: string; competition: string }
let recall: string

beforeAll(async () => {
  app = await startTestApp()
  outsiders.push(
    ['a visitor', undefined],
    ['an athlete', await app.signIn.athleteSignUp('Random Person', 'stranger@test.example', 'A-long-password1')],
    ['a coach', await app.signIn.memberSignUp('coach', 'Random Coach', 'coach-x@test.example', 'A-long-password1')],
    ['a team', await app.signIn.memberSignUp('team', 'Random Team', 'team-x@test.example', 'A-long-password1')],
  )
  for (const role of ['scrutineer', 'chairperson', 'secretariat']) staff.push(await app.signIn.staff(role))
  round = app.sqlite
    .prepare(
      `SELECT r.id, e.competition_id AS competition FROM rounds r JOIN events e ON e.id = r.event_id
       WHERE r.type = 'final' AND r.status = 'published' AND EXISTS (SELECT 1 FROM rounds s WHERE s.event_id = r.event_id AND s.type != 'final') LIMIT 1`,
    )
    .get() as typeof round
  recall = (app.sqlite.prepare("SELECT s.id FROM rounds s JOIN rounds f ON f.event_id = s.event_id WHERE f.id = ? AND s.type != 'final' LIMIT 1").get(round.id) as { id: string }).id
})
afterAll(() => app.close())

const statuses = async (name: string, id: string, cookies: Array<string | undefined>) =>
  Promise.all(cookies.map(async (c) => (await app.call(name, [id], c)).status))

it('keeps held results from everyone but staff', async () => {
  app.sqlite.prepare('UPDATE competitions SET hold_results = 1, results_revealed_at = NULL WHERE id = ?').run(round.competition)
  for (const [who, cookie] of outsiders) expect((await app.call('getSkatingTable', [round.id], cookie)).status, who).toBe(403)
  expect(await statuses('getSkatingTable', round.id, staff)).toEqual([200, 200, 200])
  app.sqlite.prepare('UPDATE competitions SET hold_results = 0 WHERE id = ?').run(round.competition)
  for (const [who, cookie] of outsiders) expect((await app.call('getSkatingTable', [round.id], cookie)).status, who).toBe(200)
})

it('keeps a round that is not published from everyone but staff', async () => {
  app.sqlite.prepare("UPDATE rounds SET status = 'review' WHERE id IN (?, ?)").run(round.id, recall)
  for (const [who, cookie] of outsiders) {
    expect((await app.call('getSkatingTable', [round.id], cookie)).status, who).toBe(403)
    expect((await app.call('getRecallTable', [recall], cookie)).status, who).toBe(403)
  }
  expect(await statuses('getRecallTable', recall, staff)).toEqual([200, 200, 200])
})
