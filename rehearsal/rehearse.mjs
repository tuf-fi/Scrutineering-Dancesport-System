// The rehearsal from VENUE.md, run for real: the actual server in separate processes, and a real Chrome with a phone
// profile. It seeds a spare database in a temporary folder, so it never touches real competition data.
// Run it with `pnpm rehearsal` (a few minutes), and again before any event. Screenshots go to rehearsal/shots.
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { networkInterfaces, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const ROOT = resolve(import.meta.dirname, '..')
const BACKEND = join(ROOT, 'backend')

// The browser: CHROME_PATH, or Chrome / Edge in their usual places
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

const work = mkdtempSync(join(tmpdir(), 'bis-rehearsal-'))
const lap2 = join(work, 'lap2')
const lap3 = join(work, 'lap3')
const usb = join(work, 'usb')
const share = join(work, 'laptop3-share')
for (const d of [lap2, lap3, share]) mkdirSync(d, { recursive: true })
mkdirSync(usb)
const DB2 = join(lap2, 'bis.db')
const DB3 = join(lap3, 'bis.db')
const PORT = 4050
const BASE = `http://localhost:${PORT}`
const LIVE = 'comp-sorsogon-2026:e11:round_2'

const results = []
const log = (m) => console.log(m)
async function step(name, fn) {
  const t = Date.now()
  try {
    const note = await fn()
    results.push({ name, ok: true, note: note ?? '', ms: Date.now() - t })
    log(`PASS  ${name}${note ? `  (${note})` : ''}`)
  } catch (e) {
    results.push({ name, ok: false, note: String(e.message ?? e).split('\n')[0], ms: Date.now() - t })
    log(`FAIL  ${name}\n      ${String(e.message ?? e).split('\n').slice(0, 3).join('\n      ')}`)
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function until(what, check, ms = 20000, every = 250) {
  const end = Date.now() + ms
  let last
  while (Date.now() < end) {
    try {
      last = await check()
      if (last) return last
    } catch (e) {
      last = e
    }
    await sleep(every)
  }
  throw new Error(`Timed out waiting for ${what}`)
}

// ---- Server processes ----
let server = null
function startServer({ db, port = PORT, backupDirs, interval = '5', env = {} }) {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], {
    cwd: BACKEND,
    env: { ...process.env, PORT: String(port), HOST: '0.0.0.0', DATABASE_PATH: db, BACKUP_DIRS: backupDirs.join(','), BACKUP_INTERVAL_MINUTES: interval, NODE_NO_WARNINGS: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  child.stdout.on('data', (d) => (out += d))
  child.stderr.on('data', (d) => (out += d))
  child.output = () => out
  return child
}
async function waitHealthy(port = PORT, proto = 'http') {
  await until('server health', async () => {
    const r = await fetch(`${proto}://localhost:${port}/api/health`).catch(() => null)
    return r?.ok
  }, 30000)
}
const kill = async (child) => {
  child.kill('SIGKILL')
  await until('server to stop', async () => (await fetch(`${BASE}/api/health`).then(() => false).catch(() => true)), 10000)
}

// ---- Database reads (read-only, WAL safe) ----
function q(db, sql, ...args) {
  const d = new Database(db, { readonly: true, fileMustExist: true })
  try {
    return d.prepare(sql).all(...args)
  } finally {
    d.close()
  }
}
const submitted = (db, adj) => q(db, 'select count(*) as n from submissions where round_id = ? and adjudicator_id = ?', LIVE, adj)[0].n
const markCount = (db, adj) => q(db, 'select count(*) as n from marks where round_id = ? and adjudicator_id = ?', LIVE, adj)[0].n

// ---- API as the scrutineer ----
async function apiCookie(user, pass = 'bis2026', base = BASE) {
  const r = await fetch(`${base}/api/auth/staff`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: user, password: pass }) })
  return r.headers.get('set-cookie').split(';')[0]
}
async function call(cookie, name, args = [], base = BASE) {
  const r = await fetch(`${base}/api/call/${name}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ args }) })
  return (await r.json()).data
}

// ---- Browsers ----
async function phone(dir, opts = {}) {
  const ctx = await chromium.launchPersistentContext(dir, {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ...opts,
  })
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  return { ctx, page }
}
async function signInPhone(page, pin, base = BASE) {
  await page.goto(`${base}/adjudicator`)
  await page.getByRole('heading', { name: 'Enter your PIN' }).waitFor()
  await page.keyboard.type(pin)
  await page.waitForURL(/\/adjudicator\/(mark|submitted|waiting)/, { timeout: 15000 })
}
async function markX(page, count = 12) {
  const region = page.getByRole('region', { name: 'Cha Cha Cha' })
  await region.waitFor({ timeout: 15000 })
  const tiles = region.getByRole('button')
  for (let i = 0; i < count; i++) await tiles.nth(i).click()
}
async function confirmMarks(page) {
  await page.getByRole('button', { name: 'Submit' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click()
}

const browsers = []
try {
  // ---------- Setup ----------
  spawnSync(process.execPath, ['--import', 'tsx', 'src/db/seed-cli.ts'], { cwd: BACKEND, env: { ...process.env, DATABASE_PATH: DB2, NODE_NO_WARNINGS: '1' } })
  log(`Rehearsal in ${work}`)

  // ================= 1. Normal start =================
  server = startServer({ db: DB2, backupDirs: [usb, share], interval: '0.1' })
  await waitHealthy()
  const scr = await chromium.launch({ executablePath: CHROME, headless: true })
  browsers.push(scr)
  const scrCtx = await scr.newContext({ viewport: { width: 1280, height: 800 } })
  const scrPage = await scrCtx.newPage()

  await step('1a. Scrutineer signs in on Laptop 2 and sees the round on the floor', async () => {
    await scrPage.goto(`${BASE}/login`)
    await scrPage.getByLabel('Username').fill('scrutineer')
    await scrPage.getByLabel('Password').fill('bis2026')
    await scrPage.getByRole('button', { name: 'Sign in' }).click()
    await scrPage.getByRole('region', { name: 'On the floor' }).waitFor({ timeout: 15000 })
    await scrPage.screenshot({ path: join(SHOTS, '01-scrutineer-rounds.png') })
    return 'On the floor panel shown'
  })

  let phoneD = await phone(join(work, 'phone-d'))
  browsers.push(phoneD.ctx)
  const seen = []
  phoneD.page.on('requestfailed', (r) => seen.push(`FAILED ${r.method()} ${r.url().replace(BASE, '')} ${r.failure()?.errorText}`))
  phoneD.page.on('requestfinished', (r) => seen.push(`OK ${r.method()} ${r.url().replace(BASE, '').slice(0, 60)}`))
  phoneD.page.on('console', (m) => seen.push(`CONSOLE ${m.type()} ${m.text().slice(0, 160)}`))
  phoneD.page.on('pageerror', (e) => seen.push(`PAGEERROR ${String(e).slice(0, 160)}`))
  await step('1b. Adjudicator D signs in with a PIN and gets the mark screen', async () => {
    await signInPhone(phoneD.page, '4433')
    await phoneD.page.getByText('Mark an X for exactly 12').waitFor()
    await phoneD.page.screenshot({ path: join(SHOTS, '02-phone-mark.png') })
    return 'mark screen: X for exactly 12'
  })

  // ================= 2. USB drive pulled =================
  await step('2a. USB drive pulled out: backup fails and the scrutineer is told', async () => {
    rmSync(usb, { recursive: true, force: true })
    writeFileSync(usb, 'not a folder') // a path that can no longer be written
    const cookie = await apiCookie('scrutineer')
    await until('backup failure to be recorded', async () => (await call(cookie, 'getBackupStatus')).targets.some((t) => !t.ok), 30000)
    const t0 = Date.now()
    await scrPage.getByRole('alert').filter({ hasText: 'cannot be reached' }).waitFor({ timeout: 90000 })
    await scrPage.screenshot({ path: join(SHOTS, '03-backup-notice.png') })
    const other = (await call(cookie, 'getBackupStatus')).targets.find((t) => t.path === share)
    if (!other?.ok) throw new Error('the other backup folder stopped working too')
    return `notice appeared after ${Math.round((Date.now() - t0) / 1000)}s; the other folder kept working`
  })
  await step('2b. USB plugged back in: the notice clears and copies resume', async () => {
    rmSync(usb, { force: true })
    mkdirSync(usb)
    await scrPage.getByRole('alert').filter({ hasText: 'cannot be reached' }).waitFor({ state: 'detached', timeout: 90000 })
    const n = readdirSync(usb).filter((f) => f.endsWith('.db')).length
    if (n === 0) throw new Error('no copy written to the USB drive')
    return `${n} copy on the drive`
  })

  // ================= 3. Phone Wi-Fi off, browser killed =================
  await step('3a. Wi-Fi off on the phone: marks confirmed and held, not sent', async () => {
    seen.push('--- Wi-Fi switched off ---')
    await phoneD.ctx.setOffline(true)
    await markX(phoneD.page)
    await confirmMarks(phoneD.page)
    await phoneD.page.getByRole('heading', { name: 'Saved, sending…' }).waitFor({ timeout: 10000 })
    try {
      await phoneD.page.getByText(/saved on this phone/).waitFor({ timeout: 25000 })
    } catch {
      await phoneD.page.screenshot({ path: join(SHOTS, '04-phone-saved-offline-FAILED.png') })
      const text = (await phoneD.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 240)
      throw new Error(`the phone never said it was offline. It shows: "${text}"
      browser saw: ${seen.slice(-18).join(' | ')}`)
    }
    await phoneD.page.screenshot({ path: join(SHOTS, '04-phone-saved-offline.png') })
    if (submitted(DB2, 'adj-d') !== 0) throw new Error('the server already had the marks')
    return 'heading "Saved, sending…", server has nothing yet'
  })
  if (process.env.STOP_AFTER === '3a') throw new Error('stopped after 3a, as asked')
  await step('3b. Browser killed while the marks are unsent, then reopened on the Wi-Fi: marks arrive once', async () => {
    await phoneD.ctx.close()
    browsers.splice(browsers.indexOf(phoneD.ctx), 1)
    phoneD = await phone(join(work, 'phone-d'))
    browsers.push(phoneD.ctx)
    await phoneD.page.goto(`${BASE}/adjudicator/submitted`)
    await phoneD.page.getByRole('heading', { name: 'Submitted' }).waitFor({ timeout: 20000 })
    await phoneD.page.screenshot({ path: join(SHOTS, '05-phone-submitted.png') })
    const [s, m] = [submitted(DB2, 'adj-d'), markCount(DB2, 'adj-d')]
    if (s !== 1 || m !== 12) throw new Error(`server has ${s} submissions and ${m} marks`)
    return 'phone still signed in; server has 1 submission, 12 marks'
  })

  // ================= 4. Server stopped and restarted mid-round =================
  const phoneE = await phone(join(work, 'phone-e'))
  browsers.push(phoneE.ctx)
  await signInPhone(phoneE.page, '4544')
  await markX(phoneE.page)
  await step('4a. Server stopped while a phone confirms its marks: they are held', async () => {
    await kill(server)
    await confirmMarks(phoneE.page)
    await phoneE.page.getByRole('heading', { name: 'Saved, sending…' }).waitFor({ timeout: 15000 })
    await phoneE.page.screenshot({ path: join(SHOTS, '06-phone-server-down.png') })
    return 'phone shows "Saved, sending…" with the server down'
  })
  await step('4b. Server restarted: the phone sends by itself, stays signed in, marks stored once', async () => {
    server = startServer({ db: DB2, backupDirs: [usb, share], interval: '5' })
    await waitHealthy()
    await phoneE.page.getByRole('heading', { name: 'Submitted' }).waitFor({ timeout: 40000 })
    const [s, m] = [submitted(DB2, 'adj-e'), markCount(DB2, 'adj-e')]
    if (s !== 1 || m !== 12) throw new Error(`server has ${s} submissions and ${m} marks`)
    return 'sent after restart without anyone touching the phone'
  })

  // ================= 5. Paper marks =================
  await step('5. Scrutineer types in a paper sheet for adjudicator F', async () => {
    await scrPage.goto(`${BASE}/scrutineer/paper`)
    await scrPage.getByRole('heading', { name: 'Paper marks' }).waitFor()
    await scrPage.screenshot({ path: join(SHOTS, '07-paper-list.png') })
    await scrPage.getByRole('button', { name: 'Enter paper marks for F' }).click()
    await markX(scrPage)
    await scrPage.screenshot({ path: join(SHOTS, '08-paper-sheet.png') })
    await scrPage.getByRole('button', { name: 'Submit' }).click()
    await scrPage.getByRole('dialog').getByRole('button', { name: 'Enter marks' }).click()
    await scrPage.getByText('Marks entered for F').waitFor({ timeout: 10000 })
    const by = q(DB2, 'select entered_by as b from submissions where round_id = ? and adjudicator_id = ?', LIVE, 'adj-f')[0]?.b
    if (by !== 'staff-scrutineer') throw new Error(`entered_by is ${by}`)
    return 'recorded as entered by the scrutineer'
  })

  // ================= 6. Laptop 2 dies for good: Laptop 3 takes over =================
  const restore = (to, from) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'src/db/restore-cli.ts', from], {
      cwd: BACKEND,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_PATH: to, BACKUP_DIRS: share, NODE_NO_WARNINGS: '1' },
    })
  const subs = (db) => ['adj-a', 'adj-b', 'adj-c', 'adj-d', 'adj-e', 'adj-f'].map((a) => `${a.slice(-1).toUpperCase()}:${submitted(db, a)}`).join(' ')

  await step('6a. Laptop 2 dies a moment after the last marks; Laptop 3 restores the newest backup', async () => {
    await sleep(2500) // the server copies the database about a second after each change
    await kill(server)
    const r = restore(DB3, share)
    log('      ' + r.stdout.trim().split('\n').join('\n      '))
    if (r.status !== 0) throw new Error(r.stderr || r.stdout)
    server = startServer({ db: DB3, backupDirs: [share], interval: '5' })
    await waitHealthy()
    const have = subs(DB3)
    for (const a of ['adj-d', 'adj-e', 'adj-f']) if (submitted(DB3, a) !== 1) throw new Error(`marks missing after takeover: ${have}`)
    return `Laptop 3 has: ${have}`
  })
  await step('6b. After takeover the phones are still signed in and still show their marks as submitted', async () => {
    await phoneE.page.reload()
    try {
      await phoneE.page.getByRole('heading', { name: 'Submitted' }).waitFor({ timeout: 20000 })
    } catch (e) {
      await phoneE.page.screenshot({ path: join(SHOTS, '09-phone-after-takeover.png') })
      const text = (await phoneE.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200)
      throw new Error(`phone E shows ${phoneE.page.url()} : "${text}"`)
    }
    await scrPage.goto(`${BASE}/scrutineer`)
    await scrPage.getByRole('region', { name: 'On the floor' }).waitFor({ timeout: 20000 })
    return 'phone E and the scrutineer both carried on without signing in again'
  })

  // The worst case: the backup is old, so marks that phones were told "Submitted" are not in it
  await step('6c. Worst case: takeover from the OLDEST backup. Phones put back the marks the server lost', async () => {
    await kill(server)
    const oldest = readdirSync(share).filter((f) => f.endsWith('.db')).sort()[0]
    const DB3B = join(work, 'lap3b', 'bis.db')
    const r = restore(DB3B, join(share, oldest))
    if (r.status !== 0) throw new Error(r.stderr || r.stdout)
    server = startServer({ db: DB3B, backupDirs: [share], interval: '5' })
    await waitHealthy()
    const before = subs(DB3B)
    if (submitted(DB3B, 'adj-d') !== 0 || submitted(DB3B, 'adj-e') !== 0) throw new Error(`the old backup already had D and E (${before}); nothing to recover`)
    // The phones' pages are opened again (or reload after the Wi-Fi blip)
    await phoneD.page.reload()
    await phoneE.page.reload()
    await until('phones to put their marks back', async () => submitted(DB3B, 'adj-d') === 1 && submitted(DB3B, 'adj-e') === 1, 30000)
    await phoneD.page.getByRole('heading', { name: 'Submitted' }).waitFor({ timeout: 20000 })
    const after = subs(DB3B)
    if (markCount(DB3B, 'adj-d') !== 12 || markCount(DB3B, 'adj-e') !== 12) throw new Error('marks not complete after recovery')
    return `before: ${before}; after phones reload: ${after} (F was typed from paper: re-enter it from the sheet)`
  })

  // ================= 7. The offline copy of the app =================
  const lan = Object.values(networkInterfaces()).flat().find((i) => i.family === 'IPv4' && !i.internal)?.address
  const offlineProbe = async (url, label, opts = {}) => {
    const ph = await phone(join(work, `pwa-${label}`), opts)
    browsers.push(ph.ctx)
    try {
      await ph.page.goto(url)
      await ph.page.locator('#root').waitFor()
      await sleep(1500)
      const info = await ph.page.evaluate(async () => ({
        secure: window.isSecureContext,
        hasSW: 'serviceWorker' in navigator,
        controlled:
          'serviceWorker' in navigator
            ? await Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 8000))])
            : false,
      }))
      let offlineReload = 'n/a'
      if (info.hasSW && info.controlled) {
        await ph.page.reload() // now controlled by the worker
        await ph.ctx.setOffline(true)
        try {
          await ph.page.reload({ timeout: 10000 })
          offlineReload = (await ph.page.locator('#root').innerHTML()).length > 50 ? 'app opened' : 'blank'
        } catch {
          offlineReload = 'failed'
        }
        await ph.ctx.setOffline(false)
      } else {
        await ph.ctx.setOffline(true)
        offlineReload = await ph.page.reload({ timeout: 8000 }).then(() => 'app opened').catch(() => 'failed (browser offline page)')
        await ph.ctx.setOffline(false)
      }
      return { ...info, offlineReload }
    } finally {
      await ph.ctx.close()
      browsers.splice(browsers.indexOf(ph.ctx), 1)
    }
  }
  await step('7a. On localhost (a secure context): the app keeps an offline copy and reopens with no connection', async () => {
    const r = await offlineProbe(`${BASE}/adjudicator`, 'localhost')
    if (!r.secure || !r.hasSW || !r.controlled || r.offlineReload !== 'app opened') throw new Error(JSON.stringify(r))
    return JSON.stringify(r)
  })
  await step("7b. On the venue's plain http://<laptop address>: no offline copy (as documented)", async () => {
    if (!lan) return 'no LAN address on this machine'
    const r = await offlineProbe(`http://${lan}:${PORT}/adjudicator`, 'lan')
    if (r.secure || r.hasSW) throw new Error('expected an insecure origin without a service worker: ' + JSON.stringify(r))
    return `http://${lan}:${PORT} -> ${JSON.stringify(r)}`
  })
  await step('7c. Over HTTPS with a certificate the browser accepts: the offline copy works', async () => {
    const tls = startServer({
      db: join(work, 'lap3b', 'bis.db'),
      port: 4051,
      backupDirs: [share],
      interval: '5',
      env: { TLS_CERT: join(BACKEND, 'test-fixtures', 'localhost.crt'), TLS_KEY: join(BACKEND, 'test-fixtures', 'localhost.key') },
    })
    try {
      await until('the https port to answer', async () => (await fetch('https://localhost:4051/api/health').then(() => true).catch((e) => !/ECONNREFUSED/.test(String(e.cause?.code ?? e.cause ?? e)))), 20000)
      const r = await offlineProbe('https://localhost:4051/adjudicator', 'https', { args: ['--ignore-certificate-errors'] })
      if (!r.secure || !r.hasSW || !r.controlled || r.offlineReload !== 'app opened') throw new Error(JSON.stringify(r))
      return JSON.stringify(r)
    } finally {
      tls.kill('SIGKILL')
    }
  })
} catch (e) {
  log('SCRIPT ERROR: ' + (e.stack ?? e))
} finally {
  log('\n===== SUMMARY =====')
  for (const r of results) log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  -> ' + r.note}`)
  server?.kill('SIGKILL')
  for (const b of browsers) await b.close().catch(() => {})
  await sleep(500)
  if (results.some((r) => !r.ok)) process.exitCode = 1
  rmSync(work, { recursive: true, force: true, maxRetries: 3 })
}
