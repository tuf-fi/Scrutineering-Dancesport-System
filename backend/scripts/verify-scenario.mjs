// Checks the scenario competition end to end and fails on anything wrong:
//   1. the database: no row points at a missing row, and the rules the data must keep hold;
//   2. the pages: every role signs in and opens every page, and nothing may answer an error, log an error to the console,
//      or show "Couldn't load this" / "No data available".
//
//   pnpm --filter @bis/backend db:verify [http://localhost:5173]      (the app and the server must be running)
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const UI = (process.argv[2] ?? 'http://localhost:5173').replace(/\/$/, '')
const root = resolve(import.meta.dirname, '..', '..')
const require = createRequire(resolve(root, 'package.json'))
const { chromium } = require('playwright-core')
const Database = createRequire(resolve(import.meta.dirname, '..', 'package.json'))('better-sqlite3')
const DATABASE = process.env.DATABASE_PATH ?? resolve(import.meta.dirname, '..', 'data', 'bis.db')
const PASSWORD = 'bis2026'
const problems = []
const fail = (where, what) => problems.push(`${where}: ${what}`)
const log = (...a) => console.log(...a)

// ------------------------------------------------------------------------------------------------------ 1. the data
{
  const db = new Database(DATABASE, { readonly: true })
  const none = (label, sql) => {
    const rows = db.prepare(sql).all()
    if (rows.length > 0) fail('data', `${label} (${rows.length}): ${JSON.stringify(rows.slice(0, 2))}`)
  }
  const loose = db.pragma('foreign_key_check')
  if (loose.length > 0) fail('data', `${loose.length} rows point at a row that does not exist`)
  none('duplicate back numbers', 'SELECT back_number n, count(*) c FROM competitors WHERE back_number IS NOT NULL GROUP BY back_number HAVING c > 1')
  none('an entered dancer without a back number', 'SELECT DISTINCT c.id FROM competitors c JOIN entries e ON e.competitor_id = c.id WHERE c.back_number IS NULL AND e.scratched = 0')
  none('a paid payment with no amount', "SELECT id FROM payments WHERE status IN ('approved','paid_at_venue') AND amount_paid IS NULL")
  none('an unpaid payment with an amount', "SELECT id FROM payments WHERE status = 'unpaid' AND amount_paid IS NOT NULL")
  none('a final that is approved but has no results', "SELECT r.id FROM rounds r WHERE r.type = 'final' AND r.status IN ('approved','published') AND NOT EXISTS (SELECT 1 FROM results x WHERE x.event_id = r.event_id)")
  none('results of an event whose final is not approved', "SELECT DISTINCT x.event_id FROM results x WHERE NOT EXISTS (SELECT 1 FROM rounds r WHERE r.event_id = x.event_id AND r.type = 'final' AND r.status IN ('approved','published'))")
  none('a ranking event without points', 'SELECT DISTINCT x.event_id FROM results x JOIN events e ON e.id = x.event_id WHERE e.uses_points = 1 AND NOT EXISTS (SELECT 1 FROM ranking_points p WHERE p.event_id = x.event_id)')
  none('a round on the floor that is pending', "SELECT id FROM rounds WHERE on_floor_at IS NOT NULL AND status = 'pending'")
  none('a solo event with a couple entered', 'SELECT DISTINCT e.id FROM events e JOIN entries en ON en.event_id = e.id JOIN competitors c ON c.id = en.competitor_id WHERE e.is_solo = 1 AND json_array_length(c.names) > 1')
  none('a couple event with a solo entered', 'SELECT DISTINCT e.id FROM events e JOIN entries en ON en.event_id = e.id JOIN competitors c ON c.id = en.competitor_id WHERE e.is_solo = 0 AND json_array_length(c.names) = 1')
  none('an event without a panel', 'SELECT e.id FROM events e WHERE NOT EXISTS (SELECT 1 FROM panels p JOIN panel_members m ON m.panel_id = p.id WHERE p.event_id = e.id)')
  none('a program line for a round that does not exist', "SELECT s.id FROM program_slots s WHERE s.kind = 'round' AND NOT EXISTS (SELECT 1 FROM rounds r WHERE r.event_id = s.event_id AND r.type = s.round_type)")
  none('an age group missing from the catalog', 'SELECT DISTINCT age_group FROM events WHERE age_group NOT IN (SELECT id FROM age_groups)')
  none('a kind missing from the catalog', 'SELECT DISTINCT kind FROM events WHERE kind NOT IN (SELECT id FROM event_kinds)')
  none('a class missing from the catalog', 'SELECT DISTINCT class FROM events WHERE class NOT IN (SELECT name FROM event_classes)')
  none('a heat holding someone not entered in the event', 'SELECT hc.competitor_id FROM heat_competitors hc JOIN heats h ON h.id = hc.heat_id JOIN rounds r ON r.id = h.round_id WHERE NOT EXISTS (SELECT 1 FROM entries e WHERE e.event_id = r.event_id AND e.competitor_id = hc.competitor_id)')
  none('a first round whose heats leave someone out', `SELECT r.id FROM rounds r WHERE r.position = 1 AND r.status != 'pending' AND (SELECT count(*) FROM heat_competitors hc JOIN heats h ON h.id = hc.heat_id WHERE h.round_id = r.id) != (SELECT count(*) FROM entries e WHERE e.event_id = r.event_id AND e.scratched = 0)`)
  const counts = db.prepare('SELECT (SELECT count(*) FROM competitions) c, (SELECT count(*) FROM events) e, (SELECT count(*) FROM competitors) p, (SELECT count(*) FROM results) r').get()
  if (counts.c !== 1) fail('data', `expected one competition, found ${counts.c}`)
  log(`data: ${counts.c} competition, ${counts.e} events, ${counts.p} dancers, ${counts.r} results`)
  db.close()
}

// ------------------------------------------------------------------------------------------------------ 2. the pages
const api = async (name, args, cookie) => {
  const r = await fetch(`${UI}/api/call/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ args }) })
  if (!r.ok) throw new Error(`${name}: ${r.status}`)
  return (await r.json()).data
}
const login = async (path, body) => {
  const r = await fetch(UI + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${path}: ${r.status}`)
  return (r.headers.get('set-cookie') ?? '').split(';')[0]
}
const adminCookie = await login('/api/auth/staff', { username: 'admin@sample.example', password: PASSWORD })
const comp = (await api('getCompetitions', []))[0]
const events = await api('getEvents', [comp.id])
const rounds = await api('getCompetitionRounds', [comp.id])
const event = (n) => events.find((e) => e.number === n)
const round = (n, type) => rounds.find((r) => r.eventNumber === n && r.type === type)
const published = rounds.filter((r) => r.type === 'final' && r.status === 'published').map((r) => r.eventId)
const dancerId = (await api('getCompetitors', []))[0].id
const pins = (await api('getAdjudicatorPins', [comp.id], adminCookie))[0].pin

const chosen = await chromium.launch({ executablePath: ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p)) })
const BAD = /Couldn.t load this|No data available|Something went wrong|Unexpected Application Error/i
const pages = []

async function visit(role, signIn, paths, { keys = [] } = {}) {
  const ctx = await chosen.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  if (signIn) {
    const r = await ctx.request.post(`${UI}${signIn[0]}`, { data: signIn[1] })
    if (!r.ok()) {
      fail(role, `sign-in answered ${r.status()}`)
      await ctx.close()
      return
    }
  }
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  let where = ''
  page.on('response', async (res) => {
    if (res.url().includes('/api/') && res.status() >= 400) {
      const said = await res.json().then((j) => j.error ?? '', () => '')
      fail(`${role} ${where}`, `${res.status()} from ${new URL(res.url()).pathname.replace('/api/call/', '')}${said ? ` ("${said}")` : ''}`)
    }
  })
  page.on('requestfailed', (req) => {
    if (!/\/socket\.io\/|net::ERR_ABORTED/.test(req.url() + (req.failure()?.errorText ?? ''))) fail(`${role} ${where}`, `request failed: ${req.url()}`)
  })
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !/Failed to load resource|favicon/i.test(msg.text())) fail(`${role} ${where}`, `console error: ${msg.text().slice(0, 140)}`)
  })
  page.on('pageerror', (e) => fail(`${role} ${where}`, `page error: ${e.message.slice(0, 140)}`))
  for (const path of paths) {
    where = path
    await page.goto(UI + path, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(500)
    const text = await page.evaluate(() => document.body.innerText)
    const hit = text.match(BAD)
    if (hit) fail(`${role} ${path}`, `the page says "${hit[0]}"`)
    if (text.trim().length < 20) fail(`${role} ${path}`, 'the page is blank')
    pages.push(`${role} ${path}`)
    if (path === '/compere') {
      for (const key of keys) {
        where = `${path} key ${key}`
        await page.keyboard.press(key)
        await page.waitForTimeout(700)
        const view = await page.evaluate(() => document.body.innerText)
        const bad = view.match(BAD)
        if (bad) fail(`${role} ${where}`, `the page says "${bad[0]}"`)
        pages.push(`${role} ${where}`)
      }
    }
  }
  await ctx.close()
}

const staffIn = (user) => ['/api/auth/staff', { username: `${user}@sample.example`, password: PASSWORD }]
const e1 = event(1)
const SECRETARIAT = ['/secretariat', '/secretariat/teams', '/secretariat/coaches', '/secretariat/athletes', '/secretariat/entry-requests', '/secretariat/account-links', '/secretariat/profile-changes', '/secretariat/late-entries', '/secretariat/schedule', '/secretariat/heats', '/secretariat/program', '/secretariat/panels', '/secretariat/security', `/secretariat/events/${event(3).id}`, `/secretariat/events/${event(9).id}`, `/secretariat/events/${event(13).id}`]
const PRINTS = [`/print/heats/${e1.id}`, `/print/recall/${e1.id}?round=${round(1, 'semi_final').roundId}`, `/print/scores/${e1.id}?round=${round(1, 'semi_final').roundId}`, `/print/results/${e1.id}`, `/print/certificates/${e1.id}`, `/print/blank-sheets/${e1.id}`, `/competitions/${comp.id}/program/print`, '/print']
const SCRUTINEER = ['/scrutineer', '/scrutineer/heats', '/scrutineer/paper-marks', '/scrutineer/schedule', '/scrutineer/program', '/scrutineer/panels', '/scrutineer/advancement', '/scrutineer/live', '/scrutineer/recall', '/scrutineer/results', '/scrutineer/security', '/account']
// A page for a round that has not started, or a recall page for a final, has nothing to show by design, so those are not opened
const started = (r) => r && r.status !== 'pending'
for (const [n, type] of [[6, 'semi_final'], [7, 'semi_final'], [8, 'semi_final'], [3, 'round_1'], [3, 'final'], [1, 'final'], [5, 'final']]) {
  const r = round(n, type)
  if (!started(r)) continue
  SCRUTINEER.push(`/scrutineer/live?round=${r.roundId}`, `/scrutineer/heats?round=${r.roundId}`, `/scrutineer/results?round=${r.roundId}`)
  if (type !== 'final') SCRUTINEER.push(`/scrutineer/recall?round=${r.roundId}`)
}
const pendingRound = rounds.find((r) => r.status === 'pending')
if (pendingRound) SCRUTINEER.push(`/scrutineer/heats?round=${pendingRound.roundId}`, `/scrutineer/live?round=${pendingRound.roundId}`)

await visit('public', null, ['/', '/competitions', `/competitions/${comp.id}`, `/competitions/${comp.id}/program`, ...published.map((id) => `/competitions/${comp.id}/events/${id}`), '/results', `/results/${comp.id}`, '/athletes', '/standings', `/competitors/${dancerId}`, '/privacy', '/login', '/athlete/sign-in', '/coach/sign-in', '/team/sign-in'])
await visit('admin', staffIn('admin'), ['/admin/competitions', '/admin/categories', '/admin/staff', '/admin/adjudicators', '/admin/points', '/admin/payments', '/admin/fees', '/admin/offline-day', '/admin/site', '/admin/security', ...SECRETARIAT, ...PRINTS, `/print/pin-cards/${comp.id}`])
await visit('secretariat', staffIn('secretariat'), [...SECRETARIAT, '/account', ...PRINTS])
await visit('scrutineer', staffIn('scrutineer'), [...SCRUTINEER, ...PRINTS])
await visit('chairperson', staffIn('chairperson'), ['/scrutineer/live', '/scrutineer/recall', '/scrutineer/results', '/scrutineer/security', `/scrutineer/results?round=${round(5, 'final').roundId}`])
await visit('compere', staffIn('compere'), ['/compere', '/account'], { keys: ['1', '2', '3', '4', '5', '6'] })
await visit('barker', staffIn('barker'), ['/barker', '/account'])
await visit('adjudicator', ['/api/auth/adjudicator', { pin: pins }], ['/adjudicator/waiting', '/adjudicator/mark', '/adjudicator/submitted'])
await visit('athlete', ['/api/auth/athlete', { email: 'athlete@sample.example', password: PASSWORD }], ['/athlete', '/athlete/edit', '/athlete/membership', '/athlete/payments', '/athlete/results', '/athlete/rankings', '/athlete/entries', '/athlete/notifications', '/athlete/password'])
const memberPages = (who, extra) => [`/${who}`, `/${who}/edit`, `/${who}/notifications`, `/${who}/dancers`, `/${who}/results`, `/${who}/rankings`, `/${who}/entries`, `/${who}/password`, ...extra]
await visit('coach', ['/api/auth/coach', { email: 'coach@sample.example', password: PASSWORD }], memberPages('coach', []))
await visit('team', ['/api/auth/team', { email: 'team@sample.example', password: PASSWORD }], memberPages('team', ['/team/payments', '/team/membership', '/team/register', '/team/requests']))
await visit('team (waiting for its link)', ['/api/auth/team', { email: 'team2@sample.example', password: PASSWORD }], ['/team', '/team/link'])
await chosen.close()

log(`pages opened: ${pages.length}`)
const unique = [...new Set(problems)]
if (unique.length > 0) {
  log(`\n${unique.length} problem${unique.length === 1 ? '' : 's'}:`)
  for (const p of unique) log('  -', p)
  process.exit(1)
}
log('Everything passes: the data is consistent and every page loaded without an error.')
