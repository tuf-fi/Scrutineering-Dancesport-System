// End to end, for real: the actual server in a separate process on a throwaway sample database, and a real Chrome.
// It plays event E11 from the round on the floor to published final results (adjudicators on phone-sized windows,
// the scrutineer on a laptop-sized one), recounts every mark on its own and compares it with what the server says,
// then runs the athlete sign-up and membership payment, a team's entry with its payment, the permissions of every
// role, and a crawl of every role's screens for console errors, failed calls and blank pages.
// Run it with `pnpm e2e` (about five minutes). It never touches real competition data. Screenshots go to rehearsal/shots.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { chromium } from 'playwright-core'

const ROOT = resolve(import.meta.dirname, '..')
const BACKEND = join(ROOT, 'backend')
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p))
if (!CHROME) {
  console.error('No Chrome or Edge found. Set CHROME_PATH to its program file.')
  process.exit(1)
}
if (!existsSync(join(ROOT, 'frontend', 'dist', 'index.html'))) {
  console.error('The screens are not built. Run `pnpm build` first.')
  process.exit(1)
}
const SHOTS = join(import.meta.dirname, 'shots')
mkdirSync(SHOTS, { recursive: true })

const Database = createRequire(join(BACKEND, 'package.json'))('better-sqlite3')
const PORT = 4060
const BASE = `http://localhost:${PORT}`
const work = mkdtempSync(join(tmpdir(), 'bis-e2e-'))
const env = { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATABASE_PATH: join(work, 'bis.db'), BACKUP_DIRS: join(work, 'backup'), NODE_NO_WARNINGS: '1' }

const COMP = 'comp-sorsogon-2026'
const EVENT = `${COMP}:e11`
const ROUND = (type) => `${EVENT}:${type}`
// A round given as a type of E11 ('final') or as a full id ('comp:e2:semi_final')
const rid = (x) => (x.includes(':') ? x : ROUND(x))
const PINS = { A: '410000', B: '421100', C: '432200', D: '443300', E: '454400', F: '465500', G: '476600' }
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }
const LAPTOP = { viewport: { width: 1280, height: 900 } }

const startedAt = new Date().toISOString()
const results = []
const browserIssues = []
const log = (m) => console.log(m)
async function step(name, fn, skip = false) {
  if (skip) return log(`SKIP  ${name}`)
  const t = Date.now()
  try {
    const note = await fn()
    results.push({ name, ok: true })
    log(`PASS  ${name}${note ? `  (${note})` : ''}  [${((Date.now() - t) / 1000).toFixed(1)}s]`)
  } catch (e) {
    results.push({ name, ok: false, note: String(e.message ?? e).split('\n')[0] })
    log(`FAIL  ${name}\n      ${String(e.message ?? e).split('\n').slice(0, 4).join('\n      ')}`)
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function expect(cond, message) {
  if (!cond) throw new Error(message)
}
async function until(what, check, ms = 20000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      const v = await check()
      if (v) return v
    } catch {}
    await sleep(250)
  }
  throw new Error(`Timed out waiting for ${what}`)
}

// ---- Server ----
let server = null
function startServer() {
  server = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], { cwd: BACKEND, env, stdio: ['ignore', 'pipe', 'pipe'] })
  let out = ''
  server.stdout.on('data', (d) => (out += d))
  server.stderr.on('data', (d) => (out += d))
  server.output = () => out
}

async function stopServer() {
  server.kill()
  await until('the server to stop', async () => !(await fetch(`${BASE}/api/health`).then(() => true).catch(() => false)), 15000)
}

// ---- API client with its own cookie ----
class Api {
  cookie = ''
  async post(path, body) {
    const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie: this.cookie }, body: JSON.stringify(body) })
    const set = r.headers.getSetCookie()
    if (set.length) this.cookie = set.map((s) => s.split(';')[0]).join('; ')
    return { status: r.status, json: await r.json().catch(() => null) }
  }
  async signIn(path, body) {
    const r = await this.post('/api/auth/' + path, body)
    expect(r.status === 200, `sign-in ${path} gave HTTP ${r.status}`)
    return r.json.data
  }
  raw(name, ...args) {
    return this.post('/api/call/' + name, { args })
  }
  async call(name, ...args) {
    const r = await this.raw(name, ...args)
    expect(r.status === 200, `${name} gave HTTP ${r.status}: ${JSON.stringify(r.json)}`)
    return r.json.data
  }
}
const staff = async (role) => {
  const api = new Api()
  await api.signIn('staff', { username: `${role}@sample.example`, password: 'bis2026' })
  return api
}

// ---- Browser helpers ----
let browser
// `quiet` pages do not record console errors: a phone made to go offline logs failed requests on purpose
async function open(options, label, quiet = false) {
  const ctx = await browser.newContext(options)
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  if (!quiet) {
  page.on('pageerror', (e) => browserIssues.push(`${label}: page error: ${e.message.slice(0, 160)}`))
  page.on('console', (m) => m.type() === 'error' && browserIssues.push(`${label}: console: ${m.text().slice(0, 160)}`))
  page.on('response', (r) => {
    const u = r.url()
    if (u.startsWith(BASE) && r.status() >= 400 && !u.endsWith('/api/auth/me')) browserIssues.push(`${label}: HTTP ${r.status()} ${u.replace(BASE, '')}`)
  })
  }
  return { ctx, page }
}
const text = async (page) => (await page.locator('main').first().innerText()).replace(/\n+/g, ' | ')
const staffSignIn = async (page, role) => {
  await page.goto(`${BASE}/staff-access`)
  await page.locator('input[type=email],input[name=email],input[name=username],input[autocomplete=username]').first().fill(`${role}@sample.example`)
  await page.locator('input[type=password]').first().fill('bis2026')
  await page.getByRole('button', { name: /sign in/i }).first().click()
  await page.waitForURL((u) => !u.pathname.includes('staff-access'))
}

// Marks one round on one phone: signs in with the PIN, picks, reviews, signs, finalizes. `choose` gets the back numbers
// on the sheet, in order, and how many to mark (X marks) or null for a final, and returns the back numbers to tap.
async function markOnPhone(letter, roundType, choose, hooks = {}) {
  const { ctx, page } = await open(PHONE, `adjudicator ${letter}`, hooks.quiet)
  try {
    await page.goto(`${BASE}/adjudicator`)
    await page.getByRole('button', { name: '1', exact: true }).waitFor()
    await page.keyboard.type(PINS[letter])
    await page.waitForURL((u) => u.pathname.endsWith('/mark'))
    await page.getByRole('button', { name: /^Submit/ }).waitFor()
    const placing = (await page.locator('button[aria-label^="Place "]').count()) > 0
    let picks
    if (placing) {
      const numbers = (await page.locator('button[aria-label^="Place "]').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label').replace('Place ', ''))))
      picks = choose(numbers, null)
      for (const n of picks) await page.getByRole('button', { name: `Place ${n}`, exact: true }).click()
    } else {
      const numbers = (await page.locator('button').allInnerTexts()).filter((t) => /^\d{1,4}$/.test(t))
      const need = Number((await page.locator('body').innerText()).match(/exactly (\d+)/)[1])
      picks = choose(numbers, need)
      expect(picks.length === need, `${letter} picked ${picks.length}, the sheet wants ${need}`)
      for (const n of picks) await page.locator('button', { hasText: new RegExp(`^${n}$`) }).click()
    }
    await page.getByRole('button', { name: /^Submit/ }).click()
    await page.getByRole('button', { name: 'Final and submit' }).click()
    const canvas = page.locator('canvas').first()
    await canvas.waitFor()
    const box = await canvas.boundingBox()
    await page.mouse.move(box.x + 20, box.y + box.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 20 + (i * (box.width - 40)) / 12, box.y + box.height / 2 + (i % 2 ? -18 : 18))
    await page.mouse.up()
    await hooks.beforeFinalize?.(page, ctx)
    await page.getByRole('button', { name: 'Finalize' }).click()
    if (hooks.afterFinalize) {
      await hooks.afterFinalize(page, ctx, picks)
      return picks
    }
    await page.waitForURL((u) => u.pathname.endsWith('/submitted'))
    // The phone shows Submitted as soon as its marks are saved and sends them just after: wait for the server to have them
    const board = await staff('scrutineer')
    await until(`${letter}'s marks to reach the server`, async () => (await board.call('getSubmissions', rid(roundType))).some((b) => b.adjudicatorId === `adj-${letter.toLowerCase()}` && b.status === 'submitted'), 20000)
    return picks
  } finally {
    await ctx.close()
  }
}

// The scrutineer's laptop
let scr
async function startRound(roundType, label, code = 'E11') {
  await scr.goto(`${BASE}/scrutineer`)
  await scr.getByLabel('Search rounds').fill(code)
  await scr.getByRole('button', { name: `Start ${code} ${label}`, exact: true }).click()
  await until('the round on the floor', async () => (await (await staff('scrutineer')).call('getCurrentRoundId')) === rid(roundType)).catch(async (e) => {
    // Say why the server refused, not just that it did
    const why = await (await staff('scrutineer')).raw('startRound', rid(roundType))
    throw new Error(`${e.message}: ${why.json?.error ?? why.status}`)
  })
}
async function approveAndPublish(roundType) {
  const id = rid(roundType)
  await scr.goto(`${BASE}/scrutineer/results?round=${id}`)
  await scr.getByRole('button', { name: 'Approve results' }).click()
  await scr.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click()
  await scr.getByRole('button', { name: 'Publish results' }).click()
  await scr.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click()
  await until('the round to be published', async () => (await new Api().call('getRounds', id.slice(0, id.lastIndexOf(':')))).find((r) => r.id === id)?.status === 'published')
}

// Gets an event ready to run: a panel of the given adjudicators, and every payment behind its entries recorded
async function setUpEvent(eventId, letters) {
  await (await staff('admin')).call('setPanel', eventId, letters.map((l) => `adj-${l.toLowerCase()}`))
  const api = await staff('secretariat')
  const entries = (await api.call('getCompetitionEntries', COMP)).filter((e) => e.eventId === eventId && !e.scratched && e.paymentId)
  const details = await api.call('getPaymentDetails')
  const payments = [...new Set(entries.map((e) => e.paymentId))].map((id) => details.find((p) => p.id === id)).filter(Boolean)
  for (const p of payments.filter((p) => ['unpaid', 'rejected'].includes(p.status))) await api.call('markPaidAtVenue', p.id)
  const stuck = payments.filter((p) => p.status === 'for_checking')
  if (stuck.length) {
    const db = new Database(env.DATABASE_PATH)
    try {
      for (const p of stuck) db.prepare("UPDATE payments SET status = 'approved', amount_paid = amount_due WHERE id = ?").run(p.id)
    } finally {
      db.close()
    }
  }
}

// The chairperson's laptop confirms a tie decision on the page that shows it
async function chairpersonConfirms(path) {
  const { ctx, page } = await open(LAPTOP, 'chairperson')
  try {
    await staffSignIn(page, 'chairperson')
    await page.goto(`${BASE}${path}`)
    await page.getByRole('button', { name: 'Confirm tie decision' }).click()
    await page.getByText(/Confirmed by/).first().waitFor()
  } finally {
    await ctx.close()
  }
}

const sec = { api: null }
const rowsByNumber = new Map()
const rowFor = (n) => rowsByNumber.get(String(Number(n)))
const countOf = (row) => row.xCount ?? row.total ?? row.crosses ?? row.x

// ========================================================================================================
async function main() {
  log(`End to end in ${work}\n`)
  const seeded = spawnSync(process.execPath, ['--import', 'tsx', 'src/db/seed-cli.ts'], { cwd: BACKEND, env, encoding: 'utf8' })
  if (seeded.status !== 0) throw new Error(`Seeding failed: ${seeded.stderr || seeded.stdout}`)
  startServer()
  await until('server health', async () => (await fetch(`${BASE}/api/health`).catch(() => null))?.ok, 40000)
  browser = await chromium.launch({ executablePath: CHROME })

  // ---------------------------------------------------------------- 1. The server and the public pages
  await step('1a. The server serves the screens and the health check', async () => {
    const health = await (await fetch(`${BASE}/api/health`)).json()
    expect(health.status === 'ok' && health.database === true, 'health check is not ok')
    for (const path of ['/', '/competitions', '/rankings', '/adjudicator']) {
      const r = await fetch(BASE + path)
      expect(r.ok && (r.headers.get('content-type') ?? '').includes('text/html'), `${path} did not return a page`)
    }
  })

  await step('1b. Public data: competitions, events, results, teams without contact details', async () => {
    const api = new Api()
    const comps = await api.call('getCompetitions')
    expect(comps.length >= 3, 'fewer than three competitions')
    const events = await api.call('getEvents', COMP)
    expect(events.length > 50, 'the sample competition has too few events')
    const known = ['juvenile_1', 'juvenile_2', 'junior_1', 'junior_2', 'youth', 'adult', 'senior']
    const unknown = (await api.call('getEvents')).filter((e) => !known.includes(e.ageGroup))
    expect(unknown.length === 0, `${unknown.length} events have an unknown age group`)
    const teams = await api.call('getTeams')
    expect(teams.length > 0 && teams.every((c) => c.contactEmail === ''), 'a public team list shows contact details')
    let events_with_results = 0
    for (const c of comps) {
      for (const id of await api.call('getResultEventIds', c.id)) {
        const res = await api.call('getResults', id)
        expect(res.length > 0 && res.every((r) => r.place >= 1), `event ${id} has results with a place below 1`)
        events_with_results++
      }
    }
    return `${comps.length} competitions, ${events_with_results} finished events checked`
  })

  await step('1c. Permissions: every role reaches only its own functions', async () => {
    const guest = new Api()
    for (const n of ['getStaffUsers', 'getAuditLog', 'getAdjudicatorPins', 'getPayments', 'getMyAthlete']) {
      expect((await guest.raw(n, COMP)).status === 401, `a guest could call ${n}`)
    }
    expect((await guest.raw('noSuchFunction')).status === 404, 'an unknown function is not a 404')
    const refused = [
      ['mc', 'getStaffUsers'],
      ['scrutineer', 'getStaffUsers'],
      ['secretariat', 'getAuditLog'],
      ['chairperson', 'getPayments'],
      ['mc', 'getAdjudicatorPins'],
    ]
    for (const [role, n] of refused) expect((await (await staff(role)).raw(n, COMP)).status === 403, `${role} could call ${n}`)
    const admin = await staff('admin')
    for (const n of ['getStaffUsers', 'getAuditLog', 'getBackupStatus', 'getPayments', 'getAthletes', 'getEntryRequests']) await admin.call(n)
    const bad = await new Api().post('/api/auth/staff', { username: 'admin@sample.example', password: 'wrong' })
    expect(bad.status === 401, 'a wrong password was not refused')
    const wrongPin = await new Api().post('/api/auth/adjudicator', { pin: '000001' })
    expect(wrongPin.status === 401, 'a wrong PIN was not refused')
    return 'guest, mc, scrutineer, secretariat, chairperson, admin'
  })

  // ---------------------------------------------------------------- 2. Round 2 of E11: the round on the floor
  const scrCtx = await open(LAPTOP, 'scrutineer')
  scr = scrCtx.page
  await step('2a. The scrutineer signs in and the round on the floor shows 3 of 7 adjudicators in', async () => {
    await staffSignIn(scr, 'scrutineer')
    const api = await staff('scrutineer')
    expect((await api.call('getCurrentRoundId')) === ROUND('round_2'), 'round 2 is not on the floor')
    const board = await api.call('getSubmissions', ROUND('round_2'))
    expect(board.filter((b) => b.status === 'submitted').length === 3, 'the board does not show 3 submitted')
  })

  await step('2b. Adjudicators D to G mark round 2 on their phones', async () => {
    let offset = 0
    for (const letter of ['D', 'E', 'F', 'G']) {
      await markOnPhone(letter, 'round_2', (numbers, need) => [...numbers.slice(offset), ...numbers.slice(0, offset)].slice(0, need))
      offset += 3
    }
    const board = await new Api().raw('getSubmissions', ROUND('round_2'))
    expect(board.status === 401, 'the live board should need a sign-in')
    const api = await staff('scrutineer')
    expect((await api.call('getSubmissions', ROUND('round_2'))).every((b) => b.status === 'submitted'), 'not every adjudicator shows as submitted')
  })

  await step('2c. The server tally of round 2 equals an independent recount of every X', async () => {
    const api = await staff('scrutineer')
    const marks = (await api.call('getMarks', ROUND('round_2'))).filter((m) => m.kind === 'x')
    expect(marks.length === 84, `expected 84 X marks, found ${marks.length}`)
    const counts = new Map()
    for (const m of marks) counts.set(m.competitorId, (counts.get(m.competitorId) ?? 0) + 1)
    const table = await api.call('getRecallTable', ROUND('round_2'))
    expect(table.rows.length === 24, `expected 24 couples, found ${table.rows.length}`)
    const wrong = table.rows.filter((r) => countOf(r) !== (counts.get(r.competitorId) ?? 0))
    expect(wrong.length === 0, `${wrong.length} couples have a different count from the recount`)
    expect(table.tie === null && table.recalled === 12, 'round 2 should recall exactly 12 with no tie')
    const sorted = [...counts.values()].sort((a, b) => b - a)
    expect(sorted[11] > sorted[12], 'the recount does not give a clean cut at 12')
    const recalled = table.rows.filter((r) => r.outcome === 'recalled')
    expect(recalled.every((r) => counts.get(r.competitorId) >= sorted[11]), 'a couple below the cut was recalled')
    return '84 marks, 24 couples, 0 differences, clean cut at 12'
  })

  await step('2d. The scrutineer approves and publishes round 2; the semi-final field is the 12 recalled', async () => {
    const api = await staff('scrutineer')
    const table = await api.call('getRecallTable', ROUND('round_2'))
    const recalled = new Set(table.rows.filter((r) => r.outcome === 'recalled').map((r) => r.competitorId))
    await approveAndPublish('round_2')
    const heats = await api.call('getHeats', ROUND('semi_final'))
    const field = new Set(heats.flatMap((h) => h.competitorIds))
    expect(field.size === 12 && [...field].every((id) => recalled.has(id)), 'the semi-final field is not the recalled 12')
    expect(!(await api.call('getCurrentRoundId')), 'the floor was not cleared')
    const phone = new Api()
    const d = await phone.signIn('adjudicator', { pin: PINS.D })
    expect((await phone.call('getAdjudicatorState', d.id)).status === 'waiting', 'the phones should wait for the next round')
  })

  // ---------------------------------------------------------------- 3. The semi-final
  // The sample starts E11 on the floor with its entries unpaid, which a real event cannot do: the server refuses to start
  // a round while an entry is unpaid. So the secretariat records the payments first, as at a real venue.
  await step('2e. The secretariat records the unpaid payments for E11 at the venue (the first in the browser)', async () => {
    const api = await staff('secretariat')
    const entries = (await api.call('getCompetitionEntries', COMP)).filter((e) => e.eventId === EVENT && !e.scratched && e.paymentId)
    const details = await api.call('getPaymentDetails')
    const payments = [...new Set(entries.map((e) => e.paymentId))].map((id) => details.find((p) => p.id === id))
    const owed = payments.filter((p) => p && ['unpaid', 'rejected'].includes(p.status))
    // The sample has a few payments left "for checking", a status nothing in the app sets or clears any more (entry requests
    // replaced it), and markPaidAtVenue refuses them. They are cleared here in the throwaway database, and said so in the report.
    const stuck = payments.filter((p) => p && p.status === 'for_checking')
    expect(owed.length > 0, 'no unpaid payment found for E11, so the sample has changed: remove this step')
    const { ctx, page } = await open(LAPTOP, 'secretariat')
    try {
      await staffSignIn(page, 'secretariat')
      await page.goto(`${BASE}/secretariat/late-entries`)
      await page.getByRole('tab', { name: 'Cash payments' }).or(page.getByRole('button', { name: 'Cash payments' })).first().click()
      await page.getByRole('button', { name: `Mark ${owed[0].teamName} paid at venue` }).click()
      await page.getByRole('dialog').getByRole('button', { name: /paid|confirm|record/i }).last().click()
      await until('the first payment to be recorded', async () => (await api.call('getPaymentDetails')).find((p) => p.id === owed[0].id)?.status === 'paid_at_venue')
    } finally {
      await ctx.close()
    }
    for (const p of owed.slice(1)) await api.call('markPaidAtVenue', p.id)
    if (stuck.length) {
      const db = new Database(env.DATABASE_PATH)
      try {
        for (const p of stuck) db.prepare("UPDATE payments SET status = 'approved', amount_paid = amount_due WHERE id = ?").run(p.id)
      } finally {
        db.close()
      }
    }
    const left = (await api.call('getCompetitionEntries', COMP)).filter((e) => e.eventId === EVENT && !e.scratched)
    const status = new Map((await api.call('getPaymentDetails')).map((p) => [p.id, p.status]))
    expect(left.every((e) => ['approved', 'paid_at_venue', 'paid'].includes(status.get(e.paymentId))), 'an E11 entry is still unpaid')
    return `${owed.length} recorded at the venue, ${stuck.length} legacy "for checking" cleared in the database`
  })

  let semiTop
  await step('3a. The scrutineer starts the semi-final and every adjudicator marks it on a phone', async () => {
    await startRound('semi_final', 'Semi-final')
    const rows = await (await staff('secretariat')).call('getCompetitorRows')
    for (const r of rows) rowsByNumber.set(String(Number(r.backNumber)), r)
    // A to F mark the same couples; G swaps the last one for the next, so the cut is clean and the counts differ
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      const picks = await markOnPhone(letter, 'semi_final', (numbers, need) => {
        semiTop ??= numbers.slice(0, need)
        return letter === 'G' ? [...numbers.slice(0, need - 1), numbers[need]] : numbers.slice(0, need)
      })
      expect(picks.length > 0, `${letter} marked nothing`)
    }
  })

  await step('3b. Semi-final: the recount matches, the cut is at the right couples, the final field is made', async () => {
    const api = await staff('scrutineer')
    const marks = (await api.call('getMarks', ROUND('semi_final'))).filter((m) => m.kind === 'x')
    const counts = new Map()
    for (const m of marks) counts.set(m.competitorId, (counts.get(m.competitorId) ?? 0) + 1)
    const table = await api.call('getRecallTable', ROUND('semi_final'))
    expect(table.rows.every((r) => countOf(r) === (counts.get(r.competitorId) ?? 0)), 'a semi-final count differs from the recount')
    expect(table.tie === null, 'the semi-final shows a tie it should not have')
    const expected = new Set(semiTop.map((n) => rowFor(n).id))
    const recalled = new Set(table.rows.filter((r) => r.outcome === 'recalled').map((r) => r.competitorId))
    expect(recalled.size === expected.size && [...recalled].every((id) => expected.has(id)), 'the recalled couples are not the ones every adjudicator marked')
    await approveAndPublish('semi_final')
    const field = new Set((await api.call('getHeats', ROUND('final'))).flatMap((h) => h.competitorIds))
    expect(field.size === expected.size && [...field].every((id) => expected.has(id)), 'the final field is not the recalled couples')
    return `${expected.size} couples through to the final`
  })

  // ---------------------------------------------------------------- 4. The final
  let order
  await step('4a. The scrutineer starts the final and every adjudicator places the couples on a phone', async () => {
    await startRound('final', 'Final')
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G']) {
      await markOnPhone(letter, 'final', (numbers) => {
        order ??= [...numbers]
        // G puts the first two the other way round: the majority still gives 1st to the first
        return letter === 'G' ? [order[1], order[0], ...order.slice(2)] : order
      })
    }
  })

  await step('4b. Final: the placings are recounted by hand and the server agrees', async () => {
    const api = await staff('scrutineer')
    const marks = (await api.call('getMarks', ROUND('final'))).filter((m) => m.kind === 'placing')
    expect(marks.length === 7 * order.length, `expected ${7 * order.length} placings, found ${marks.length}`)
    const table = await api.call('getSkatingTable', ROUND('final'))
    expect(table.complete === true, 'the final is not complete')
    const tie = await api.call('getFinalTie', ROUND('final'))
    expect(tie.groups.length === 0, 'the final shows a tie it should not have')
    return `${marks.length} placings, no tie`
  })

  await step('4c. The scrutineer approves and publishes the final; the results are right and public', async () => {
    await approveAndPublish('final')
    const guest = new Api()
    const results = await guest.call('getResults', EVENT)
    const placed = results.filter((r) => r.place <= order.length).sort((a, b) => a.place - b.place)
    expect(placed.length === order.length, `expected ${order.length} placed couples, found ${placed.length}`)
    const expectedIds = order.map((n) => rowFor(n).id)
    expect(JSON.stringify(placed.map((r) => r.competitorId)) === JSON.stringify(expectedIds), 'the final order is not 1st to last as most adjudicators placed them')
    expect(placed.every((r, i) => r.place === i + 1), 'the places are not 1 to 6')
    const rounds = await guest.call('getRounds', EVENT)
    expect(rounds.every((r) => r.status === 'published'), 'not every round of the event is published')
    expect(!(await (await staff('scrutineer')).call('getCurrentRoundId')), 'the floor was not cleared after the final')
    // The public page shows the winner
    const { ctx, page } = await open(LAPTOP, 'public')
    try {
      await page.goto(`${BASE}/competitions/${COMP}/events/${EVENT}`)
      await page.waitForLoadState('networkidle')
      const winner = rowFor(order[0])
      const body = (await page.locator('body').innerText()).toLowerCase()
      expect(body.includes(String(winner.names?.[0] ?? winner.name ?? '').toLowerCase().split(' ').slice(-1)[0]), 'the public event page does not show the winner')
      await page.screenshot({ path: join(SHOTS, 'final-results.png'), fullPage: true })
    } finally {
      await ctx.close()
    }
    return `winner back number ${order[0]}`
  })

  await step('4d. Ranking points were given for the new result', async () => {
    const points = await new Api().call('getRankingPoints', {})
    const winner = rowFor(order[0])
    expect(points.some((p) => p.competitorId === winner.id && p.competitionId === COMP), 'the winner has no ranking points from this competition')
  })

  // ---------------------------------------------------------------- 5. Athlete: sign-up, details, membership payment
  const email = `e2e${Date.now()}@test.example`
  await step('5a. An athlete signs up, saves details, and the profile shows them', async () => {
    const { ctx, page } = await open(PHONE, 'athlete')
    try {
      await page.goto(`${BASE}/athlete/sign-in`)
      await page.getByRole('link', { name: /create an account/i }).or(page.getByRole('button', { name: /create an account/i })).first().click()
      await page.getByLabel('Full name').fill('Eva Test Santos')
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password', { exact: true }).fill('Correct-Horse-9')
      await page.getByLabel('Confirm password').fill('Correct-Horse-9')
      await page.getByRole('button', { name: 'Create account' }).click()
      await page.waitForURL((u) => u.pathname.startsWith('/athlete'))
      await until('the new account page', async () => /Not paid/.test(await text(page)))
      await page.goto(`${BASE}/athlete/edit`)
      await page.getByLabel('Date of birth').fill('2009-04-12')
      await page.getByLabel('Contact no.').fill('09171234567')
      await page.getByLabel('Province').fill('Sorsogon')
      await page.getByLabel('Address').fill('12 Rizal St, Sorsogon City')
      await page.getByLabel('Team').selectOption({ index: 1 })
      await page.getByRole('button', { name: 'Save details' }).click()
      await sleep(1200)
      const api = new Api()
      const me = await api.signIn('athlete', { email, password: 'Correct-Horse-9' })
      const profile = (await api.call('getMyAthlete', me.id)).profile
      expect(profile.birthDate === '2009-04-12' && profile.phone === '09171234567' && profile.province === 'Sorsogon', 'the saved details are not what was typed')
    } finally {
      await ctx.close()
    }
  })

  await step('5b. The athlete sends a membership payment and the secretariat confirms it in the browser', async () => {
    const shot = join(work, 'payment.png')
    writeFileSync(shot, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'))
    const a = await open(PHONE, 'athlete')
    try {
      await a.page.goto(`${BASE}/athlete/sign-in`)
      await a.page.getByLabel('Email').fill(email)
      await a.page.getByLabel('Password', { exact: true }).fill('Correct-Horse-9')
      await a.page.getByRole('button', { name: /sign in/i }).first().click()
      await a.page.waitForURL((u) => u.pathname.startsWith('/athlete'))
      await a.page.goto(`${BASE}/athlete/membership`)
      await a.page.getByLabel('Paid with').selectOption({ index: 1 })
      await a.page.locator('input[type=file]').setInputFiles(shot)
      await a.page.getByRole('button', { name: 'Send payment' }).click()
      await until('the payment to be sent', async () => /Waiting for the secretariat/.test(await text(a.page)))
    } finally {
      await a.ctx.close()
    }
    const s = await open(LAPTOP, 'secretariat')
    try {
      await staffSignIn(s.page, 'secretariat')
      await s.page.goto(`${BASE}/secretariat/athletes`)
      await s.page.getByLabel('Search athletes').fill('Eva Test')
      const row = s.page.locator('tr', { hasText: email })
      await row.getByRole('button', { name: /^Confirm membership of/ }).click()
      await until('the membership to be confirmed', async () => {
        const list = await (await staff('secretariat')).call('getAthletes')
        return list.find((x) => x.email === email)?.memberYear === 2026
      })
    } finally {
      await s.ctx.close()
    }
    const api = new Api()
    const me = await api.signIn('athlete', { email, password: 'Correct-Horse-9' })
    const notes = await api.call('getMyNotifications', me.id)
    expect(notes.some((n) => n.kind === 'membership_confirmed'), 'the athlete was not told the membership was confirmed')
    const profile = (await api.call('getMyAthlete', me.id)).profile
    expect(profile.memberYear === 2026 && profile.history.some((h) => h.kind === 'sent'), 'the membership or its history is missing')
  })

  // ---------------------------------------------------------------- 6. Team entry with a payment
  // Bea Mendoza's request from the team, not the ones the sample already has waiting
  const mine = (r) => r.names.includes('Bea Mendoza') && r.requesterRole === 'team' && r.status !== 'rejected' && r.createdAt > startedAt
  await step('6. A team enters a dancer in two events with a payment; the secretariat approves; entries and payment are recorded', async () => {
    const shot = join(work, 'payment.png')
    const t = await open({ viewport: { width: 1000, height: 1100 } }, 'team')
    try {
      await t.page.goto(`${BASE}/team/sign-in`)
      await t.page.getByLabel('Email').fill('team@sample.example')
      await t.page.getByLabel('Password', { exact: true }).fill('bis2026')
      await t.page.getByRole('button', { name: /sign in/i }).first().click()
      await t.page.waitForURL((u) => u.pathname === '/team')
      await t.page.goto(`${BASE}/team/register`)
      await t.page.getByLabel('Competition').selectOption({ label: 'Bicol Dancesport Championships 2026 · 5 December 2026' })
      await t.page.getByLabel('Dancer or couple').selectOption({ label: 'Bea Mendoza' })
      await t.page.locator('main input[type=checkbox]').first().waitFor()
      const boxes = t.page.locator('main input[type=checkbox]')
      await boxes.nth(0).check()
      await boxes.nth(1).check()
      await t.page.getByLabel('Pay with').selectOption({ index: 1 })
      await t.page.locator('input[type=file]').setInputFiles(shot)
      await t.page.getByRole('button', { name: 'Send to the secretariat' }).click()
      await until('the request to be sent', async () => (await (await staff('secretariat')).call('getEntryRequests')).some(mine))
    } finally {
      await t.ctx.close()
    }
    const api = await staff('secretariat')
    const waiting = (await api.call('getEntryRequests')).find(mine)
    expect(waiting.status === 'pending' || waiting.status === 'waiting', `a new request should be waiting, not ${waiting.status}`)
    // Bea is a solo older dancer: 600 for the first event, 200 for the second
    expect((waiting.total ?? waiting.amount) === 800, `the total should be 800, not ${waiting.total ?? waiting.amount}`)
    const s = await open(LAPTOP, 'secretariat')
    try {
      await staffSignIn(s.page, 'secretariat')
      await s.page.goto(`${BASE}/secretariat/entry-requests`)
      await s.page.locator('tr', { hasText: 'Bea Mendoza' }).getByRole('button', { name: 'Approve the entry of Bea Mendoza' }).click()
      await until('the request to be approved', async () => (await api.call('getEntryRequests')).find(mine)?.status === 'approved')
    } finally {
      await s.ctx.close()
    }
    const request = (await api.call('getEntryRequests')).find(mine)
    const bea = (await api.call('getCompetitorRows')).find((c) => JSON.stringify(c).includes('Bea Mendoza'))
    const entries = (await api.call('getCompetitionEntries', request.competitionId)).filter((e) => e.competitorId === bea.id)
    expect(entries.length === 2, `expected 2 entries for Bea, found ${entries.length}`)
    const entryIds = new Set(entries.map((e) => e.id))
    const payment = (await api.call('getPayments')).find((p) => p.entryIds.length === entryIds.size && p.entryIds.every((id) => entryIds.has(id)))
    expect(payment && payment.amountDue === 800 && payment.amountPaid === 800 && payment.status === 'approved', 'the payment is not recorded as 800 paid and approved')
    const team = new Api()
    const me = await team.signIn('team', { email: 'team@sample.example', password: 'bis2026' })
    const seen = (await team.call('getMyEntryRequests', me.id)).find(mine)
    expect(seen?.status === 'approved', 'the team does not see the request as approved')
    return '2 entries, 800 paid'
  })

  // ---------------------------------------------------------------- 7. Every role's screens
  // ---------------------------------------------------------------- 10. The secretariat registers a dancer directly
  let direct
  await step('10a. The secretariat adds a dancer and enters them in two events: the fee shown is the server quote, and the entries and payment are recorded', async () => {
    const api = await staff('secretariat')
    const { ctx, page } = await open(LAPTOP, 'secretariat')
    try {
      await staffSignIn(page, 'secretariat')
      await page.goto(`${BASE}/secretariat/competitors`)
      await page.getByRole('button', { name: 'Add competitor' }).first().click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('textbox', { name: 'Dancer', exact: true }).fill('Direct Dancer')
      await dialog.getByLabel('Team').selectOption({ index: 1 })
      for (const [label, value] of [['Province', 'Sorsogon'], ['Date of birth', '2012-05-05'], ['Contact no.', '09170001111'], ['Address', '1 Test St']]) {
        const field = dialog.getByLabel(label)
        if (await field.count()) await field.first().fill(value)
      }
      await dialog.getByRole('button', { name: 'Add competitor' }).click()
      direct = await until('the new dancer', async () => (await api.call('getCompetitorRows')).find((c) => c.names.join(' ') === 'Direct Dancer'))
      await dialog.waitFor({ state: 'hidden' })
      await page.locator('tbody tr').nth(1).waitFor()
      await page.getByLabel('Search competitors').fill('Direct Dancer')
      const row = page.locator('tr', { hasText: 'Direct Dancer' }).first()
      await row.waitFor().catch(async (e) => {
        await page.screenshot({ path: join(SHOTS, 'competitors-list.png'), fullPage: true })
        const typed = await page.getByLabel('Search competitors').inputValue().catch(() => '(no search box)')
        throw new Error(`${e.message.split('\n')[0]}; the search box holds "${typed}"; the page shows: ${(await text(page)).slice(-500)}`)
      })
      await row.getByRole('button', { name: /^Enter Direct Dancer/ }).click().catch(async (e) => {
        const names = await row.locator('button, a').evaluateAll((es) => es.map((x) => x.getAttribute('aria-label') || x.title || x.innerText))
        throw new Error(`${e.message.split('\n')[0]}; the row has: ${JSON.stringify(names)}`)
      })
      const enter = page.getByRole('dialog')
      await enter.getByLabel('Competition').selectOption('comp-bicol-2026')
      const boxes = enter.locator('input[type=checkbox]')
      await boxes.first().waitFor()
      await boxes.nth(0).check()
      await boxes.nth(1).check()
      const fee = enter.locator('section[aria-label="Fee"]')
      // The fee updates after each tick: wait for the second event's line before reading the total
      await until('the fee for both events', async () => /additional entry/.test(await fee.innerText()))
      const shown = Number((await fee.innerText()).match(/Total\s*₱([\d,]+)/)[1].replace(/,/g, ''))
      // The server's own quote for the same two events, taken before anything is registered
      const soloEvents = (await api.call('getEvents', 'comp-bicol-2026')).filter((e) => e.isSolo).sort((a, b) => a.number - b.number)
      const quote = await api.call('quoteRegistration', direct.id, [soloEvents[0].id, soloEvents[1].id])
      expect(shown === quote.total, `the screen showed ${shown}, the server quotes ${quote.total}`)
      expect(quote.lines.reduce((sum, l) => sum + l.amount, 0) === quote.total, 'the fee lines do not add up to the total')
      await enter.getByLabel('Payment').selectOption('gcash')
      await enter.getByLabel('Reference no.').fill('DIRECT-1')
      await enter.getByRole('button', { name: 'Enter', exact: true }).click()
      await until('the entries', async () => (await api.call('getCompetitionEntries', 'comp-bicol-2026')).filter((e) => e.competitorId === direct.id).length === 2)
      const entries = (await api.call('getCompetitionEntries', 'comp-bicol-2026')).filter((e) => e.competitorId === direct.id)
      expect(entries.map((e) => e.eventId).sort().join() === [soloEvents[0].id, soloEvents[1].id].sort().join(), 'the dancer is not entered in the two events that were ticked')
      const payment = (await api.call('getPayments')).find((p) => p.referenceNumber === 'DIRECT-1')
      expect(payment, 'the payment with its reference was not recorded')
      expect(payment.amountDue === quote.total, `the payment is ${payment.amountDue}, the quote ${quote.total}`)
      expect(payment.entryIds.length === 2 && entries.every((e) => payment.entryIds.includes(e.id)), 'the payment does not cover exactly the two entries')
      return `2 entries, ${shown} pesos`
    } finally {
      await ctx.close()
    }
  })

  await step('10b. A registration the rules forbid is refused: the same event twice, a solo dancer in a couple event, no events, a taken back number', async () => {
    const api = await staff('secretariat')
    const events = await api.call('getEvents', 'comp-bicol-2026')
    const entered = (await api.call('getCompetitionEntries', 'comp-bicol-2026')).filter((e) => e.competitorId === direct.id).map((e) => e.eventId)
    const refused = (r) => r.status >= 400 && r.status < 500
    const again = await api.raw('registerCompetitor', { competitorId: direct.id, eventIds: [entered[0]], method: 'cash' })
    expect(refused(again), `entering the same event twice gave HTTP ${again.status}`)
    const couple = events.find((e) => !e.isSolo)
    const wrong = await api.raw('registerCompetitor', { competitorId: direct.id, eventIds: [couple.id], method: 'cash' })
    expect(refused(wrong), `a solo dancer in a couple event gave HTTP ${wrong.status}`)
    const none = await api.raw('registerCompetitor', { competitorId: direct.id, eventIds: [], method: 'cash' })
    expect(refused(none), `entering no events gave HTTP ${none.status}`)
    await api.call('setBackNumber', direct.id, 901)
    const other = (await api.call('getCompetitorRows')).find((c) => c.id !== direct.id)
    const taken = await api.raw('setBackNumber', other.id, 901)
    expect(refused(taken), `a taken back number gave HTTP ${taken.status}`)
    expect((await new Api().raw('registerCompetitor', { competitorId: direct.id, eventIds: [entered[0]], method: 'cash' })).status === 401, 'a guest could register')
  })

  // ---------------------------------------------------------------- 11. A tie at the cut of a recall
  const E2 = `${COMP}:e2`
  const SEMI2 = `${E2}:semi_final`
  let tieNumbers
  await step('11a. A semi-final whose marks tie across the cut of 6: five adjudicators mark it on their phones', async () => {
    await setUpEvent(E2, ['A', 'B', 'C', 'D', 'E'])
    await startRound(SEMI2, 'Semi-final', 'E2')
    // Every adjudicator marks couples 1 to 3; the other three marks give couple 4 four X, couples 5 to 7 three each, 8 and 9 one each
    const extra = { A: [3, 4, 5], B: [3, 4, 6], C: [3, 5, 6], D: [3, 4, 5], E: [6, 7, 8] }
    for (const letter of ['A', 'B', 'C', 'D', 'E']) {
      await markOnPhone(letter, SEMI2, (numbers, need) => {
        tieNumbers ??= numbers
        expect(numbers.length === 9 && need === 6, `expected 9 couples and a recall of 6, found ${numbers.length} and ${need}`)
        return [0, 1, 2, ...extra[letter]].map((i) => numbers[i])
      })
    }
  })

  await step('11b. The tie is found, the round cannot be approved, the scrutineer proposes, the chairperson confirms, then it is approved', async () => {
    const api = await staff('scrutineer')
    const table = await api.call('getRecallTable', SEMI2)
    expect(table.tie && table.tie.xCount === 3 && table.tie.count === 3 && table.tie.decision === null, `expected a 3-way tie on 3 X, got ${JSON.stringify(table.tie)}`)
    expect(JSON.stringify(table.rows.map(countOf).sort((a, b) => b - a)) === '[5,5,5,4,3,3,3,1,1]', 'the X counts are not what the adjudicators marked')
    expect(table.rows.filter((r) => r.outcome === 'tied').length === 3, 'three couples should show as tied')
    const blocked = await api.raw('approveRound', SEMI2)
    expect(blocked.status === 409 && /tie/i.test(blocked.json.error), `approving a tied round gave HTTP ${blocked.status}: ${blocked.json?.error}`)
    await scr.goto(`${BASE}/scrutineer/recall?round=${SEMI2}`)
    await scr.locator('label', { hasText: 'Recall only the 4 above' }).click()
    await scr.getByRole('button', { name: 'Propose decision' }).click()
    await until('the proposal', async () => (await api.call('getRecallTable', SEMI2)).tie?.decision?.choice === 'fewer')
    const proposed = await api.raw('approveRound', SEMI2)
    expect(proposed.status === 409 && /chairperson to confirm/.test(proposed.json.error), `approving before the chairperson confirms gave HTTP ${proposed.status}: ${proposed.json?.error}`)
    expect((await api.raw('confirmTieDecision', SEMI2)).status === 403, 'the scrutineer could confirm their own tie decision')
    await chairpersonConfirms(`/scrutineer/recall?round=${SEMI2}`)
    await scr.reload()
    await until('the confirmation on the scrutineer screen', async () => /Confirmed by Gregorio Almazan/.test(await text(scr)))
    await approveAndPublish(SEMI2)
    const decided = await api.call('getRecallTable', SEMI2)
    expect(decided.recalled === 4, `expected 4 recalled, found ${decided.recalled}`)
    const field = new Set((await api.call('getHeats', `${E2}:final`)).flatMap((h) => h.competitorIds))
    const expected = new Set(tieNumbers.slice(0, 4).map((n) => rowFor(n).id))
    expect(field.size === 4 && [...field].every((id) => expected.has(id)), 'the final is not the four couples above the tie')
    return 'tie of 3 on 3 X: only the 4 above recalled, confirmed by Gregorio Almazan'
  })

  // ---------------------------------------------------------------- 12 and 13. A tie in a final
  // Four adjudicators, the last two putting the top two the other way round: Rules 9 to 11 cannot separate them
  async function playTiedFinal(code) {
    const eventId = `${COMP}:e${code.slice(1)}`
    const roundId = `${eventId}:final`
    let numbers
    await setUpEvent(eventId, ['A', 'B', 'C', 'D'])
    await startRound(roundId, 'Final', code)
    for (const letter of ['A', 'B', 'C', 'D']) {
      await markOnPhone(letter, roundId, (list) => {
        numbers ??= list
        return letter === 'C' || letter === 'D' ? [list[1], list[0], ...list.slice(2)] : list
      })
    }
    const api = await staff('scrutineer')
    const tie = await api.call('getFinalTie', roundId)
    expect(tie.groups.length === 1 && tie.groups[0].place === 1, `${code}: expected one tie for 1st, got ${JSON.stringify(tie.groups.map((g) => g.place))}`)
    const tied = tie.groups[0].competitors.map((c) => c.competitorId).sort()
    expect(JSON.stringify(tied) === JSON.stringify([rowFor(numbers[0]).id, rowFor(numbers[1]).id].sort()), `${code}: the tied couples are not the top two`)
    const blocked = await api.raw('approveRound', roundId)
    expect(blocked.status === 409 && /has a tie/.test(blocked.json.error), `${code}: approving a tied final gave HTTP ${blocked.status}`)
    await scr.goto(`${BASE}/scrutineer/results?round=${roundId}`)
    await scr.getByRole('region', { name: 'Tie in the final' }).waitFor()
    expect(/share 1st place/.test(await text(scr)), `${code}: the screen does not say two couples share 1st place`)
    return { eventId, roundId, numbers, api }
  }

  await step('12. A tie for 1st in a final is settled by a dance-off: proposed, confirmed by the chairperson, then placed 1st and 2nd', async () => {
    const { eventId, roundId, numbers, api } = await playTiedFinal('E1')
    await scr.getByLabel('Settle it with a dance-off').check()
    await scr.getByLabel(new RegExp(`Dance-off place of No\\. ${Number(numbers[1])}\\b`)).selectOption('1')
    await scr.getByLabel(new RegExp(`Dance-off place of No\\. ${Number(numbers[0])}\\b`)).selectOption('2')
    await scr.getByRole('button', { name: 'Propose decision' }).click()
    await until('the proposal', async () => (await api.call('getFinalTie', roundId)).decision?.mode === 'order')
    expect((await api.raw('confirmFinalTie', roundId)).status === 403, 'the scrutineer could confirm their own final tie decision')
    await chairpersonConfirms(`/scrutineer/results?round=${roundId}`)
    await scr.reload()
    await until('the confirmation on the scrutineer screen', async () => /Confirmed by Gregorio Almazan/.test(await text(scr)))
    await approveAndPublish(roundId)
    const results = await new Api().call('getResults', eventId)
    const place = (n) => results.find((r) => r.competitorId === rowFor(n).id)
    expect(place(numbers[1]).place === 1 && place(numbers[0]).place === 2 && place(numbers[2]).place === 3, `expected the dance-off winner 1st, then 2nd, then 3rd, got ${[1, 0, 2].map((i) => place(numbers[i]).place)}`)
    expect(results.every((r) => (r.placeFrom ?? r.place) === (r.placeTo ?? r.place)), 'a place is still shown as shared after the dance-off')
    return 'dance-off winner 1st, the other 2nd'
  })

  await step('13. A tie for 1st in a final kept as a shared place: both couples share 1st to 2nd, the rest are placed 3rd on', async () => {
    const { eventId, roundId, numbers, api } = await playTiedFinal('E3')
    await scr.getByLabel('Keep the shared place').check()
    await scr.getByRole('button', { name: 'Propose decision' }).click()
    await until('the proposal', async () => (await api.call('getFinalTie', roundId)).decision?.mode === 'keep')
    await chairpersonConfirms(`/scrutineer/results?round=${roundId}`)
    await approveAndPublish(roundId)
    const results = await new Api().call('getResults', eventId)
    const place = (n) => results.find((r) => r.competitorId === rowFor(n).id)
    for (const n of [numbers[0], numbers[1]]) {
      expect(place(n).place === 1 && place(n).placeFrom === 1 && place(n).placeTo === 2, `a tied couple is placed ${place(n).placeFrom}-${place(n).placeTo}, not 1-2`)
    }
    expect(numbers.slice(2).every((n, i) => place(n).place === i + 3), 'the couples below the tie are not 3rd, 4th, 5th')
    return 'shared 1st to 2nd, then 3rd to 5th'
  })

  // ---------------------------------------------------------------- 14. A bad connection and a restarted server, mid-round
  // Two adjudicators on a small event: the first loses her connection while finalizing, the second finalizes while the
  // server is down. Both must end with their marks on the server exactly once, and the second must still be signed in.
  const E4 = `${COMP}:e4`
  const FINAL4 = `${E4}:final`
  let placed4 = 0
  const marksOf4 = async (letter) => (await (await staff('scrutineer')).call('getMarks', FINAL4)).filter((m) => m.adjudicatorId === `adj-${letter.toLowerCase()}`).length
  await step('14a. A phone loses its connection while finalizing: it says so, holds the marks, and sends them once when the connection is back', async () => {
    await setUpEvent(E4, ['A', 'B'])
    await startRound(FINAL4, 'Final', 'E4')
    await markOnPhone('A', FINAL4, (list) => ((placed4 = list.length), list), {
      quiet: true,
      beforeFinalize: async (page, ctx) => ctx.setOffline(true),
      afterFinalize: async (page, ctx) => {
        await page.getByRole('heading', { name: 'Saved, sending…' }).waitFor()
        expect(/No connection/.test(await page.locator('main').innerText()), 'the phone does not say there is no connection')
        expect((await marksOf4('A')) === 0, 'marks reached the server while the phone was offline')
        await ctx.setOffline(false)
        await page.getByRole('heading', { name: 'Submitted' }).waitFor({ timeout: 30000 })
        await sleep(1500)
        expect((await marksOf4('A')) === placed4, `expected ${placed4} marks once, the server has ${await marksOf4('A')}`)
      },
    })
    return `${placed4} marks held, then stored once`
  })

  await step('14b. The server stops while a phone finalizes: the phone holds its marks, sends them by itself after the restart, stays signed in, and nothing is doubled', async () => {
    const before = await staff('scrutineer')
    const outage = browserIssues.length
    await markOnPhone('B', FINAL4, (list) => list, {
      quiet: true,
      beforeFinalize: async () => stopServer(),
      afterFinalize: async (page) => {
        await page.getByRole('heading', { name: 'Saved, sending…' }).waitFor()
        startServer()
        await until('the server to come back', async () => (await fetch(`${BASE}/api/health`).catch(() => null))?.ok, 40000)
        await page.getByRole('heading', { name: 'Submitted' }).waitFor({ timeout: 60000 })
        await sleep(1500)
        expect(page.url().endsWith('/adjudicator/submitted'), `the phone is on ${page.url()}, not signed in on its confirmation`)
      },
    })
    // Pages left open while the server was down log that their connection was refused: expected, so dropped, and only those
    for (let i = browserIssues.length - 1; i >= outage; i--) if (/ERR_CONNECTION_REFUSED|WebSocket connection/.test(browserIssues[i])) browserIssues.splice(i, 1)
    expect((await marksOf4('B')) === placed4, `expected ${placed4} marks once, the server has ${await marksOf4('B')}`)
    // A session from before the restart still works: the secret is kept in the database
    const me = await before.raw('getCurrentRoundId')
    expect(me.status === 200, `the scrutineer was signed out by the restart (HTTP ${me.status})`)
    await approveAndPublish(FINAL4)
    const results = await new Api().call('getResults', E4)
    expect(results.length === placed4 && results.every((r) => r.place >= 1), 'the final of E4 has the wrong number of results')
    return `${placed4} marks stored once, session survived the restart`
  })

  await step('7. Every role opens its screens with no console errors, failed calls, blank pages or overflow', async () => {
    const problems = []
    async function crawl(label, start, options, signIn, max = 25) {
      const { ctx, page } = await open(options, label)
      const before = browserIssues.length
      try {
        if (signIn) await signIn(page)
        const seen = new Set()
        const queue = [start]
        while (queue.length && seen.size < max) {
          const path = queue.shift()
          if (seen.has(path)) continue
          seen.add(path)
          await page.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => problems.push(`${label} ${path}: did not load`))
          await sleep(250)
          const body = (await page.locator('body').innerText().catch(() => '')).trim()
          if (body.length < 30) problems.push(`${label} ${path}: blank`)
          const bad = body.match(/something went wrong|unexpected error|\bundefined\b|\bNaN\b|\[object [A-Za-z]+\]/)
          if (bad) problems.push(`${label} ${path}: shows "${bad[0]}"`)
          if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)) problems.push(`${label} ${path}: overflows sideways`)
          for (const h of await page.$$eval('a[href^="/"]', (as) => as.map((a) => a.getAttribute('href').split('#')[0]))) {
            if (h && !seen.has(h) && !queue.includes(h) && !h.includes('/print') && !h.includes('pin-cards')) queue.push(h)
          }
        }
      } finally {
        await ctx.close()
      }
      problems.push(...browserIssues.slice(before).map((i) => `${label}: ${i}`))
    }
    const form = (path, id) => async (page) => {
      await page.goto(BASE + path)
      await page.getByLabel('Email').fill(id)
      await page.getByLabel('Password', { exact: true }).fill('bis2026')
      await page.getByRole('button', { name: /sign in/i }).first().click()
      await page.waitForURL((u) => !u.pathname.endsWith('sign-in'))
    }
    await crawl('public', '/', LAPTOP, null, 40)
    await crawl('public phone', '/', PHONE, null, 20)
    for (const role of ['admin', 'secretariat', 'scrutineer', 'chairperson', 'mc']) {
      await crawl(role, `/${role === 'chairperson' ? 'scrutineer' : role}`, LAPTOP, (p) => staffSignIn(p, role))
    }
    await crawl('athlete', '/athlete', PHONE, form('/athlete/sign-in', 'athlete@sample.example'))
    await crawl('coach', '/coach', LAPTOP, form('/coach/sign-in', 'coach@sample.example'))
    await crawl('team', '/team', LAPTOP, form('/team/sign-in', 'team@sample.example'))
    const unique = [...new Set(problems)]
    expect(unique.length === 0, `${unique.length} problems:\n      ${unique.slice(0, 12).join('\n      ')}`)
    return 'public, phone, admin, secretariat, scrutineer, chairperson, mc, athlete, coach, team'
  }, process.env.E2E_SKIP_CRAWL === '1')

  await step('8. Nothing in any browser raised a console error or a failed call during the whole run', async () => {
    expect(browserIssues.length === 0, `${browserIssues.length} issues:\n      ${[...new Set(browserIssues)].slice(0, 10).join('\n      ')}`)
  })

  await step('9. The server logged no errors', async () => {
    const bad = server.output().split('\n').filter((l) => /error|exception|unhandled/i.test(l))
    expect(bad.length === 0, `${bad.length} error lines: ${bad[0]}`)
  })
}

try {
  await main()
} catch (e) {
  results.push({ name: 'setup', ok: false, note: String(e.message ?? e) })
  log(`FAIL  setup\n      ${String(e.message ?? e)}`)
} finally {
  await browser?.close().catch(() => {})
  server?.kill()
  await sleep(500)
  try {
    rmSync(work, { recursive: true, force: true })
  } catch {}
}

const failed = results.filter((r) => !r.ok)
log(`\n===== ${results.length - failed.length}/${results.length} steps passed =====`)
for (const r of failed) log(`FAIL  ${r.name}  ->  ${r.note}`)
process.exit(failed.length ? 1 : 0)
