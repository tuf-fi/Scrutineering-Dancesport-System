// Takes the screenshots for the Offline Mode manual from two real servers on throwaway sample databases:
// the online server and a venue laptop (BIS_VENUE=true). Run `pnpm build` first, then `node rehearsal/offline-manual-shots.mjs`.
// Images go to rehearsal/shots/offline-manual/images/<group>/ (or OFFLINE_MANUAL_OUT). Then run offline-manual-build.mjs.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const ROOT = resolve(import.meta.dirname, '..')
const BACKEND = join(ROOT, 'backend')
export const OUT = process.env.OFFLINE_MANUAL_OUT ?? join(import.meta.dirname, 'shots', 'offline-manual')
const IMAGES = join(OUT, 'images')
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => p && existsSync(p))
if (!CHROME) throw new Error('No Chrome or Edge found. Set CHROME_PATH.')
if (!existsSync(join(ROOT, 'frontend', 'dist', 'index.html'))) throw new Error('Run `pnpm build` first.')

const ONLINE = { port: 4072, base: 'http://localhost:4072' }
const VENUE = { port: 4073, base: 'http://localhost:4073' }
const COMP = 'comp-sorsogon-2026'
const LAPTOP = { viewport: { width: 1280, height: 800 } }
const PHONE = { viewport: { width: 390, height: 900 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const works = []
const servers = []

async function until(check, ms = 40000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await check().catch(() => false)) return
    await sleep(300)
  }
  throw new Error('timed out')
}

async function start(target, extraEnv) {
  const work = mkdtempSync(join(tmpdir(), 'boss-offline-manual-'))
  works.push(work)
  const env = { ...process.env, PORT: String(target.port), HOST: '127.0.0.1', DATABASE_PATH: join(work, 'boss.db'), BACKUP_DIRS: join(work, 'backup'), NODE_NO_WARNINGS: '1', ...extraEnv }
  const seeded = spawnSync(process.execPath, ['--import', 'tsx', 'src/db/seed-cli.ts'], { cwd: BACKEND, env, encoding: 'utf8' })
  if (seeded.status !== 0) throw new Error(`Seeding failed: ${seeded.stderr || seeded.stdout}`)
  servers.push(spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], { cwd: BACKEND, env, stdio: 'ignore' }))
  await until(async () => (await fetch(`${target.base}/api/health`)).ok)
}

const SIGN_IN = {
  admin: ['staff', { username: 'admin@sample.example', password: 'bis2026' }],
  secretariat: ['staff', { username: 'secretariat@sample.example', password: 'bis2026' }],
  scrutineer: ['staff', { username: 'scrutineer@sample.example', password: 'bis2026' }],
  compere: ['staff', { username: 'compere@sample.example', password: 'bis2026' }],
  adjudicator: ['adjudicator', { pin: '443300' }],
  adjudicatorI: ['adjudicator', { pin: '498800' }],
  athlete: ['athlete', { email: 'athlete@sample.example', password: 'bis2026' }],
  team: ['team', { email: 'team@sample.example', password: 'bis2026' }],
  public: null,
}

let browser
async function session(target, role, device = LAPTOP) {
  const ctx = await browser.newContext({ ...device, reducedMotion: 'reduce' })
  if (SIGN_IN[role]) {
    const [kind, body] = SIGN_IN[role]
    const r = await ctx.request.post(`${target.base}/api/auth/${kind}`, { data: body })
    if (!r.ok()) throw new Error(`${role} sign-in gave ${r.status()}`)
  }
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  return { ctx, page, base: target.base }
}
async function api(s, name, ...args) {
  const r = await s.ctx.request.post(`${s.base}/api/call/${name}`, { data: { args } })
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
async function shot(page, group, name, clip) {
  const dir = join(IMAGES, group)
  mkdirSync(dir, { recursive: true })
  const opts = { path: join(dir, `${name}.jpg`), type: 'jpeg', quality: 84, ...(clip ? { clip } : {}) }
  // An open dialog is shown on its own, without the dimmed page behind it
  const open = page.locator('[role=dialog]').first()
  if (!clip && (await open.count()) && (await open.isVisible())) await open.screenshot(opts)
  else await page.screenshot(opts)
  taken.push(`${group}/${name}`)
  console.log('shot', `${group}/${name}`)
}
async function visit(s, group, name, path, opts = {}) {
  try {
    await s.page.goto(s.base + path)
    await settle(s.page)
    await opts.before?.(s.page)
    await shot(s.page, group, name, opts.clip)
  } catch (e) {
    console.error(`MISSED ${group}/${name}: ${e.message.split('\n')[0]}`)
  }
}
async function tryShot(s, group, name, act) {
  try {
    await act()
    await sleep(500)
    await shot(s.page, group, name)
  } catch (e) {
    console.error(`MISSED ${group}/${name}: ${e.message.split('\n')[0]}`)
    if (process.env.DEBUG_SHOTS) await s.page.screenshot({ path: join(OUT, `debug-${name}.png`) }).catch(() => {})
  }
}

// ------------------------------------------------------------------------------------------------ online: handing over and loading back
async function onlineSide(dayFile) {
  const adm = await session(ONLINE, 'admin')
  await visit(adm, 'online', 'offline-day', '/admin/offline-day')
  await adm.page.getByRole('button', { name: /^Start the offline day of Sorsogon/ }).first().click().catch(() => adm.page.getByRole('button', { name: /^Start the offline day/ }).first().click())
  await settle(adm.page)
  await shot(adm.page, 'online', 'start-dialog')
  await adm.page.getByRole('button', { name: 'Hand it over' }).click()
  await sleep(1200)
  await shot(adm.page, 'online', 'handed-over')

  // The secretariat trying to change the program meanwhile is told why it is paused
  const sec = await session(ONLINE, 'secretariat')
  await tryShot(sec, 'online', 'paused', async () => {
    await sec.page.goto(ONLINE.base + '/secretariat/program')
    await settle(sec.page)
    await sec.page.getByRole('button', { name: 'Generate', exact: true }).click()
    await sleep(1200)
  })
  await sec.ctx.close()

  if (dayFile) {
    await adm.page.getByRole('button', { name: /^Load the day file of/ }).first().click()
    await adm.page.locator('[role=dialog]').first().waitFor()
    await adm.page.locator('[role=dialog]').first().getByLabel('Day file').setInputFiles(dayFile)
    await adm.page.getByText(/The file is fine/).first().waitFor().catch(() => {})
    await sleep(600)
    await shot(adm.page, 'online', 'load-dialog')
    await adm.page.getByRole('button', { name: 'Load it' }).click()
    await sleep(1800)
    await shot(adm.page, 'online', 'loaded')
  }
  await adm.ctx.close()
}

// ------------------------------------------------------------------------------------------------ venue laptop
async function venueSide() {
  const anon = await session(VENUE, 'public', LAPTOP)
  await visit(anon, 'venue', 'health', '/api/health', { clip: { x: 0, y: 0, width: 640, height: 90 } })
  await visit(anon, 'venue', 'staff-access', '/staff-access')
  await anon.ctx.close()

  const adm = await session(VENUE, 'admin')
  await visit(adm, 'venue', 'offline-day', '/admin/offline-day')
  await visit(adm, 'venue', 'adjudicators', '/admin/adjudicators')
  await visit(adm, 'venue', 'competitions', '/admin/competitions')

  // The day file the laptop makes
  const r = await adm.ctx.request.get(`${VENUE.base}/api/offline/day?competition=${COMP}`)
  if (!r.ok()) throw new Error(`day file gave ${r.status()}`)
  const dayFile = join(OUT, 'day.json')
  writeFileSync(dayFile, await r.body())
  await adm.ctx.close()

  const scr = await session(VENUE, 'scrutineer')
  await api(scr, 'saveMyStaffSignature', TINY_PNG).catch(() => {})
  await visit(scr, 'venue-scrutineer', 'rounds', '/scrutineer')
  await visit(scr, 'venue-scrutineer', 'live', '/scrutineer/live')
  await visit(scr, 'venue-scrutineer', 'results', '/scrutineer/results')
  await scr.ctx.close()

  const sec = await session(VENUE, 'secretariat')
  await visit(sec, 'venue-secretariat', 'late-entries', '/secretariat/late-entries')
  await visit(sec, 'venue-secretariat', 'athletes', '/secretariat/athletes')
  await visit(sec, 'venue-secretariat', 'entry-requests', '/secretariat/entry-requests')
  await api(sec, 'generateProgram', COMP).catch(() => {})
  await api(sec, 'setProgramStart', COMP, '08:00').catch(() => {})
  await sec.ctx.close()

  const comp = await session(VENUE, 'compere', { viewport: { width: 1280, height: 720 } })
  await visit(comp, 'venue-compere', 'announcer', '/compere')
  await comp.ctx.close()

  // The barker's account is made by the admin
  try {
    const a2 = await session(VENUE, 'admin')
    const made = await api(a2, 'createStaffUser', { name: 'Ruben Soriano', username: 'barker@sample.example', role: 'barker', photo: 'data:image/png;base64,iVBORw0KGgo=' })
    await a2.ctx.close()
    const ctx = await browser.newContext({ ...PHONE, reducedMotion: 'reduce' })
    const rr = await ctx.request.post(`${VENUE.base}/api/auth/staff`, { data: { username: 'barker@sample.example', password: made.tempPassword } })
    if (!rr.ok()) throw new Error(`barker sign-in gave ${rr.status()}`)
    const page = await ctx.newPage()
    await visit({ page, base: VENUE.base }, 'venue-barker', 'board', '/barker')
    await ctx.close()
  } catch (e) {
    console.error(`MISSED barker: ${e.message.split('\n')[0]}`)
  }

  const phoneAnon = await session(VENUE, 'public', PHONE)
  await visit(phoneAnon, 'venue-public', 'home', '/')
  await visit(phoneAnon, 'venue-public', 'competitions', '/competitions')
  await visit(phoneAnon, 'venue-public', 'program', `/competitions/${COMP}/program`)
  await visit(phoneAnon, 'venue-public', 'results', '/results')
  await visit(phoneAnon, 'venue-adjudicator', 'pin', '/adjudicator')
  await tryShot(phoneAnon, 'venue-adjudicator', 'pin-typed', async () => {
    await phoneAnon.page.goto(VENUE.base + '/adjudicator')
    await settle(phoneAnon.page)
    await phoneAnon.page.keyboard.type('4433')
  })
  await phoneAnon.ctx.close()

  const wait = await session(VENUE, 'adjudicatorI', PHONE)
  await visit(wait, 'venue-adjudicator', 'waiting', '/adjudicator/waiting')
  await wait.ctx.close()
  const mark = await session(VENUE, 'adjudicator', PHONE)
  await visit(mark, 'venue-adjudicator', 'mark', '/adjudicator/mark')
  await mark.ctx.close()

  const ath = await session(VENUE, 'athlete', PHONE)
  await visit(ath, 'venue-athlete', 'account', '/athlete')
  await visit(ath, 'venue-athlete', 'results', '/athlete/results')
  await ath.ctx.close()
  const team = await session(VENUE, 'team', PHONE)
  await visit(team, 'venue-team', 'account', '/team')
  await ctxClose(team)
  return dayFile
}
const ctxClose = (s) => s.ctx.close()

async function main() {
  await start(VENUE, { BIS_VENUE: 'true' })
  await start(ONLINE, {})
  browser = await chromium.launch({ executablePath: CHROME })
  const dayFile = await venueSide()
  await onlineSide(dayFile)
  console.log(`\n${taken.length} screenshots in ${IMAGES}`)
}

try {
  await main()
} finally {
  await browser?.close().catch(() => {})
  for (const s of servers) s.kill()
  await sleep(500)
  for (const w of works) {
    try {
      rmSync(w, { recursive: true, force: true })
    } catch {}
  }
}
