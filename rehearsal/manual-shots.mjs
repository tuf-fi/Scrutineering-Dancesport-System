// Takes the screenshots for the user manual (docs/manual) from the real server on a throwaway sample database.
// Run `pnpm build` first, then `node rehearsal/manual-shots.mjs`. Images go to docs/manual/images/<role>/.
// Pass names to take only some jobs, e.g. `node rehearsal/manual-shots.mjs admin public`.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const ROOT = resolve(import.meta.dirname, '..')
const BACKEND = join(ROOT, 'backend')
const OUT = join(ROOT, 'docs', 'manual', 'images')
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
].find((p) => p && existsSync(p))
if (!CHROME) throw new Error('No Chrome or Edge found. Set CHROME_PATH.')
if (!existsSync(join(ROOT, 'frontend', 'dist', 'index.html'))) throw new Error('Run `pnpm build` first.')

const PORT = 4061
const BASE = `http://localhost:${PORT}`
const works = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const TALL = { viewport: { width: 1280, height: 1280 } }
const PHONE = { viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }

const COMP = 'comp-sorsogon-2026'
const E11 = `${COMP}:e11`
const R2 = `${E11}:round_2`

let server
let env
// A fresh sample database and server, so one role's changes never show in another's screens
async function reset() {
  if (server) {
    server.kill()
    await until(async () => !(await fetch(`${BASE}/api/health`).then(() => true).catch(() => false)), 15000)
  }
  const work = mkdtempSync(join(tmpdir(), 'boss-manual-'))
  works.push(work)
  env = { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATABASE_PATH: join(work, 'boss.db'), BACKUP_DIRS: join(work, 'backup'), NODE_NO_WARNINGS: '1' }
  const seeded = spawnSync(process.execPath, ['--import', 'tsx', 'src/db/seed-cli.ts'], { cwd: BACKEND, env, encoding: 'utf8' })
  if (seeded.status !== 0) throw new Error(`Seeding failed: ${seeded.stderr || seeded.stdout}`)
  server = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], { cwd: BACKEND, env, stdio: 'ignore' })
  await until(async () => (await fetch(`${BASE}/api/health`)).ok)
}
async function until(check, ms = 40000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await check().catch(() => false)) return
    await sleep(300)
  }
  throw new Error('timed out')
}

const SIGN_IN = {
  admin: ['staff', { username: 'admin@sample.example', password: 'bis2026' }],
  secretariat: ['staff', { username: 'secretariat@sample.example', password: 'bis2026' }],
  scrutineer: ['staff', { username: 'scrutineer@sample.example', password: 'bis2026' }],
  chairperson: ['staff', { username: 'chairperson@sample.example', password: 'bis2026' }],
  compere: ['staff', { username: 'compere@sample.example', password: 'bis2026' }],
  adjudicator: ['adjudicator', { pin: '443300' }],
  adjudicatorI: ['adjudicator', { pin: '498800' }],
  athlete: ['athlete', { email: 'athlete@sample.example', password: 'bis2026' }],
  coach: ['coach', { email: 'coach@sample.example', password: 'bis2026' }],
  team: ['team', { email: 'team@sample.example', password: 'bis2026' }],
  public: null,
}

let browser
async function session(role, device = TALL) {
  const ctx = await browser.newContext({ ...device, reducedMotion: 'reduce' })
  if (SIGN_IN[role]) {
    const [kind, body] = SIGN_IN[role]
    const r = await ctx.request.post(`${BASE}/api/auth/${kind}`, { data: body })
    if (!r.ok()) throw new Error(`${role} sign-in gave ${r.status()}`)
  }
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  return { ctx, page }
}
async function api(ctx, name, ...args) {
  const r = await ctx.request.post(`${BASE}/api/call/${name}`, { data: { args } })
  const j = await r.json()
  if (!r.ok()) throw new Error(`${name}: ${j.error ?? r.status()}`)
  return j.data
}

async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForFunction(() => !document.querySelector('[class*="skeleton" i], [data-skeleton]'), null, { timeout: 8000 }).catch(() => {})
  await sleep(500)
}

const taken = []
async function shot(page, role, name) {
  const dir = join(OUT, role)
  mkdirSync(dir, { recursive: true })
  const opts = { path: join(dir, `${name}.jpg`), type: 'jpeg', quality: 82 }
  // An open dialog or drawer is shown on its own, without the dimmed page behind it
  const open = page.locator('[role=dialog]').first()
  if ((await open.count()) && (await open.isVisible())) await open.screenshot(opts)
  else await page.screenshot(opts)
  taken.push(`${role}/${name}`)
  console.log('shot', `${role}/${name}`)
}
async function visit(page, role, name, path, opts = {}) {
  try {
    await page.goto(BASE + path)
    await settle(page)
    await opts.before?.(page)
    await shot(page, role, name)
  } catch (e) {
    console.error(`MISSED ${role}/${name}: ${e.message.split('\n')[0]}`)
  }
}
// A shot that needs clicks first; a failure is reported and the run goes on
async function tryShot(page, role, name, act) {
  try {
    await act()
    await sleep(400)
    await shot(page, role, name)
  } catch (e) {
    console.error(`MISSED ${role}/${name}: ${e.message.split('\n')[0]}`)
  }
}
const dialog = async (page) => {
  await page.locator('[role=dialog]').first().waitFor()
  await sleep(500)
}
async function closeDialogs(page) {
  await page.keyboard.press('Escape')
  await page.locator('[role=dialog]').first().waitFor({ state: 'detached', timeout: 4000 }).catch(() => {})
  await sleep(300)
}
const tap = (page, n) => page.locator('button', { hasText: new RegExp(`^0*${n}$`) }).first().click()

// ---------------------------------------------------------------------------------------------------------
const JOBS = {
  async public() {
    const sec = await session('secretariat')
    await api(sec.ctx, 'generateProgram', COMP)
    await api(sec.ctx, 'setProgramStart', COMP, '08:00')
    const comps = await api(sec.ctx, 'getCompetitions')
    let withResults = null
    for (const c of comps) {
      const ids = await api(sec.ctx, 'getResultEventIds', c.id)
      if (ids.length) {
        withResults = { c: c.id, e: ids[0] }
        break
      }
    }
    await sec.ctx.close()
    const { ctx, page } = await session('public', PHONE)
    const R = 'public'
    await visit(page, R, 'home', '/')
    await visit(page, R, 'home-join', '/', { before: async (p) => p.getByText('How to join').first().scrollIntoViewIfNeeded() })
    await visit(page, R, 'competitions', '/competitions')
    await visit(page, R, 'competition', `/competitions/${COMP}`)
    await visit(page, R, 'program', `/competitions/${COMP}/program`)
    if (withResults) await visit(page, R, 'event-results', `/competitions/${withResults.c}/events/${withResults.e}`)
    await visit(page, R, 'athletes', '/athletes')
    await tryShot(page, R, 'competitor', async () => {
      await page.getByRole('link').filter({ hasText: /Ana Cruz/ }).first().click()
      await page.waitForURL(/competitors/)
      await settle(page)
    })
    await visit(page, R, 'rankings', '/rankings')
    await visit(page, R, 'privacy', '/privacy')
    await page.goto(BASE + '/')
    await settle(page)
    await tryShot(page, R, 'menu', async () => {
      await page.getByRole('button', { name: /menu/i }).first().click()
      await sleep(600)
    })
    await tryShot(page, R, 'choose', async () => {
      await page.getByRole('link', { name: /sign in/i }).or(page.getByRole('button', { name: /sign in/i })).first().click()
      await settle(page)
    })
    await ctx.close()
  },

  async athlete() {
    const R = 'athlete'
    const anon = await session('public', PHONE)
    await tryShot(anon.page, R, 'signup', async () => {
      await anon.page.goto(BASE + '/login?as=athlete')
      await settle(anon.page)
      await anon.page.getByText('Create an account').first().click()
      await settle(anon.page)
    })
    await anon.ctx.close()
    const { ctx, page } = await session('athlete', PHONE)
    for (const [name, path] of [
      ['account', '/athlete'],
      ['edit', '/athlete/edit'],
      ['membership', '/athlete/membership'],
      ['payments', '/athlete/payments'],
      ['results', '/athlete/results'],
      ['rankings', '/athlete/rankings'],
      ['entries', '/athlete/entries'],
    ]) await visit(page, R, name, path)
    await visit(page, R, 'register', '/athlete/register', {
      before: async (p) => {
        await p.locator('input[type=checkbox]').first().check()
        await sleep(800)
        await p.getByText('FEE').first().scrollIntoViewIfNeeded()
      },
    })
    for (const [name, path] of [
      ['requests', '/athlete/requests'],
      ['notifications', '/athlete/notifications'],
      ['password', '/athlete/password'],
    ]) await visit(page, R, name, path)
    await ctx.close()
  },

  async coach() {
    const { ctx, page } = await session('coach', PHONE)
    for (const [name, path] of [
      ['account', '/coach'],
      ['link', '/coach/link'],
      ['edit', '/coach/edit'],
      ['notifications', '/coach/notifications'],
      ['dancers', '/coach/dancers'],
      ['results', '/coach/results'],
      ['rankings', '/coach/rankings'],
      ['entries', '/coach/entries'],
      ['password', '/coach/password'],
    ]) await visit(page, 'coach', name, path)
    await ctx.close()
  },

  async team() {
    const { ctx, page } = await session('team', PHONE)
    for (const [name, path] of [
      ['account', '/team'],
      ['link', '/team/link'],
      ['edit', '/team/edit'],
      ['notifications', '/team/notifications'],
      ['dancers', '/team/dancers'],
      ['results', '/team/results'],
      ['rankings', '/team/rankings'],
      ['entries', '/team/entries'],
      ['payments', '/team/payments'],
    ]) await visit(page, 'team', name, path)
    await visit(page, 'team', 'register', '/team/register', {
      before: async (p) => {
        await p.locator('input[type=checkbox]').first().check().catch(() => {})
        await sleep(600)
      },
    })
    await visit(page, 'team', 'requests', '/team/requests')
    await visit(page, 'team', 'password', '/team/password')
    await ctx.close()
  },

  async admin() {
    const { ctx, page } = await session('admin')
    const R = 'admin'
    const form = (label, value) => page.locator('[role=dialog]').getByLabel(label).first().fill(value)
    await visit(page, R, 'competitions', '/admin/competitions')
    await tryShot(page, R, 'competition-new', async () => {
      await page.getByRole('button', { name: 'New competition' }).click()
      await dialog(page)
      await form('Name', 'Naga Dancesport Open 2027')
      await form('Date', '2027-03-14')
      await form('Organizer', 'Camarines Sur Dancesport Association')
      await form('Venue', 'Naga City Coliseum, Naga City')
      await form('Entries close', '2027-03-01')
      await form('Fees due', '2027-03-07')
    })
    await closeDialogs(page)
    await visit(page, R, 'adjudicators', '/admin/adjudicators')
    await tryShot(page, R, 'adjudicator-add', async () => {
      await page.getByRole('button', { name: 'Add adjudicator' }).click()
      await dialog(page)
      await form('Name', 'Marina S. Villanueva')
    })
    await closeDialogs(page)
    await tryShot(page, R, 'pin-select', async () => {
      await page.locator('thead input[type=checkbox]').first().check()
    })
    await tryShot(page, R, 'pin-cards', async () => {
      const [popup] = await Promise.all([page.context().waitForEvent('page', { timeout: 6000 }).catch(() => null), page.getByRole('link', { name: /Print .*PIN cards/ }).click()])
      const target = popup ?? page
      await settle(target)
      await shot(target, R, 'pin-cards')
      if (popup) await popup.close()
      else await page.goBack()
    })
    await visit(page, R, 'panels', '/admin/adjudicators', {
      before: async (p) => {
        await p.getByRole('tab', { name: 'Panels' }).click()
        await settle(p)
      },
    })
    await visit(page, R, 'points', '/admin/points')
    await visit(page, R, 'payments', '/admin/payments')
    await tryShot(page, R, 'payment-detail', async () => {
      await page.locator('tbody tr').first().click()
      await dialog(page)
    })
    await closeDialogs(page)
    await visit(page, R, 'fees', '/admin/fees')
    await tryShot(page, R, 'fees-late', async () => {
      await page.getByText('Late entry fees').first().click()
      await settle(page)
    })
    await tryShot(page, R, 'fees-accounts', async () => {
      await page.getByText('Accounts', { exact: true }).first().click()
      await settle(page)
    })
    await tryShot(page, R, 'payment-method-add', async () => {
      await page.getByRole('button', { name: 'Add a way to pay' }).click()
      await dialog(page)
    })
    await closeDialogs(page)
    await visit(page, R, 'staff', '/admin/staff')
    await tryShot(page, R, 'staff-add', async () => {
      await page.getByRole('button', { name: 'Add account' }).click()
      await dialog(page)
      await form('Name', 'Marites Dela Cruz')
      await form('Email', 'marites@sample.example')
    })
    await tryShot(page, R, 'staff-password', async () => {
      await page.locator('[role=dialog]').getByRole('button', { name: 'Add account' }).click()
      await page.getByText(/temporary password/i).first().waitFor()
      await sleep(500)
    })
    await closeDialogs(page)
    await visit(page, R, 'security', '/admin/security')
    await tryShot(page, R, 'two-step', async () => {
      await page.getByRole('button', { name: /turn on/i }).first().click()
      await dialog(page)
    })
    await ctx.close()
  },

  async secretariat() {
    const { ctx, page } = await session('secretariat')
    const R = 'secretariat'
    const dlg = () => page.locator('[role=dialog]')
    const first = (re) => page.locator('tbody tr').first().getByRole('button', { name: re })
    await visit(page, R, 'events', '/secretariat')
    await tryShot(page, R, 'event-add', async () => {
      await page.getByRole('button', { name: 'Add event' }).click()
      await dialog(page)
    })
    await closeDialogs(page)
    await visit(page, R, 'event', `/secretariat/events/${E11}`)
    await visit(page, R, 'competitors', '/secretariat/competitors')
    await tryShot(page, R, 'competitor-add', async () => {
      await page.getByRole('button', { name: 'Add competitor' }).click()
      await dialog(page)
    })
    await closeDialogs(page)
    await tryShot(page, R, 'import', async () => {
      await page.getByRole('button', { name: 'Import CSV' }).click()
      await dialog(page)
    })
    await closeDialogs(page)
    await tryShot(page, R, 'enter-in-events', async () => {
      await page.getByRole('button', { name: /^Enter .* in events/ }).first().click()
      await dialog(page)
      await dlg().getByRole('combobox').first().selectOption({ label: 'Sorsogon Dancesport Open 2026' })
      await sleep(1200)
    })
    await closeDialogs(page)
    await tryShot(page, R, 'back-number', async () => {
      await page.getByRole('button', { name: /^Set back number/ }).first().click()
      await dialog(page)
    })
    await closeDialogs(page)
    await visit(page, R, 'teams', '/secretariat/teams')
    await tryShot(page, R, 'team-add', async () => {
      await page.getByRole('button', { name: /Add team/ }).click()
      await dialog(page)
    })
    await closeDialogs(page)
    await visit(page, R, 'coaches', '/secretariat/coaches')
    await tryShot(page, R, 'coach-add', async () => {
      await page.getByRole('button', { name: /Add coach/ }).click()
      await dialog(page)
    })
    await closeDialogs(page)
    await visit(page, R, 'athletes', '/secretariat/athletes')
    await visit(page, R, 'entry-requests', '/secretariat/entry-requests')
    await tryShot(page, R, 'request-turn-down', async () => {
      await first(/Turn down/).click()
      await dialog(page)
      await dlg().locator('textarea, input').first().fill('The amount on the screenshot is lower than the fee.')
    })
    await closeDialogs(page)
    await tryShot(page, R, 'request-approved', async () => {
      await first(/Approve/).click()
      await page.getByText('Entered', { exact: true }).first().waitFor()
    })
    await visit(page, R, 'account-links', '/secretariat/account-links')
    await visit(page, R, 'profile-changes', '/secretariat/profile-changes')
    await visit(page, R, 'late-entries', '/secretariat/late-entries')
    await tryShot(page, R, 'late-entry-add', async () => {
      await page.getByRole('button', { name: /Add late entry|Add/ }).first().click()
      await dialog(page)
    })
    await closeDialogs(page)
    await tryShot(page, R, 'cash-payments', async () => {
      await page.getByText('Cash payments').first().click()
      await settle(page)
    })
    await visit(page, R, 'schedule', '/secretariat/schedule')
    await visit(page, R, 'program-empty', '/secretariat/program')
    await tryShot(page, R, 'program', async () => {
      await page.getByRole('button', { name: 'Generate' }).click()
      await sleep(800)
      await page.locator('input[type=time]').first().fill('08:00')
      await page.locator('input[type=time]').first().blur()
      await sleep(4500)
      await settle(page)
    })
    await tryShot(page, R, 'program-break', async () => {
      await page.getByRole('button', { name: 'Add break' }).click()
      await dialog(page)
    })
    await closeDialogs(page)
    await visit(page, R, 'print-index', '/print')
    await visit(page, R, 'print-heats', `/print/heats/${E11}`)
    await visit(page, R, 'security', '/secretariat/security')
    await ctx.close()
  },

  // One round of E11 from the floor to published results, then a final to place. It makes the images of the
  // scrutineer, chairperson, adjudicator and compere.
  async floor() {
    const scr = await session('scrutineer')
    const chair = await session('chairperson')
    const compere = await session('compere', { viewport: { width: 1280, height: 720 } })
    const phone = await session('adjudicator', PHONE)
    const S = scr.page
    const P = phone.page
    const ABOVE = [5, 89, 115, 139, 197, 244, 347, 367, 196, 250, 277] // the eleven clear of the tie, by back number
    const ids = {}
    for (const t of (await api(scr.ctx, 'getRecallTable', R2)).rows) ids[t.backNumber] = t.competitorId

    // ---- Adjudicator before any round is for them: sign-in and waiting
    {
      const anon = await session('public', PHONE)
      await visit(anon.page, 'adjudicator', 'pin', '/adjudicator')
      await tryShot(anon.page, 'adjudicator', 'pin-typed', async () => {
        await anon.page.keyboard.type('4433')
      })
      await anon.ctx.close()
      const wait = await session('adjudicatorI', PHONE)
      await visit(wait.page, 'adjudicator', 'waiting', '/adjudicator/waiting')
      await wait.ctx.close()
    }

    // ---- Scrutineer: the round on the floor
    await visit(S, 'scrutineer', 'rounds', '/scrutineer')
    await visit(S, 'scrutineer', 'heats', '/scrutineer/heats')
    await visit(S, 'scrutineer', 'live', '/scrutineer/live')
    await visit(chair.page, 'chairperson', 'live', '/scrutineer/live')

    // ---- Adjudicator D: marking and signing
    await visit(P, 'adjudicator', 'mark', '/adjudicator/mark')
    await tryShot(P, 'adjudicator', 'mark-chosen', async () => {
      for (const n of [...ABOVE, 56]) await tap(P, n)
    })
    await tryShot(P, 'adjudicator', 'review', async () => {
      await P.getByRole('button', { name: /^Submit/ }).click()
      await P.getByRole('button', { name: 'Final and submit' }).waitFor()
    })
    await tryShot(P, 'adjudicator', 'sign', async () => {
      await P.getByRole('button', { name: 'Final and submit' }).click()
      const canvas = P.locator('canvas').first()
      await canvas.waitFor()
      const box = await canvas.boundingBox()
      await P.mouse.move(box.x + 20, box.y + box.height / 2)
      await P.mouse.down()
      for (let i = 1; i <= 12; i++) await P.mouse.move(box.x + 20 + (i * (box.width - 40)) / 12, box.y + box.height / 2 + (i % 2 ? -18 : 18))
      await P.mouse.up()
    })
    await tryShot(P, 'adjudicator', 'submitted', async () => {
      await P.getByRole('button', { name: 'Finalize' }).click()
      await P.waitForURL((u) => u.pathname.endsWith('/submitted'))
      await settle(P)
    })

    // ---- Paper sheet for E, the other two by API
    await visit(S, 'scrutineer', 'paper-marks', '/scrutineer/paper-marks')
    await tryShot(S, 'scrutineer', 'paper-sheet', async () => {
      await S.locator('select').nth(1).selectOption({ label: 'E · Victor L. Manalo' })
      await S.getByText('Mark an X for exactly').first().waitFor()
      for (const n of [...ABOVE, 111]) await tap(S, n)
    })
    await tryShot(S, 'scrutineer', 'paper-confirm', async () => {
      await S.getByRole('button', { name: /^Submit/ }).click()
      await dialog(S)
    })
    await tryShot(S, 'scrutineer', 'paper-entered', async () => {
      await S.locator('[role=dialog]').getByRole('button', { name: /Enter marks/ }).click()
      await S.locator('[role=dialog]').first().waitFor({ state: 'detached' })
      await sleep(1200)
    })
    for (const [adj, tied] of [['adj-f', 121], ['adj-g', 183]]) {
      await api(scr.ctx, 'enterAdjudicatorMarks', adj, R2, [{ dance: 'cha_cha_cha', competitorIds: [...ABOVE, tied].map((n) => ids[n]) }])
    }

    // ---- Live board complete, then the recall with a tie
    await visit(S, 'scrutineer', 'live-complete', '/scrutineer/live')
    await visit(S, 'scrutineer', 'recall', '/scrutineer/recall')
    await tryShot(S, 'scrutineer', 'recall-proposed', async () => {
      await S.getByRole('button', { name: 'Propose decision' }).click()
      await S.getByText(/Waiting for the chairperson/i).first().waitFor()
      await sleep(4000)
    })
    await visit(chair.page, 'chairperson', 'recall-confirm', '/scrutineer/recall')
    await tryShot(chair.page, 'chairperson', 'confirmed', async () => {
      await chair.page.getByRole('button', { name: 'Confirm tie decision' }).click()
      await sleep(1500)
    })
    await visit(chair.page, 'chairperson', 'results', '/scrutineer/results')

    // ---- Results: approve, publish
    await visit(S, 'scrutineer', 'results', '/scrutineer/results')
    await tryShot(S, 'scrutineer', 'approve-confirm', async () => {
      await S.getByRole('button', { name: 'Approve results' }).click()
      await dialog(S)
    })
    await S.locator('[role=dialog]').getByRole('button', { name: 'Approve', exact: true }).click().catch(() => {})
    await sleep(3500)
    await tryShot(S, 'scrutineer', 'publish-confirm', async () => {
      await S.goto(BASE + '/scrutineer/results')
      await settle(S)
      await S.locator('select').first().selectOption({ label: 'E11 Cha Cha Cha · Round 2' })
      await sleep(1000)
      await S.getByRole('button', { name: 'Publish results' }).click()
      await dialog(S)
    })
    await S.locator('[role=dialog]').getByRole('button', { name: 'Publish', exact: true }).click().catch(() => {})
    await sleep(2500)

    // ---- Printouts
    for (const [name, path] of [
      ['print-index', '/print'],
      ['print-heats', `/print/heats/${E11}`],
      ['print-recall', `/print/recall/${E11}?round=${R2}`],
      ['print-scores', `/print/scores/${E11}?round=${R2}`],
      ['print-blank', `/print/blank-sheets/${E11}`],
    ]) await visit(S, 'scrutineer', name, path)
    await visit(S, 'scrutineer', 'security', '/scrutineer/security')
    await visit(chair.page, 'chairperson', 'security', '/scrutineer/security')

    // ---- Compere
    await visit(compere.page, 'compere', 'announcer', '/compere')
    for (const [label, name] of [['Recalled', 'recalled'], ['Finalists', 'finalists'], ['Results', 'results'], ['Program', 'program']]) {
      await tryShot(compere.page, 'compere', name, async () => {
        await compere.page.keyboard.press({ Recalled: '2', Finalists: '3', Results: '4', Program: '5' }[label])
        await sleep(1000)
      })
    }
    await visit(compere.page, 'compere', 'account', '/account')

    // ---- A final to place: pay what is unpaid, then start it from Rounds
    await S.goto(BASE + '/scrutineer')
    await settle(S)
    const start = (label) => S.locator('tbody tr').filter({ hasText: label }).getByRole('button', { name: /^Start/ }).first()
    await tryShot(S, 'scrutineer', 'start-blocked', async () => {
      await start('E1 Samba').click()
      await S.getByText(/have not been paid/).first().waitFor()
    })
    await sleep(4500)
    // Make every entry of E3 payable: pay what can be paid at the venue, scratch what is still being checked
    {
      const sec = await session('secretariat')
      const status = Object.fromEntries((await api(sec.ctx, 'getPayments')).map((p) => [p.id, p.status]))
      for (const e of (await api(sec.ctx, 'getCompetitionEntries', COMP)).filter((x) => x.eventId === `${COMP}:e3`)) {
        const st = status[e.paymentId]
        if (st === 'unpaid' || st === 'rejected') await api(sec.ctx, 'markPaidAtVenue', e.paymentId).catch(() => {})
        else if (st === 'for_checking') await api(sec.ctx, 'setEntryScratched', e.id, true).catch(() => {})
      }
      await sec.ctx.close()
      await api(scr.ctx, 'startRound', `${COMP}:e3:final`).catch((e) => console.log('E3', e.message))
    }
    await tryShot(S, 'scrutineer', 'round-started', async () => {
      await S.goto(BASE + '/scrutineer')
      await settle(S)
    })
    await tryShot(P, 'adjudicator', 'final', async () => {
      await P.goto(BASE + '/adjudicator/mark')
      await P.locator('button[aria-label^="Place "]').first().waitFor()
      await settle(P)
    })
    await tryShot(P, 'adjudicator', 'final-placed', async () => {
      const nums = await P.locator('button[aria-label^="Place "]').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label').replace('Place ', '')))
      for (const n of nums) await P.getByRole('button', { name: `Place ${n}`, exact: true }).click()
      await sleep(400)
    })
    await tryShot(compere.page, 'compere', 'finalists', async () => {
      await compere.page.goto(BASE + '/compere')
      await settle(compere.page)
      await compere.page.keyboard.press('3')
      await sleep(1000)
    })
    await scr.ctx.close()
    await chair.ctx.close()
    await compere.ctx.close()
    await phone.ctx.close()
  },
}

async function main() {
  browser = await chromium.launch({ executablePath: CHROME })
  const want = process.argv.slice(2)
  for (const [name, job] of Object.entries(JOBS)) {
    if (want.length && !want.includes(name)) continue
    try {
      await reset()
      await job()
    } catch (e) {
      console.error(`FAILED ${name}: ${e.message.split('\n')[0]}`)
    }
  }
  await browser.close()
  console.log(`${taken.length} screenshots in ${OUT}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => {
    server?.kill()
    setTimeout(() => works.forEach((w) => rmSync(w, { recursive: true, force: true })), 1500)
  })
