import { ProgramStatus, type Announcement, type Program } from '@bis/shared'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hashPassword } from './auth/password.ts'
import { addProgramDemo } from './db/programdemo.ts'
import * as t from './db/schema.ts'
import { startTestApp, type TestApp } from './testing.ts'

let app: TestApp
let scrutineer: string

beforeAll(async () => {
  app = await startTestApp({ seed: false })
  app.db.insert(t.staffUsers).values({ id: 's1', name: 'Scrutineer', username: 'scrutineer@sample.example', role: 'scrutineer', passwordHash: hashPassword('pw-scrutineer'), disabled: false }).run()
  scrutineer = await app.signIn.staff('scrutineer', 'pw-scrutineer')
  addProgramDemo(app.db)
})
afterAll(() => app.close())

describe('program demo', () => {
  it('shows finished, on the floor, next and waiting lines', async () => {
    const program = await app.ok<Program>('getProgram', ['td-program-demo'])
    const states = program.rows.map((r) => r.status)
    expect(states[0]).toBe(ProgramStatus.Completed)
    expect(states[1]).toBe(ProgramStatus.Completed)
    expect(states[2]).toBe(ProgramStatus.Current)
    expect(states[3]).toBe(ProgramStatus.Next)
    expect(states.at(-1)).toBe(ProgramStatus.Upcoming)
  })

  it('names the couples and their teams on a semi-final call', async () => {
    const list = await app.ok<Announcement[]>('getAnnouncements', [], scrutineer)
    const call = list.find((a) => a.kind === 'call' && a.roundType === 'semi_final')!
    expect(call.numbers).toHaveLength(8)
    expect(call.entries).toHaveLength(8)
    expect(call.entries[0]).toMatchObject({ names: ['Bianca Alcantara', 'Rafael Briones'], teamName: 'Naga Dance Studio' })
  })
})
