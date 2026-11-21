// Builds ONE competition that shows every state the system can be in, through the real API so the data is consistent.
//
//   pnpm --filter @bis/backend db:clean-slate -- --yes --catalog     (the server can stay up)
//   pnpm --filter @bis/backend db:scenario                          (needs the server running; pass another address as an argument)
//
// It needs the staff accounts and the ten adjudicators of the sample database (password bis2026). It signs in as each role
// and does what that role would do, from the first team to the awarding line of the program.
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { samplePhoto } from '@bis/shared'
import { hashPassword } from '../src/auth/password.ts'
import { sampleCompetitionImage } from '../src/db/seed.ts'

const BASE = process.argv[2] ?? 'http://localhost:4000'
const require = createRequire(resolve(import.meta.dirname, '..', 'package.json'))
const DATABASE = process.env.DATABASE_PATH ?? resolve(import.meta.dirname, '..', 'data', 'bis.db')
const Database = require('better-sqlite3')
const PASSWORD = 'bis2026'
const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
const daysAgo = (n) => new Date(Date.now() + 8 * 3_600_000 - n * 86_400_000).toISOString().slice(0, 10)
const log = (...a) => console.log(...a)

// ------------------------------------------------------------------------------------------------------ plumbing
async function post(path, body, cookie) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`${path}: ${r.status} ${j.error ?? ''}`)
  return { j, cookie: (r.headers.get('set-cookie') ?? '').split(';')[0] }
}
const call = async (name, args = [], cookie) => (await post('/api/call/' + name, { args }, cookie)).j.data
const tryCall = async (name, args, cookie) => call(name, args, cookie).then(() => null, (e) => e.message)
const staff = async (user) => (await post('/api/auth/staff', { username: `${user}@sample.example`, password: PASSWORD })).cookie
const phoneOf = async (pin) => (await post('/api/auth/adjudicator', { pin })).cookie

const rng = (seed) => () => ((seed = (seed + 0x6d2b79f5) | 0), (Math.imul(seed ^ (seed >>> 15), 1 | seed) ^ 0) / 2 ** 32 + 0.5)
const rand = rng(2026)
const skill = new Map()
const q = (id) => (skill.has(id) ? skill.get(id) : (skill.set(id, rand() * 10), skill.get(id)))

const FIRST = ['Aira', 'Bea', 'Carlo', 'Dino', 'Ella', 'Franco', 'Gwen', 'Hugo', 'Isla', 'Jules', 'Kira', 'Luis', 'Mara', 'Nico', 'Olga', 'Pio', 'Rina', 'Sean', 'Tess', 'Uriel', 'Vera', 'Wes', 'Xia', 'Yani', 'Zoe', 'Ariel', 'Brent', 'Cleo', 'Dana', 'Eli', 'Faye', 'Gio', 'Hazel', 'Ivo', 'Joy', 'Kai', 'Lia', 'Migs', 'Nina', 'Oscar', 'Pia', 'Rico', 'Sol', 'Tito', 'Una', 'Vic', 'Wynn', 'Yna', 'Zed', 'Amiel']
const LAST = ['Alonzo', 'Bagasbas', 'Cordial', 'Dayao', 'Espiritu', 'Fuentes', 'Gamboa', 'Hernando', 'Ibarra', 'Jimenez', 'Lacson', 'Madrid', 'Nolasco', 'Ong', 'Pelayo', 'Quiambao', 'Rosales', 'Soriano', 'Tabuena', 'Ubaldo', 'Vasquez', 'Yulo', 'Zamora', 'Abad', 'Bautista', 'Cruz', 'Dizon', 'Estrada', 'Fabian', 'Garcia', 'Hizon', 'Jacinto', 'Lagman', 'Navarro', 'Ocampo', 'Panganiban', 'Reyes', 'Salvador', 'Tolentino', 'Umali']
let seq = 0
const nextName = () => `${FIRST[seq % FIRST.length]} ${LAST[(seq++ * 7 + 3) % LAST.length]}`
const dancer = (year, gender) => {
  const i = seq
  return { birthDate: `${year}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + ((i * 3) % 27)).padStart(2, '0')}`, gender, address: `${10 + (i % 90)} Rizal St, Naga City`, email: `dancer${i}@scenario.example`, phone: `0917 ${String(1000000 + i * 137).slice(0, 3)} ${String(1000 + i * 7).slice(0, 4)}` }
}

// ------------------------------------------------------------------------------------------------------ sign in
const admin = await staff('admin')
const sec = await staff('secretariat')
const scr = await staff('scrutineer')
const chair = await staff('chairperson')
const compere = await staff('compere')
for (const c of [scr, chair]) if ((await call('getMySignature', [], c)) === null) await call('saveMyStaffSignature', ['data:image/png;base64,iVBORw0KGgo='], c)
log('signed in as admin, secretariat, scrutineer, chairperson, compere')

// The barker is not in the sample database: the admin makes the account, and it gets the sample password like the others
if (!(await call('getStaffUsers', [], admin)).some((u) => u.username === 'barker@sample.example')) {
  await call('createStaffUser', [{ name: 'Ruben Soriano', username: 'barker@sample.example', role: 'barker', photo: samplePhoto('Ruben Soriano') }], admin)
  const db = new Database(DATABASE)
  db.prepare('UPDATE staff_users SET password_hash = ? WHERE username = ?').run(hashPassword(PASSWORD), 'barker@sample.example')
  db.close()
}

const adjudicators = (await call('getAdjudicators', [], admin)).sort((a, b) => a.letter.localeCompare(b.letter))
if (adjudicators.length < 10) throw new Error('The ten sample adjudicators are missing: run db:seed on a fresh database first')
const adj = (letters) => letters.split('').map((l) => adjudicators.find((a) => a.letter === l).id)

// ------------------------------------------------------------------------------------------------------ settings
const settings = await call('getPaymentSettings', [], admin)
if (!settings.fees || settings.methods.length === 0) {
  await call('savePaymentSettings', [{ ...settings, fees: settings.fees ?? { solo: 500, couple: 800 }, methods: settings.methods.length ? settings.methods : [{ name: 'GCash', accountName: 'BN IT Scrutineer', number: '0917 000 0000' }, { name: 'Maya', accountName: 'BN IT Scrutineer', number: '0918 000 0000' }, { name: 'BDO', accountName: 'BN IT Scrutineer', number: '0012 3456 7890' }] }], admin)
}

// ------------------------------------------------------------------------------------------------------ the competition
const comp = await call('saveCompetition', [{
  name: 'Bicol Grand Prix 2026',
  date: today,
  venue: 'Naga City Coliseum, Naga City',
  organizer: 'Camarines Sur Dancesport Association',
  executor: 'BIS Scrutineering Team',
  entryDeadline: daysAgo(14),
  feeDeadline: daysAgo(7),
  image: sampleCompetitionImage(),
  paymentRequired: true,
  holdResults: true,
}], admin)
log('competition', comp.id)

const EVENTS = [
  { number: 1, ageGroup: 'juvenile_1', class: 'E1', discipline: 'latin', dances: ['cha_cha_cha', 'rumba', 'jive'], isSolo: true, kind: 'standard' },
  { number: 2, ageGroup: 'juvenile_2', class: 'E1', discipline: 'standard', dances: ['waltz', 'quickstep'], isSolo: true, kind: 'standard' },
  { number: 3, ageGroup: 'junior_1', class: 'D', discipline: 'latin', dances: ['samba', 'cha_cha_cha', 'rumba', 'paso_doble', 'jive'], isSolo: false, kind: 'standard' },
  { number: 4, ageGroup: 'junior_2', class: 'C', discipline: 'standard', dances: ['waltz', 'tango', 'quickstep'], isSolo: false, kind: 'standard' },
  { number: 5, ageGroup: 'youth', class: 'B', discipline: 'latin', dances: ['cha_cha_cha'], isSolo: false, kind: 'standard' },
  { number: 6, ageGroup: 'adult', class: 'A', discipline: 'latin', dances: ['samba', 'cha_cha_cha', 'rumba', 'paso_doble', 'jive'], isSolo: false, kind: 'standard' },
  { number: 7, ageGroup: 'adult', class: 'B', discipline: 'standard', dances: ['waltz', 'foxtrot', 'quickstep'], isSolo: false, kind: 'standard' },
  { number: 8, ageGroup: 'senior', class: 'C', discipline: 'latin', dances: ['cha_cha_cha', 'jive'], isSolo: false, kind: 'standard' },
  { number: 9, ageGroup: 'juvenile_2', class: 'E1', discipline: 'latin', dances: ['cha_cha_cha', 'rumba'], isSolo: true, kind: 'bgb' },
  { number: 10, ageGroup: 'junior_1', class: 'D', discipline: 'standard', dances: ['waltz', 'quickstep'], isSolo: true, kind: 'ranking' },
  { number: 11, ageGroup: 'juvenile_2', class: 'E1', discipline: 'latin', dances: ['cha_cha_cha', 'jive'], isSolo: false, kind: 'inter_elementary', usesPoints: false },
  { number: 12, ageGroup: 'youth', class: 'C', discipline: 'latin', dances: ['samba', 'rumba'], isSolo: true, kind: 'closed', province: 'Albay' },
  { number: 13, ageGroup: 'adult', class: 'C', discipline: 'standard', dances: ['waltz', 'tango'], isSolo: true, kind: 'standard' },
  { number: 14, ageGroup: 'juvenile_2', class: 'E1', discipline: 'latin', dances: ['samba', 'jive'], isSolo: true, kind: 'standard' },
]
const event = {}
for (const e of EVENTS) event[e.number] = await call('saveEvent', [comp.id, e], admin)
log('events', Object.keys(event).length)

// Panels: how many adjudicators mark each event. Five is usual; seven for the big one; four so that a final can tie.
const PANEL = { 1: 'ABCDE', 2: 'ABCDE', 3: 'ABCDEFG', 4: 'ABCDEF', 5: 'ABCD', 6: 'FGHIJ', 7: 'ABCDE', 8: 'ABCDE', 9: 'ABCDE', 10: 'ABCDE', 11: 'ABCDE', 12: 'ABCDE', 13: 'ABCDE', 14: 'ABCDE' }
for (const [n, letters] of Object.entries(PANEL)) await call('setPanel', [event[n].id, adj(letters)], admin)
await call('generatePins', [comp.id], admin)
const pins = new Map((await call('getAdjudicatorPins', [comp.id], admin)).map((p) => [p.adjudicatorId, p.pin]))

// ------------------------------------------------------------------------------------------------------ teams and coaches
const TEAMS = [
  ['Naga Rhythm Studio', 'Marites Villareal', 'Camarines Sur'],
  ['Legazpi Dance Collective', 'Joel Santillan', 'Albay'],
  ['Sorsogon Star Dancers', 'Amparo Reyes', 'Sorsogon'],
  ['Iriga Movement Club', 'Nestor Balane', 'Camarines Sur'],
  ['Daet Ballroom Team', 'Cecile Tolentino', 'Camarines Norte'],
  ['Masbate Dance Academy', 'Ramon Quitoriano', 'Masbate'],
  ['Virac Dancesport Club', 'Lorna Tabuena', 'Catanduanes'],
  ['Tabaco Ballroom Society', 'Gilbert Ochoa', 'Albay'],
]
const teams = []
for (const [name, contact, province] of TEAMS) {
  teams.push({ ...(await call('saveTeam', [{ name, contactName: contact, contactEmail: `${name.split(' ')[0].toLowerCase()}@scenario.example`, contactPhone: '0917 555 0100' }], sec)), province })
}
const COACHES = [
  ['Marites Villareal', 2026, 2026, 'paid'], ['Joel Santillan', 2026, null, 'member'], ['Amparo Reyes', 2025, 2025, 'lapsed'],
  ['Nestor Balane', null, null, 'new'], ['Cecile Tolentino', 2026, 2026, 'paid'], ['Ramon Quitoriano', null, 2026, 'summit only'],
]
const coaches = []
for (const [name, memberYear, summitYear] of COACHES) {
  coaches.push(await call('saveCoach', [{ name, email: `${name.split(' ')[0].toLowerCase()}@coach.example`, phone: '0918 555 0200', memberYear, summitYear, memberMonth: memberYear ? 3 : null, summitPeriod: summitYear ? 'Q1 2026' : null, summits: summitYear ? [daysAgo(60)] : [] }], sec))
}
log('teams', teams.length, 'coaches', coaches.length)

// ------------------------------------------------------------------------------------------------------ dancers and entries
const YEARS = { juvenile_1: [2017, 2018, 2019], juvenile_2: [2015, 2016], junior_1: [2013, 2014], junior_2: [2011, 2012], youth: [2008, 2009, 2010], adult: [1996, 2000, 2004], senior: [1962, 1975, 1988] }
const METHODS = ['gcash', 'maya', 'bank', 'cash']
let pay = 0
const competitors = {}
const entered = {}

async function addDancers(n, count, { couples = false, teamPool = teams, beginner = false, province } = {}) {
  const ev = EVENTS.find((e) => e.number === n)
  const years = YEARS[ev.ageGroup]
  const made = []
  for (let i = 0; i < count; i++) {
    const team = teamPool[(i + n) % teamPool.length]
    const coach = coaches[(i + n) % coaches.length]
    const names = couples ? [nextName(), nextName()] : [nextName()]
    const gender = (k) => (k % 2 === 0 ? 'female' : 'male')
    const dancers = names.map((_, k) => dancer(years[(i + k) % years.length], gender(i + k)))
    const row = await call('createCompetitor', [{ names, teamId: team.id, details: { province: province ?? team.province, coachId: coach.id, dancers, beginner, memberYear: 2026 } }], sec)
    made.push(row)
  }
  competitors[n] = made
  return made
}

async function enter(n, rows, { methods = METHODS, unpaid = [], extra = {} } = {}) {
  entered[n] = []
  for (const [i, row] of rows.entries()) {
    const method = unpaid.includes(i) ? 'unpaid' : methods[pay++ % methods.length]
    await call('registerCompetitor', [{ competitorId: row.id, eventIds: [event[n].id], method, reference: method === 'cash' || method === 'unpaid' ? '' : `${method.toUpperCase()}${100000 + pay * 37}`, ...extra }], sec)
    entered[n].push(row)
  }
}

await enter(1, await addDancers(1, 9))
await enter(2, await addDancers(2, 6))
await enter(3, await addDancers(3, 26, { couples: true }), { extra: { coachFees: { membership: true, summit: false } } })
await enter(4, await addDancers(4, 14, { couples: true }))
await enter(5, await addDancers(5, 8, { couples: true }))
await enter(6, await addDancers(6, 16, { couples: true }))
await enter(7, await addDancers(7, 14, { couples: true }))
await enter(8, await addDancers(8, 10, { couples: true }))
await enter(9, await addDancers(9, 8, { beginner: true }), { unpaid: [1, 4, 6] })
await enter(10, await addDancers(10, 6))
await enter(11, await addDancers(11, 6, { couples: true }), { unpaid: [0, 1, 2, 3, 4, 5] })
await enter(12, await addDancers(12, 5, { province: 'Albay', teamPool: [teams[1], teams[7]] }), { unpaid: [2] })
await enter(14, await addDancers(14, 4))
log('dancers and entries made')

// Two couples are a Youth couple because one partner is a Junior: the older partner decides the group
{
  const mixed = await call('createCompetitor', [{ names: [nextName(), nextName()], teamId: teams[0].id, details: { province: 'Camarines Sur', coachId: coaches[0].id, dancers: [dancer(2011, 'female'), dancer(2009, 'male')], beginner: false, memberYear: 2026 } }], sec)
  await call('registerCompetitor', [{ competitorId: mixed.id, eventIds: [event[5].id], method: 'gcash', reference: 'GCMIXED1' }], sec)
  competitors[5].push(mixed)
  entered[5].push(mixed)
}

// Scratches and late entries
for (const [n, k] of [[4, 0], [4, 1], [6, 15], [12, 3]]) {
  const rows = await call('getEntryRows', [event[n].id], sec)
  const target = rows.find((r) => r.competitorId === competitors[n][k]?.id)
  if (target) await call('setEntryScratched', [target.entryId, true], sec)
}
log('scratched 4 entries')

// ------------------------------------------------------------------------------------------------------ back numbers, late entries, rounds
await call('assignBackNumbers', [], sec)
{
  const lateRows = await addDancers(10, 3)
  await call('createLateEntry', [{ competitorId: lateRows[0].id, eventId: event[10].id, paidInCash: true }], sec)
  await call('createLateEntry', [{ competitorId: lateRows[1].id, eventId: event[10].id, paidInCash: false }], sec)
  await call('createLateEntry', [{ competitorId: lateRows[2].id, eventId: event[10].id, paidInCash: true }], sec)
  await call('assignBackNumbers', [], sec)
  log('late entries made')
}

await call('planRounds', [comp.id], scr)
const plan = (...recalls) => [...recalls.map((recall, i) => ({ type: ['round_1', 'round_2', 'quarter_final', 'semi_final'][4 - recalls.length + i], recall })), { type: 'final', recall: null }]
await call('setEventRounds', [event[3].id, plan(24, 18, 12, 8)], sec)
await call('setEventRounds', [event[4].id, plan(6)], sec)
await call('setEventRounds', [event[8].id, plan(6)], sec)
await call('setEventRounds', [event[6].id, plan(6)], sec)
await call('setEventRounds', [event[5].id, [{ type: 'final', recall: null }]], sec)

// Five of the seven adjudicators mark each early round of E3: a rotating set
for (const [type, letters] of [['round_1', 'ABCDE'], ['round_2', 'CDEFG'], ['quarter_final', 'ABEFG']]) await call('setRoundSet', [event[3].id, type, adj(letters)], sec)

const rounds = async () => await call('getCompetitionRounds', [comp.id], scr)
const roundOf = async (n, type) => (await rounds()).find((r) => r.eventNumber === n && r.type === type)
log('rounds planned')

// ------------------------------------------------------------------------------------------------------ marking
const phones = new Map()
const phoneFor = async (adjudicatorId) => {
  if (!phones.has(adjudicatorId)) phones.set(adjudicatorId, await phoneOf(pins.get(adjudicatorId)))
  return phones.get(adjudicatorId)
}

async function startWithHeats(round, heats) {
  if (heats > 1) {
    const field = await call('getHeatAssignments', [round.roundId], scr)
    const per = Math.ceil(field.length / heats)
    await call('saveHeats', [round.roundId, field.map((f, i) => ({ competitorId: f.competitorId, heat: Math.floor(i / per) + 1 }))], scr)
  }
  await call('startRound', [round.roundId], scr)
}

// The marks one adjudicator gives. `plan` can bend them: a tie at the cut-off, or a tie in a final.
function marksFor(order, dances, recallNumber, index, plan = {}) {
  if (recallNumber) {
    const pick = order.slice(0, recallNumber)
    if (plan.cutoffTie && order.length > recallNumber) {
      // Half the panel marks the next couple instead of the last one in, so two couples finish level on the cut-off
      if (index % 2 === 0) pick[recallNumber - 1] = order[recallNumber]
    } else if (index === 4 && order.length > recallNumber) pick[recallNumber - 1] = order[recallNumber]
    return dances.map((dance) => ({ dance, competitorIds: pick }))
  }
  return dances.map((dance) => {
    if (plan.finalTie) {
      const [a, b, ...rest] = order
      return { dance, competitorIds: index % 2 === 0 ? [a, b, ...rest] : [b, a, ...rest] }
    }
    return { dance, competitorIds: order.map((id) => [id, q(id) + (rand() - 0.5) * 2.2]).sort((x, y) => y[1] - x[1]).map((p) => p[0]) }
  })
}

async function mark(round, { only, plan, paper = [] } = {}) {
  const set = await call('getRoundSet', [round.roundId], scr)
  const ids = (set.length ? set : adj(PANEL[round.eventNumber])).filter((id) => !only || only.includes(id))
  const first = await phoneFor(ids[0])
  const state = await call('getAdjudicatorState', [], first)
  const { competitors: field, dances, recallNumber } = state.task
  const order = [...field].sort((a, b) => q(b.id) - q(a.id)).map((c) => c.id)
  for (const [i, id] of ids.entries()) {
    const marks = marksFor(order, dances, recallNumber, i, plan)
    if (paper.includes(id)) await call('enterAdjudicatorMarks', [id, round.roundId, marks], scr)
    else await call('submitAdjudicatorMarks', [round.roundId, marks, i === 0 ? 'data:image/png;base64,iVBORw0KGgo=' : undefined], await phoneFor(id))
  }
  return { field, order }
}

async function finish(round, { proposeFinalTie = null } = {}) {
  if (proposeFinalTie) {
    const tie = await call('getFinalTie', [round.roundId], scr)
    if (tie && tie.groups?.length) {
      await call('proposeFinalTie', [round.roundId, proposeFinalTie, []], scr)
      await call('confirmFinalTie', [round.roundId], chair)
    }
  }
  await call('approveRound', [round.roundId], scr)
  await call('publishRound', [round.roundId], scr)
}

async function danceEvent(n, types, options = {}) {
  for (const type of types) {
    const round = await roundOf(n, type)
    if (!round) throw new Error(`E${n} has no ${type}`)
    await startWithHeats(round, options.heats?.[type] ?? (type === 'final' ? 1 : 0))
    await mark(round, { plan: options.plan?.[type] })
    await finish(round, { proposeFinalTie: options.tie?.[type] ?? null })
    log(`E${n} ${type} published`)
  }
}

// Finished events, with every way a round can go
await danceEvent(1, ['semi_final', 'final'], { heats: { semi_final: 2 } })
await danceEvent(2, ['final'])
await danceEvent(3, ['round_1', 'round_2', 'quarter_final', 'semi_final', 'final'], { heats: { round_1: 3, round_2: 2, quarter_final: 2, semi_final: 2 } })
await danceEvent(4, ['semi_final', 'final'], { heats: { semi_final: 2 }, plan: { semi_final: { cutoffTie: true } } })
await danceEvent(5, ['final'], { plan: { final: { finalTie: true } }, tie: { final: 'keep' } })

// Live now. E7: every adjudicator has marked and the round waits for the scrutineer (review).
{
  const r7 = await roundOf(7, 'semi_final')
  await startWithHeats(r7, 2)
  await mark(r7)
  log('E7 semi-final in review')
}
// E8: all marked, then a heat is danced again and waits for its marks (redance)
{
  const r8 = await roundOf(8, 'semi_final')
  await startWithHeats(r8, 2)
  await mark(r8)
  await call('startRedance', [r8.roundId, 1, 'A couple fell during the heat'], scr)
  log('E8 semi-final with a redance open')
}
// E6: marking now, three of five in, and one of those typed in from a paper sheet
{
  const r6 = await roundOf(6, 'semi_final')
  await startWithHeats(r6, 2)
  const set = adj(PANEL[6])
  await mark(r6, { only: set.slice(0, 3), paper: [set[2]] })
  log('E6 semi-final marking, 3 of 5 in (one from paper)')
}

// ------------------------------------------------------------------------------------------------------ the program
await call('setProgramStart', [comp.id, '08:00'], sec)
let program = await call('generateProgram', [comp.id], sec)
const ORDER = [[1, 'semi_final'], [1, 'final'], [2, 'final'], [3, 'round_1'], [3, 'round_2'], [3, 'quarter_final'], [3, 'semi_final'], [3, 'final'], [4, 'semi_final'], [4, 'final'], [5, 'final'], [7, 'semi_final'], [8, 'semi_final'], [6, 'semi_final']]
const wanted = []
for (const [n, t] of ORDER) {
  const row = program.rows.find((r) => r.eventNumber === n && r.roundType === t)
  if (row) wanted.push(row)
}
for (const [i, row] of wanted.entries()) program = await call('moveProgramSlotTo', [row.slotId, i + 1], sec)
const seqOf = (n, t) => program.rows.find((r) => r.eventNumber === n && r.roundType === t)?.sequence ?? 0
program = await call('addProgramBreak', [comp.id, { kind: 'break', label: 'Opening and welcome', minutes: 15, afterSequence: 0 }], sec)
program = await call('addProgramBreak', [comp.id, { kind: 'break', label: 'Lunch break', minutes: 45, afterSequence: seqOf(5, 'final') + 1 }], sec)
program = await call('addProgramBreak', [comp.id, { kind: 'awarding', label: 'Awarding of winners', minutes: 30, afterSequence: program.rows.length }], sec)
log('program', program.rows.length, 'lines')

// ------------------------------------------------------------------------------------------------------ accounts and requests
const PNG_SHOT = 'data:image/png;base64,iVBORw0KGgo='
// Sign-up asks for eight characters; the sample accounts use the shorter password of every other sample account, so it is set after
const verify = (table, email) => {
  const db = new Database(DATABASE)
  db.prepare(`UPDATE ${table} SET email_verified = 1, password_hash = ? WHERE email = ?`).run(hashPassword(PASSWORD), email)
  db.close()
}
async function signUp(kind, name, email) {
  const { cookie } = await post(`/api/auth/${kind}/sign-up`, { name, email, password: 'scenario-start-1', photo: samplePhoto(name) })
  verify(kind === 'athlete' ? 'athletes' : 'member_accounts', email)
  return cookie
}

// A team account, linked by the secretariat, sends entries: one is approved, one turned down, one is waiting
const teamCookie = await signUp('team', 'Naga Rhythm Studio Team Page', 'team@sample.example')
await call('claimRecord', [teams[0].id], teamCookie)
// A second team account asks to be linked and is left waiting
const waitingTeam = await signUp('team', 'Legazpi Team Page', 'team2@sample.example')
await call('claimRecord', [teams[1].id], waitingTeam)
// A coach account, linked
const coachCookie = await signUp('coach', coaches[0].name, 'coach@sample.example')
await call('claimRecord', [coaches[0].id], coachCookie)
const claims = await call('getMemberClaims', [], sec)
for (const c of claims.filter((x) => x.email === 'team@sample.example' || x.email === 'coach@sample.example')) await call('approveMemberClaim', [c.memberId], sec)
log('team and coach accounts linked; one link request waiting')

// Dancers the team and an athlete can send entries for
const extra = async (names, team, years, beginner = false) => {
  const dancers = names.map((_, k) => dancer(years[k % years.length], k % 2 === 0 ? 'female' : 'male'))
  return call('createCompetitor', [{ names, teamId: team.id, details: { province: team.province, coachId: coaches[0].id, dancers, beginner, memberYear: 2026 } }], sec)
}
const requestA = await extra([nextName()], teams[0], YEARS.juvenile_2)
const requestB = await extra([nextName()], teams[0], YEARS.junior_1)
const requestC = await extra([nextName(), nextName()], teams[0], YEARS.juvenile_2)
const athleteName = nextName()
await extra([athleteName], teams[0], YEARS.juvenile_2)
const ask = (competitor, events, cookie, method = 'gcash') => call('submitEntryRequest', [{ competitorId: competitor.id, eventIds: events.map((n) => event[n].id), method, reference: `${method.toUpperCase()}${200000 + seq}`, receipt: PNG_SHOT }], cookie)
const sentA = await ask(requestA, [14], teamCookie)
const sentB = await ask(requestB, [10], teamCookie, 'maya')
await ask(requestC, [11], teamCookie, 'bank')
await call('approveEntryRequest', [sentA.id], sec)
await call('rejectEntryRequest', [sentB.id, 'The reference number does not match the payment received.'], sec)
log('entry requests: one approved, one turned down, one waiting')

// An athlete account fills in its details (set straight away), then asks to move to another team (a profile change waiting)
const athleteCookie = await signUp('athlete', athleteName, 'athlete@sample.example')
const profile = (await call('getMyAthlete', [], athleteCookie)).profile
await call('saveMyAthlete', [{ name: profile.name, birthDate: '2016-05-14', phone: '0917 123 4567', address: '12 Magsaysay Ave, Naga City', province: 'Camarines Sur', teamId: teams[0].id, coachId: coaches[0].id }], athleteCookie)
await call('saveMyAthlete', [{ name: profile.name, birthDate: '2016-05-14', phone: '0917 123 4567', address: '12 Magsaysay Ave, Naga City', province: 'Camarines Sur', teamId: teams[2].id, coachId: coaches[1].id }], athleteCookie)
log('athlete account: details filled in, a team change waiting')

await call('assignBackNumbers', [], sec)
log('done')
