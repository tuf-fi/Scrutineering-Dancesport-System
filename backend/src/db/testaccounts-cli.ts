import { PIN_LENGTH, samplePhoto } from '@bis/shared'
import { and, eq } from 'drizzle-orm'
import { existsSync, writeFileSync } from 'node:fs'
import { randomInt } from 'node:crypto'
import { hashPassword, temporaryPassword } from '../auth/password.ts'
import { loadConfig } from '../config.ts'
import { openDatabase } from './client.ts'
import { runMigrations } from './migrate.ts'
import { textPdf, type PdfLine } from './minipdf.ts'
import * as t from './schema.ts'
import { addTestData } from './testdata.ts'

// pnpm --filter @bis/backend db:testaccounts [--yes] [--site https://staging.example.com] [--password x] [--pin-start 100001] [--pdf path]
// Makes one test login for each role that has one (admin, secretariat, scrutineer, chairperson, compere, athlete, coach, team) and a PIN for every adjudicator, then prints them
// and writes them to a PDF. No password or PIN is kept in the repository: pass --password to choose one password for every login,
// or leave it out and each login gets its own random password. PINs are random and kept once made. Every run writes the sheet again.
if (process.env.BIS_DEPLOYED === 'true' && !process.argv.includes('--yes')) {
  console.error('This makes test logins. Run it on staging only, and add --yes to confirm.')
  process.exit(1)
}
const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const chosen = arg('--password')
if (chosen !== undefined && chosen.length < 8) {
  console.error('--password must be at least 8 characters.')
  process.exit(1)
}
const passwordFor = () => chosen ?? temporaryPassword()
// --pin-start 100001 gives the adjudicators the PINs 100001, 100002 and so on in letter order, so a sheet can be made ahead of the run
const pinStartArg = arg('--pin-start')
const pinStart = pinStartArg === undefined ? undefined : Number(pinStartArg)
if (pinStart !== undefined && (!Number.isInteger(pinStart) || String(pinStart).length !== PIN_LENGTH || String(pinStart + 9).length !== PIN_LENGTH)) {
  console.error(`--pin-start must be a ${PIN_LENGTH}-digit number.`)
  process.exit(1)
}
const site = (arg('--site') ?? 'your site address').replace(/\/$/, '')
const pdfPath = arg('--pdf') ?? (existsSync('/data') ? '/data/staging-logins.pdf' : 'staging-logins.pdf')

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
// The athletes, team, coach, adjudicators and competitions these logins belong to
addTestData(db)

// ---- The four logins
interface Login {
  role: string
  email: string
  name: string
  password: string
  path: string
}
// The staff roles: all sign in at the staff page
const STAFF = [
  { id: 'td-admin', role: 'Admin', key: 'admin', email: 'testadmin@testdata.example', name: 'Test Admin', password: passwordFor() },
  { id: 'td-secretariat', role: 'Secretariat', key: 'secretariat', email: 'testsecretariat@testdata.example', name: 'Test Secretariat', password: passwordFor() },
  { id: 'td-scrutineer', role: 'Scrutineer', key: 'scrutineer', email: 'testscrutineer@testdata.example', name: 'Test Scrutineer', password: passwordFor() },
  { id: 'td-chairperson', role: 'Chairperson', key: 'chairperson', email: 'testchairperson@testdata.example', name: 'Test Chairperson', password: passwordFor() },
  { id: 'td-compere', role: 'Compere', key: 'compere', email: 'testcompere@testdata.example', name: 'Test Compere', password: passwordFor() },
] as const
const staff: Login[] = STAFF.map((u) => ({ role: u.role, email: u.email, name: u.name, password: u.password, path: '/staff-access' }))
const admin = staff[0]!
const athlete: Login = { role: 'Athlete', email: 'bianca.alcantara@testdata.example', name: 'Bianca Alcantara', password: passwordFor(), path: '/login?as=athlete' }
const coach: Login = { role: 'Coach', email: 'coach@testdata.example', name: 'Marites Villareal', password: passwordFor(), path: '/login?as=coach' }
const team: Login = { role: 'Team', email: 'team@testdata.example', name: 'Naga Rhythm Studio', password: passwordFor(), path: '/login?as=team' }

for (const u of STAFF) {
  if (db.select().from(t.staffUsers).where(eq(t.staffUsers.id, u.id)).get()) {
    db.update(t.staffUsers).set({ passwordHash: hashPassword(u.password), disabled: false }).where(eq(t.staffUsers.id, u.id)).run()
  } else {
    db.insert(t.staffUsers).values({ id: u.id, name: u.name, username: u.email, role: u.key, photo: samplePhoto(u.name), passwordHash: hashPassword(u.password), disabled: false }).run()
  }
}
// Every test athlete can sign in: Bianca has the login above, the others get the chosen password or a random one each
const testAthletes = db.select().from(t.athletes).all().filter((a) => a.id.startsWith('td-athlete-')).sort((a, b) => a.name.localeCompare(b.name))
const athleteRows = testAthletes.map((a) => ({ name: a.name, email: a.email, password: a.email === athlete.email ? athlete.password : passwordFor() }))
for (const a of athleteRows) db.update(t.athletes).set({ passwordHash: hashPassword(a.password) }).where(eq(t.athletes.email, a.email)).run()
for (const [who, id, role, linkedId] of [
  [coach, 'td-member-coach', 'coach', 'td-coach-1'],
  [team, 'td-member-team', 'team', 'td-team-1'],
] as const) {
  if (db.select().from(t.memberAccounts).where(eq(t.memberAccounts.id, id)).get()) {
    db.update(t.memberAccounts).set({ passwordHash: hashPassword(who.password) }).where(eq(t.memberAccounts.id, id)).run()
  } else {
    db.insert(t.memberAccounts).values({ id, role, name: who.name, email: who.email, photo: samplePhoto(who.name), passwordHash: hashPassword(who.password), linkedId }).run()
  }
}

// ---- A PIN for every adjudicator, for the first upcoming competition
const adjudicators = db.select().from(t.adjudicators).all().sort((a, b) => a.letter.localeCompare(b.letter))
// A PIN works for the competition the server's clock calls current, so every test competition gets the same PINs
const testCompetitions = db.select().from(t.competitions).all().filter((c) => c.id.startsWith('td-'))
// One random PIN for each adjudicator, the same in every test competition; a PIN already made is kept
function pinOf(adjudicatorId: string, index: number): string {
  const held = db
    .select()
    .from(t.adjudicatorPins)
    .where(eq(t.adjudicatorPins.adjudicatorId, adjudicatorId))
    .all()
    .find((p) => testCompetitions.some((c) => c.id === p.competitionId))
  const inUse = new Set(db.select().from(t.adjudicatorPins).all().map((p) => p.pin))
  let pin = pinStart !== undefined ? String(pinStart + index) : (held?.pin ?? '')
  while (!pin) {
    const next = String(randomInt(10 ** (PIN_LENGTH - 1), 10 ** PIN_LENGTH))
    if (!inUse.has(next)) pin = next
  }
  for (const c of testCompetitions) {
    const have = db.select().from(t.adjudicatorPins).where(and(eq(t.adjudicatorPins.competitionId, c.id), eq(t.adjudicatorPins.adjudicatorId, adjudicatorId))).get()
    if (!have) db.insert(t.adjudicatorPins).values({ competitionId: c.id, adjudicatorId, pin }).run()
    else if (have.pin !== pin) db.update(t.adjudicatorPins).set({ pin }).where(and(eq(t.adjudicatorPins.competitionId, c.id), eq(t.adjudicatorPins.adjudicatorId, adjudicatorId))).run()
  }
  return pin
}
const pinRows = adjudicators.map((a, i) => ({ letter: a.letter, name: a.name, pin: pinOf(a.id, i) }))
sqlite.close()

// ---- The sheet
const pad = (s: string, n: number) => s.padEnd(n)
const logins = [...staff, athlete, coach, team]
const lines: PdfLine[] = [
  { text: 'BOSS staging test logins', style: 'title' },
  { text: `Made ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Running the command again makes a new sheet.`, style: 'muted' },
  { text: 'These are working logins for the staging server only. Keep this sheet private and never create these accounts on production.', style: 'muted' },
  { text: '', style: 'muted' },
  { text: 'One login for each role', style: 'heading' },
  { text: `${pad('Role', 12)}${pad('Sign in at', 19)}${pad('Email', 36)}Password`, style: 'code' },
  ...logins.map((l) => ({ text: `${pad(l.role, 12)}${pad(l.path, 19)}${pad(l.email, 36)}${l.password}`, style: 'code' as const })),
  { text: '', style: 'muted' },
  { text: `Open the site at ${site} followed by the path shown, for example ${site}${admin.path}`, style: 'muted' },
  { text: 'The admin is a second admin account, as well as the one you made. Staff roles sign in at the staff page. The coach and team are already linked to a record,', style: 'muted' },
  { text: 'so their dancers, results and entries show. The athlete is Bianca Alcantara, a dancer on Naga Rhythm Studio.', style: 'muted' },
  { text: '', style: 'muted' },
  { text: `Athletes: all ${athleteRows.length}`, style: 'heading' },
  { text: `Sign in at /login?as=athlete. Each athlete is also a solo dancer on a test team.`, style: 'muted' },
  { text: `${pad('Athlete', 22)}${pad('Email', 40)}Password`, style: 'code' },
  ...athleteRows.map((a) => ({ text: `${pad(a.name, 22)}${pad(a.email, 40)}${a.password}`, style: 'code' as const })),
  { text: '', style: 'muted' },
  { text: `Adjudicators: all ${pinRows.length}`, style: 'heading' },
  { text: `Open ${site}/adjudicator on a phone and type the PIN. The same PINs work for every test competition.`, style: 'muted' },
  { text: `${pad('Letter', 8)}${pad('Adjudicator', 36)}PIN`, style: 'code' },
  ...pinRows.map((r) => ({ text: `${pad(r.letter, 8)}${pad(r.name, 36)}${r.pin}`, style: 'code' as const })),
  { text: '', style: 'muted' },
  { text: 'Staging lets a PIN work on any day. An adjudicator is signed in on one phone at a time: signing in on a second phone signs the first out.', style: 'muted' },
]
writeFileSync(pdfPath, textPdf(lines))

console.log('Test logins:')
for (const l of logins) console.log(`  ${pad(l.role, 12)} ${site}${l.path}  ${l.email}  ${l.password}`)
console.log(`All ${athleteRows.length} test athletes can sign in; see the PDF for their emails.`)
console.log('Adjudicator PINs (the same for every test competition):')
for (const r of pinRows) console.log(`  ${r.letter}  ${pad(r.name, 28)} ${r.pin}`)
console.log(`PDF written to ${pdfPath}`)
