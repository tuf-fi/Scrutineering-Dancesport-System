// Screenshots of what each role DOES, not only the pages it opens: it makes the data a feature needs (an unpaid payment
// to confirm, a round to approve, an entry to send) and then does the action through the real screens, in an order
// where each step sets up the next. Each device runs the whole sequence on its own copy of the scenario database.
//   SEED_DB=<scenario db> OUT=<folder> [ONLY=name,name] node rehearsal/feature-shots.mjs [macbook-12 | iphone-15]
// Files: <OUT>/<role>/F<nn>-<name>-<device>.png
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import zlib from 'node:zlib'
import { chromium } from 'playwright-core'

const ROOT = resolve(import.meta.dirname, '..')
const BACKEND = join(ROOT, 'backend')
const OUT = process.env.OUT ?? join(ROOT, 'screenshots')
const SEED_DB = process.env.SEED_DB
if (!SEED_DB || !existsSync(SEED_DB)) throw new Error('Set SEED_DB to the scenario database.')
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && existsSync(p))
const PORT = 4063
const BASE = `http://localhost:${PORT}`
const PASSWORD = 'bis2026'
const ONLY = process.env.ONLY?.split(',')
const DEVICES = {
  'macbook-12': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 },
  'iphone-15': {
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const STAFF = { admin: 'amelia.rosales@gmail.com', secretariat: 'jonas.bellosillo@gmail.com', scrutineer: 'teresita.quimpo@gmail.com', chairperson: 'gregorio.almazan@gmail.com', compere: 'dante.ibarra@gmail.com', barker: 'ruben.soriano@gmail.com' }
const MEMBER = { athlete: 'kai.ibarra@gmail.com', coach: 'marites.villareal@gmail.com', team: 'naga.rhythm.studio@gmail.com' }

// A plain picture for photo and screenshot uploads
function png(r, g, b, w = 240, h = 240) {
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b, 255], y * (w * 4 + 1) + 1 + x * 4)
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(zlib.crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const head = Buffer.alloc(13)
  head.writeUInt32BE(w, 0)
  head.writeUInt32BE(h, 4)
  head.set([8, 6, 0, 0, 0], 8)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
const work = mkdtempSync(join(tmpdir(), 'bis-features-'))
const PHOTO = join(work, 'photo.png')
const PROOF = join(work, 'gcash-receipt.png')
writeFileSync(PHOTO, png(160, 120, 80))
writeFileSync(PROOF, png(230, 240, 250, 360, 640))

let server
async function startServer() {
  const db = join(work, 'bis.db')
  for (const f of ['', '-wal', '-shm']) rmSync(db + f, { force: true })
  copyFileSync(SEED_DB, db)
  const env = { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATABASE_PATH: db, BACKUP_DIRS: join(work, 'backup'), NODE_NO_WARNINGS: '1' }
  server = spawn(process.execPath, ['--import', 'tsx', 'src/main.ts'], { cwd: BACKEND, env, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) {
    if (await fetch(`${BASE}/api/health`).then((r) => r.ok, () => false)) return db
    await sleep(500)
  }
  throw new Error('server did not start')
}
async function stopServer() {
  server?.kill()
  for (let i = 0; i < 40 && (await fetch(`${BASE}/api/health`).then(() => true, () => false)); i++) await sleep(300)
}

let browser
let device
let sessions
let counters
let taken = 0
const missed = []
async function sess(role, who) {
  const key = who ?? role
  if (sessions[key]) return sessions[key]
  const ctx = await browser.newContext({ ...DEVICES[device], reducedMotion: 'reduce' })
  let r
  if (STAFF[role] && !who) r = await ctx.request.post(`${BASE}/api/auth/staff`, { data: { username: STAFF[role], password: PASSWORD } })
  else if (role === 'adjudicator') r = await ctx.request.post(`${BASE}/api/auth/adjudicator`, { data: { pin: who } })
  else if (MEMBER[role]) r = await ctx.request.post(`${BASE}/api/auth/${role}`, { data: { email: who ?? MEMBER[role], password: PASSWORD } })
  if (r && !r.ok()) throw new Error(`sign-in ${key} gave ${r.status()}: ${(await r.text()).slice(0, 120)}`)
  const page = await ctx.newPage()
  page.setDefaultTimeout(12000)
  page.on('dialog', (d) => d.accept().catch(() => {}))
  return (sessions[key] = { ctx, page })
}
const api = async (s, name, ...args) => {
  const r = await s.ctx.request.post(`${BASE}/api/call/${name}`, { data: { args } })
  const j = await r.json().catch(() => ({}))
  if (!r.ok()) throw new Error(`${name}: ${j.error ?? r.status()}`)
  return j.data
}
async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForFunction(() => !document.querySelector('[class*="skeleton" i], [data-skeleton]'), null, { timeout: 8000 }).catch(() => {})
  await sleep(600)
}
const go = async (page, path) => {
  await page.goto(BASE + path)
  await settle(page)
}
const dlg = (page) => page.locator('[role=dialog]').first()
const waitDialog = async (page) => {
  await dlg(page).waitFor()
  await sleep(500)
}
async function closeDialogs(page) {
  for (let i = 0; i < 3 && (await dlg(page).isVisible().catch(() => false)); i++) {
    await page.keyboard.press('Escape')
    await sleep(400)
  }
}
// Press the first visible button, link, tab or label whose text matches
const press = async (page, re, scope) => {
  const root = scope ?? page
  const hit = root.locator('button, a, [role=tab], [role=menuitem], summary, label').filter({ hasText: re }).filter({ visible: true }).first()
  await hit.click()
  await sleep(350)
}
const pressIn = (page, re) => press(page, re, dlg(page))
const fillIn = async (page, label, value) => {
  const root = (await dlg(page).isVisible().catch(() => false)) ? dlg(page) : page
  await root.getByLabel(label).first().fill(value)
}
const upload = async (page, file = PHOTO, nth = 0) => page.locator('input[type=file]').nth(nth).setInputFiles(file)
const selectByText = async (loc, re) => {
  const value = await loc.evaluate((el, src) => [...el.options].find((o) => new RegExp(src, 'i').test(o.textContent))?.value, re.source)
  if (value === undefined) throw new Error('no option ' + re)
  await loc.selectOption(value)
}
const markAll = async (p, per = 6) => {
  const tabs = p.getByRole('tab')
  const count = await tabs.count()
  for (let i = 0; i < Math.max(count, 1); i++) {
    if (count) await tabs.nth(i).click()
    await sleep(300)
    const nums = await p.locator('button').evaluateAll((bs) => bs.map((b) => b.textContent.trim()).filter((t) => /^[0-9]{3}$/.test(t)))
    for (const n of nums.slice(0, per)) await p.locator('button', { hasText: new RegExp('^0*' + Number(n) + '$') }).first().click()
  }
}
const openMenu = async (page) => {
  if (device === 'iphone-15') await page.getByRole('button', { name: /menu/i }).first().click().catch(() => {})
  await sleep(500)
}

// One feature: do the work, take the picture. A failure is logged and the sequence goes on.
async function feature(role, name, fn, { full = true, keep = false } = {}) {
  counters[role] = (counters[role] ?? 0) + 1
  const n = counters[role]
  if (ONLY && !ONLY.includes(name)) return
  const label = `${role}/F${String(n).padStart(2, '0')}-${name}`
  try {
    const s = role === 'adjudicator' ? null : await sess(role)
    const r = await fn(s?.page, s)
    const page = r?.page ?? s.page
    await sleep(400)
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {})
    const overlay = await dlg(page).isVisible().catch(() => false)
    const dir = join(OUT, role)
    mkdirSync(dir, { recursive: true })
    await page.screenshot({ path: join(dir, `F${String(n).padStart(2, '0')}-${name}-${device}.png`), fullPage: full && !overlay })
    taken++
    console.log(`shot ${label}-${device}`)
  } catch (e) {
    missed.push(`${label} (${device}): ${e.message.split('\n').slice(0, 2).join(' | ')}`)
    console.error(`MISSED ${label} (${device}): ${e.message.split('\n')[0]}`)
  }
  const s = sessions[role]
  if (s && !keep) await closeDialogs(s.page).catch(() => {})
}
// Do something with no picture (setup that the next shot shows the result of)
async function quietly(label, fn) {
  try {
    await fn()
  } catch (e) {
    missed.push(`setup ${label} (${device}): ${e.message.split('\n')[0]}`)
    console.error(`SETUP FAILED ${label}: ${e.message.split('\n')[0]}`)
  }
}

// ======================================================================================================== the sequence
async function sequence(dbPath) {
  const Database = (await import('node:module')).createRequire(join(BACKEND, 'package.json'))('better-sqlite3')
  const admin0 = await sess('admin')
  const comp = (await api(admin0, 'getCompetitions'))[0]
  const C = comp.id
  const events = await api(admin0, 'getEvents', C)
  const eid = (n) => events.find((e) => e.number === n).id
  let rounds = await api(admin0, 'getCompetitionRounds', C)
  const rid = (n, type) => rounds.find((r) => r.eventNumber === n && r.type === type)?.roundId
  const pins = Object.fromEntries((await api(admin0, 'getAdjudicatorPins', C)).map((p) => [p.adjudicatorId, p.pin]))
  const adminTable = (page, n = 1) => page.locator('tbody tr').nth(n - 1)

  // ------------------------------------------------------------------------------------------------ public
  await feature('public', 'competitions-search', async (p) => {
    await go(p, '/competitions')
    await p.getByPlaceholder(/search|type/i).first().fill('Bicol')
    await sleep(700)
  })
  await feature('public', 'competition-events-filter', async (p) => {
    await go(p, `/competitions/${C}`)
    await p.getByPlaceholder(/search|type/i).first().fill('Latin')
    await sleep(700)
  })
  await feature('public', 'program-follow-back-number', async (p) => {
    await go(p, `/competitions/${C}/program`)
    await p.getByPlaceholder(/back number|number|search/i).first().fill('45')
    await sleep(800)
  })
  await feature('public', 'program-print', async (p) => {
    await go(p, `/competitions/${C}/program/print`)
  })
  await feature('public', 'athletes-search', async (p) => {
    await go(p, '/athletes')
    await p.getByPlaceholder(/search|type/i).first().fill('Reyes')
    await sleep(800)
  })
  await feature('public', 'standings-filters', async (p) => {
    await go(p, '/standings')
    const sel = p.locator('select').first()
    if (await sel.count()) await sel.selectOption({ index: 1 }).catch(() => {})
    await sleep(700)
  })
  await feature('public', 'team-sign-up-filled', async (p) => {
    await go(p, '/login?as=team')
    await press(p, /Create an account/)
    await settle(p)
    await p.getByLabel(/name/i).first().fill('Catanduanes Ballroom Guild')
    await p.getByLabel(/email/i).first().fill('catanduanes.ballroom@gmail.com')
    await p.locator('input[type=password]').first().fill('Guild-2027-ok')
    await p.locator('input[type=file]').first().setInputFiles(PHOTO).catch(() => {})
    await sleep(700)
  })

  // ------------------------------------------------------------------------------------------------ admin: setup screens
  await feature('admin', 'competition-edit', async (p) => {
    await go(p, '/admin/competitions')
    await adminTable(p).getByRole('button', { name: /edit/i }).click()
    await waitDialog(p)
  })
  await feature('admin', 'competition-delete-blocked', async (p) => {
    await go(p, '/admin/competitions')
    await adminTable(p).getByRole('button', { name: /delete/i }).click()
    await sleep(900)
  })
  await feature('admin', 'competition-new-filled-card-photo', async (p) => {
    await go(p, '/admin/competitions')
    await press(p, /New competition/)
    await waitDialog(p)
    await fillIn(p, 'Name', 'Naga Dancesport Open 2027')
    await fillIn(p, 'Date', '2027-03-14')
    await fillIn(p, 'Organizer', 'Camarines Sur Dancesport Association')
    await fillIn(p, 'Venue', 'Naga City Coliseum, Naga City')
    await fillIn(p, 'Executor', 'BIS Scrutineering Team')
    await fillIn(p, 'Entries close', '2027-03-01')
    await fillIn(p, 'Fees due', '2027-03-07')
    await upload(p)
    await sleep(800)
  }, { keep: true })
  await feature('admin', 'competition-created', async (p) => {
    await dlg(p).getByRole('button', { name: /Create competition/ }).click()
    await sleep(1500)
  })
  await quietly('remove the demo competition so the PINs stay valid', async () => {
    const list = await api(admin0, 'getCompetitions')
    const extra = list.find((c) => c.name === 'Naga Dancesport Open 2027')
    if (extra) await api(admin0, 'deleteCompetition', extra.id)
  })
  await feature('admin', 'adjudicator-edit', async (p) => {
    await go(p, '/admin/adjudicators')
    await p.getByRole('button', { name: /^Edit Lorenzo/ }).click()
    await waitDialog(p)
  })
  await feature('admin', 'adjudicator-new-pin', async (p) => {
    await go(p, '/admin/adjudicators')
    await p.getByRole('button', { name: /^New PIN for Lorenzo/ }).click()
    await sleep(900)
  })
  await feature('admin', 'adjudicator-sign-out-everywhere', async (p) => {
    await go(p, '/admin/adjudicators')
    await p.getByRole('button', { name: /^Sign Lorenzo.* out everywhere/ }).click()
    await sleep(900)
  })
  await feature('admin', 'adjudicator-delete-confirm', async (p) => {
    await go(p, '/admin/adjudicators')
    await p.getByRole('button', { name: /^Delete Lorenzo/ }).click()
    await sleep(900)
  })
  await feature('admin', 'adjudicator-pin-selection', async (p) => {
    await go(p, '/admin/adjudicators')
    await p.locator('thead input[type=checkbox], input[type=checkbox]').first().check()
    await sleep(500)
  })
  // Free the tenth letter (the scenario uses all ten), then show the add form
  await quietly('free letter J', async () => {
    const db = new Database(dbPath)
    db.prepare("UPDATE adjudicators SET letter = 'K' WHERE letter = 'J'").run()
    db.close()
  })
  await feature('admin', 'adjudicator-add-filled', async (p) => {
    await go(p, '/admin/adjudicators')
    await p.getByRole('button', { name: 'Add adjudicator' }).click()
    await waitDialog(p)
    await fillIn(p, 'Name', 'Marina S. Villanueva')
    await dlg(p).getByLabel(/letter/i).first().selectOption('J').catch(() => {})
    await upload(p)
    await sleep(800)
  })
  await feature('admin', 'panels-edit', async (p) => {
    await go(p, '/admin/adjudicators')
    await press(p, /^Panels/)
    await settle(p)
    await p.locator('tbody input[type=checkbox], tbody button[role=checkbox]').first().click().catch(() => {})
    await sleep(500)
  })
  await feature('admin', 'points-edit', async (p) => {
    await go(p, '/admin/points')
    await p.getByLabel('Points for 1st').fill('12')
    await sleep(500)
  })
  await feature('admin', 'payments-approved', async (p) => {
    await go(p, '/admin/payments')
    const sel = p.locator('select').first()
    await sel.selectOption({ label: 'Approved' }).catch(() => sel.selectOption({ index: 2 }))
    await settle(p)
  })
  await feature('admin', 'payments-search', async (p) => {
    await go(p, '/admin/payments')
    await p.getByPlaceholder(/search|type/i).first().fill('Naga')
    await sleep(800)
  })
  await feature('admin', 'fees-edit-registration', async (p) => {
    await go(p, '/admin/fees')
    const first = p.locator('input[type=number], input[inputmode=numeric]').first()
    await first.fill('900')
    await sleep(500)
  })
  await feature('admin', 'fees-method-edit', async (p) => {
    await go(p, '/admin/fees')
    await press(p, /^Accounts/)
    await p.getByRole('button', { name: /^Edit GCash/ }).click()
    await waitDialog(p)
  })
  await feature('admin', 'fees-method-remove-confirm', async (p) => {
    await go(p, '/admin/fees')
    await press(p, /^Accounts/)
    await p.getByRole('button', { name: /^Remove Bank transfer/ }).click()
    await sleep(900)
  })
  await feature('admin', 'fees-method-add-filled', async (p) => {
    await go(p, '/admin/fees')
    await press(p, /^Accounts/)
    await p.getByRole('button', { name: 'Add a way to pay' }).click()
    await waitDialog(p)
    const inputs = dlg(p).locator('input')
    await inputs.nth(0).fill('PayMaya Business')
    await inputs.nth(1).fill('Camarines Sur Dancesport Association')
    await inputs.nth(2).fill('0919 220 4417')
    await sleep(500)
  })
  await feature('admin', 'staff-add-with-photo', async (p) => {
    await go(p, '/admin/staff')
    await press(p, /^Add account/)
    await waitDialog(p)
    await fillIn(p, 'Name', 'Marites Dela Cruz')
    await fillIn(p, 'Email', 'marites.delacruz@gmail.com')
    await upload(p)
    await sleep(800)
  }, { keep: true })
  await feature('admin', 'staff-temp-password', async (p) => {
    await dlg(p).getByRole('button').filter({ hasNotText: /Cancel|Close|Choose photo/ }).last().click()
    await p.getByText(/temporary password/i).first().waitFor()
  })
  await feature('admin', 'staff-edit', async (p) => {
    await go(p, '/admin/staff')
    await p.getByRole('button', { name: /^Edit /i }).nth(1).click()
    await waitDialog(p)
  })
  await feature('admin', 'staff-reset-password', async (p) => {
    await go(p, '/admin/staff')
    await p.getByRole('button', { name: /reset password/i }).first().click()
    await sleep(900)
  })
  await feature('admin', 'staff-delete-confirm', async (p) => {
    await go(p, '/admin/staff')
    await p.getByRole('button', { name: /^Delete /i }).first().click()
    await sleep(900)
  })
  await feature('admin', 'categories-age-group-add', async (p) => {
    await go(p, '/admin/categories')
    await press(p, /^Age groups/)
    await press(p, /^New /)
    await waitDialog(p)
  })
  await feature('admin', 'categories-classes-tab', async (p) => {
    await go(p, '/admin/categories')
    await press(p, /^Classes/)
    await settle(p)
  })
  await feature('admin', 'categories-class-add', async (p) => {
    await go(p, '/admin/categories')
    await press(p, /^Classes/)
    await press(p, /^New /)
    await waitDialog(p)
  })
  await feature('admin', 'categories-kinds-tab', async (p) => {
    await go(p, '/admin/categories')
    await press(p, /^(Kinds|Event kinds)/)
    await settle(p)
  })
  await feature('admin', 'categories-kind-add', async (p) => {
    await go(p, '/admin/categories')
    await press(p, /^Event kinds/)
    await press(p, /^New /)
    await waitDialog(p)
  })
  await feature('admin', 'offline-day-start', async (p) => {
    await go(p, '/admin/offline-day')
    await press(p, /Start|Hand|Prepare/)
    await sleep(900)
  })
  await feature('admin', 'site-hero-edit', async (p) => {
    await go(p, '/admin/site')
    await press(p, /Change|Edit|Replace|Upload/)
    await sleep(700)
  })
  await feature('admin', 'certificates-editor', async (p) => {
    await go(p, '/admin/certificates')
    await sleep(800)
  })
  await feature('admin', 'account-password-filled', async (p) => {
    await go(p, '/account')
    await press(p, /^Password/)
    await p.getByLabel('Current password').fill('bis2026')
    await p.getByLabel('New password', { exact: true }).fill('Rosales-Dance-2027')
    await p.getByLabel('Confirm new password').fill('Rosales-Dance-2027')
    await sleep(500)
  })
  await feature('admin', 'account-name-edit', async (p) => {
    await go(p, '/account')
    await sleep(500)
  })

  // ------------------------------------------------------------------------------------------------ athlete / team / coach send things
  await feature('athlete', 'edit-account-filled', async (p) => {
    await go(p, '/athlete/edit')
    await sleep(500)
  })
  await feature('athlete', 'password-filled', async (p) => {
    await go(p, '/athlete/password')
    const pw = p.locator('input[type=password]')
    await pw.nth(0).fill('bis2026')
    await pw.nth(1).fill('Kai-Ibarra-2027')
    if ((await pw.count()) > 2) await pw.nth(2).fill('Kai-Ibarra-2027')
    await sleep(500)
  })
  // The team sends an entry with a payment screenshot
  await feature('team', 'register-choose', async (p) => {
    await go(p, '/team/register')
    await p.getByLabel('Dancer or couple').selectOption({ index: 1 }).catch(() => {})
    await sleep(900)
  })
  await feature('team', 'register-events-and-fee', async (p) => {
    // Find a dancer and an event that fit together (age group, class), so the form has no warning
    const dancers = p.getByLabel('Dancer or couple')
    const count = await dancers.locator('option').count()
    for (let d = 1; d < count; d++) {
      await dancers.selectOption({ index: d })
      await sleep(500)
      for (const ev of ['E8', 'E11']) {
        const box = p.getByLabel('Enter ' + ev)
        if (!(await box.count()) || !(await box.isEnabled())) continue
        await box.check()
        await sleep(1100)
        const bad = await p.getByText(/is for .* but the|already|cannot|not allowed/i).count()
        if (!bad) return
        await box.uncheck()
      }
    }
    throw new Error('no dancer fits an open event')
  })
  await feature('team', 'register-payment-proof', async (p) => {
    await p.getByLabel('Pay with').selectOption({ index: 1 }).catch(() => {})
    const ref = p.getByLabel(/reference/i).first()
    if (await ref.count()) await ref.fill('GC-2026-220914')
    await p.getByLabel('Payment screenshot').setInputFiles(PROOF)
    await sleep(900)
  })
  await feature('team', 'register-sent', async (p) => {
    await press(p, /^Send to the secretariat/)
    await sleep(1800)
  })
  await feature('team', 'membership', async (p) => {
    await go(p, '/team/membership')
  })
  await feature('team', 'requests-waiting', async (p) => {
    await go(p, '/team/requests')
  })

  // ------------------------------------------------------------------------------------------------ coach: not linked yet
  await quietly('new coach account', async () => {
    const c = await browser.newContext({ ...DEVICES[device] })
    const r = await c.request.post(`${BASE}/api/auth/coach/sign-up`, { data: { name: 'Leandro Fabian', email: 'leandro.fabian@gmail.com', password: 'Leandro-2027-ok', photo: `data:image/png;base64,${png(120, 90, 60, 64, 64).toString('base64')}` } })
    if (!r.ok()) throw new Error(`coach sign-up ${r.status()}`)
    sessions['coach:new'] = { ctx: c, page: await c.newPage() }
  })
  await feature('coach', 'not-linked-notice', async (p) => {
    const s = sessions['coach:new']
    await go(s.page, '/coach')
    return { page: s.page }
  })
  await feature('coach', 'link-request', async () => {
    const s = sessions['coach:new']
    await go(s.page, '/coach/link')
    const sel = s.page.locator('select, [role=combobox]').first()
    await sel.selectOption({ index: 1 }).catch(() => {})
    await sleep(500)
    return { page: s.page }
  })
  await feature('coach', 'link-request-waiting', async () => {
    const s = sessions['coach:new']
    await press(s.page, /^(Send|Request)/)
    await sleep(1500)
    return { page: s.page }
  })

  // ------------------------------------------------------------------------------------------------ secretariat: decide what was sent
  await feature('secretariat', 'entry-request-open-proof', async (p) => {
    await go(p, '/secretariat/entry-requests')
    await p.getByText(/screenshot|proof|receipt/i).first().click().catch(() => {})
    await sleep(900)
  })
  await feature('secretariat', 'entry-request-turn-down-filled', async (p) => {
    await closeDialogs(p)
    await go(p, '/secretariat/entry-requests')
    await p.getByRole('button', { name: /^Turn down the entry/ }).first().click()
    await waitDialog(p)
    await dlg(p).locator('textarea, input').first().fill('The amount on the screenshot is lower than the fee.')
  })
  await feature('secretariat', 'entry-request-approved', async (p) => {
    await closeDialogs(p)
    await go(p, '/secretariat/entry-requests')
    await p.getByRole('button', { name: /^Approve the entry/ }).first().click()
    await sleep(1800)
  })
  await feature('secretariat', 'account-link-approve', async (p) => {
    await go(p, '/secretariat/account-links')
    await sleep(400)
  })
  await feature('secretariat', 'account-link-turn-down', async (p) => {
    await p.getByRole('button', { name: /^Turn down the request/ }).first().click()
    await sleep(1200)
  })
  await feature('secretariat', 'account-link-approved', async (p) => {
    await closeDialogs(p)
    await go(p, '/secretariat/account-links')
    await p.getByRole('button', { name: /^Link / }).first().click()
    await sleep(1500)
  })
  await feature('secretariat', 'profile-change-approve', async (p) => {
    await go(p, '/secretariat/profile-changes')
    await sleep(400)
  })
  await feature('secretariat', 'profile-change-turn-down-filled', async (p) => {
    await p.getByRole('button', { name: /^Turn down change/ }).first().click()
    await waitDialog(p)
    await dlg(p).locator('textarea, input').first().fill('Please ask your coach to confirm the change first.')
  })
  await feature('secretariat', 'athlete-side-panel', async (p) => {
    await go(p, '/secretariat/athletes')
    await p.locator('tbody tr').first().click()
    await sleep(900)
  })
  await feature('secretariat', 'athlete-add-filled', async (p) => {
    await go(p, '/secretariat/athletes')
    await press(p, /^Add athlete/)
    await waitDialog(p)
    await fillIn(p, /Name|Dancer/, 'Jericho Fuentes').catch(() => {})
    await sleep(500)
  })
  await feature('secretariat', 'import-csv-preview', async (p) => {
    await go(p, '/secretariat/athletes')
    await press(p, /^Import CSV/)
    await waitDialog(p)
    await upload(p, join(ROOT, 'docs', 'operations', 'test-competitors.csv'))
    await sleep(1500)
  })
  await feature('secretariat', 'entry-edit', async (p) => {
    await go(p, '/secretariat/athletes')
    await p.getByRole('button', { name: /^Edit /i }).first().click()
    await waitDialog(p)
  })
  await feature('secretariat', 'entry-delete-confirm', async (p) => {
    await go(p, '/secretariat/athletes')
    await p.locator('tbody tr').first().click()
    await sleep(700)
    await press(p, /Delete entry|Delete/)
    await sleep(900)
  })
  await feature('secretariat', 'event-add-filled', async (p) => {
    await go(p, '/secretariat')
    await press(p, /^Add event/)
    await waitDialog(p)
    await sleep(500)
  })
  await feature('secretariat', 'event-edit', async (p) => {
    await go(p, '/secretariat')
    await p.getByRole('button', { name: /^Edit /i }).first().click()
    await waitDialog(p)
  })
  await feature('secretariat', 'event-delete-confirm', async (p) => {
    await go(p, '/secretariat')
    await p.getByRole('button', { name: /^Delete /i }).first().click()
    await sleep(900)
  })
  await feature('secretariat', 'event-scratch', async (p) => {
    await go(p, `/secretariat/events/${eid(9)}`)
    await p.getByRole('button', { name: /Scratch/ }).first().click()
    await sleep(1200)
  })
  await feature('secretariat', 'team-add-filled', async (p) => {
    await go(p, '/secretariat/teams')
    await press(p, /Add team/)
    await waitDialog(p)
    await fillIn(p, /Name/, 'Catanduanes Ballroom Guild').catch(() => {})
    await sleep(500)
  })
  await feature('secretariat', 'team-edit', async (p) => {
    await go(p, '/secretariat/teams')
    await p.getByRole('button', { name: /^Edit /i }).first().click()
    await waitDialog(p)
  })
  await feature('secretariat', 'team-delete-blocked', async (p) => {
    await go(p, '/secretariat/teams')
    await p.getByRole('button', { name: /^Delete /i }).first().click()
    await sleep(1000)
  })
  await feature('secretariat', 'coach-add-filled', async (p) => {
    await go(p, '/secretariat/coaches')
    await press(p, /Add coach/)
    await waitDialog(p)
    await fillIn(p, /Name/, 'Benedicto Ortega').catch(() => {})
    await sleep(500)
  })
  await feature('secretariat', 'coach-edit', async (p) => {
    await go(p, '/secretariat/coaches')
    await p.getByRole('button', { name: /^Edit /i }).first().click()
    await waitDialog(p)
  })
  await feature('secretariat', 'late-entry-add-filled', async (p) => {
    await go(p, '/secretariat/late-entries')
    await press(p, /^Add late entry/)
    await waitDialog(p)
    await sleep(500)
  })
  await feature('secretariat', 'cash-payment-mark-paid', async (p) => {
    await go(p, '/secretariat/late-entries')
    await press(p, /Cash payments/)
    await settle(p)
    await p.getByRole('button', { name: /paid at the venue|Mark/i }).first().click().catch(() => {})
    await sleep(1000)
  })
  await feature('secretariat', 'schedule-move', async (p) => {
    await go(p, '/secretariat/schedule')
    await p.getByRole('button', { name: /move|down|up/i }).first().click().catch(() => {})
    await sleep(900)
  })
  await feature('secretariat', 'program-start-time', async (p) => {
    await go(p, '/secretariat/program')
    const t = p.locator('input[type=time]').first()
    await t.fill('08:30')
    await t.blur()
    await sleep(2500)
  })
  await feature('secretariat', 'program-break-filled', async (p) => {
    await press(p, /Add break/)
    await waitDialog(p)
    await sleep(500)
  })
  await feature('secretariat', 'program-line-edit', async (p) => {
    await closeDialogs(p)
    await go(p, '/secretariat/program')
    await p.getByRole('button', { name: /^Edit/i }).first().click()
    await waitDialog(p)
  })
  await feature('secretariat', 'program-print', async (p) => {
    await go(p, `/competitions/${C}/program/print`)
  })
  await feature('secretariat', 'print-recall-list', async (p) => {
    await go(p, `/print/recall/${eid(3)}`)
  })
  await feature('secretariat', 'account-password-filled', async (p) => {
    await go(p, '/account')
    await press(p, /^Password/)
    await p.getByLabel('Current password').fill('bis2026')
    await p.getByLabel('New password', { exact: true }).fill('Bellosillo-2027-ok')
    await p.getByLabel('Confirm new password').fill('Bellosillo-2027-ok')
    await sleep(500)
  })

  // ------------------------------------------------------------------------------------------------ scrutineer: run the round in review
  rounds = await api(admin0, 'getCompetitionRounds', C)
  await feature('scrutineer', 'rounds-plan', async (p) => {
    await go(p, '/scrutineer')
    await sleep(400)
  })
  await feature('scrutineer', 'heats-split', async (p) => {
    await go(p, '/scrutineer/heats')
    await press(p, /Split evenly/).catch(() => {})
    await sleep(900)
  })
  await feature('scrutineer', 'heats-redance-dialog', async (p) => {
    await go(p, '/scrutineer/heats')
    await press(p, /Redance/)
    await waitDialog(p)
  })
  await feature('scrutineer', 'live-redance-waiting', async (p) => {
    await closeDialogs(p)
    await go(p, '/scrutineer/live')
    await p.locator('select').first().selectOption(rid(8, 'semi_final')).catch(() => {})
    await sleep(900)
  })
  await feature('scrutineer', 'paper-marks-filled', async (p) => {
    await go(p, '/scrutineer/paper-marks')
    await p.getByLabel('Round').selectOption(rid(6, 'semi_final'))
    await sleep(700)
    await selectByText(p.getByLabel('Adjudicator'), /Alfredo/)
    await sleep(900)
    await markAll(p)
    await sleep(500)
  })
  await feature('scrutineer', 'paper-marks-confirm', async (p) => {
    await press(p, /^Submit/)
    await waitDialog(p)
  })
  await feature('scrutineer', 'recall-review', async (p) => {
    await closeDialogs(p)
    await go(p, '/scrutineer/recall')
    await p.getByLabel('Round').selectOption(rid(7, 'semi_final')).catch(() => {})
    await settle(p)
  })
  await feature('scrutineer', 'results-select-final', async (p) => {
    await go(p, '/scrutineer/results')
    await p.getByLabel('Round').selectOption(rid(7, 'semi_final'))
    await settle(p)
  })
  await feature('scrutineer', 'approve-confirm', async (p) => {
    await press(p, /Approve results/)
    await waitDialog(p)
  }, { keep: true })
  await feature('scrutineer', 'approved', async (p) => {
    await dlg(p).getByRole('button').filter({ hasNotText: /Cancel|Close/ }).last().click()
    await sleep(3500)
  })
  await feature('scrutineer', 'publish-confirm', async (p) => {
    await settle(p)
    await press(p, /Publish results/)
    await waitDialog(p)
  }, { keep: true })
  await feature('scrutineer', 'published', async (p) => {
    await dlg(p).getByRole('button').filter({ hasNotText: /Cancel|Close/ }).last().click()
    await sleep(2500)
  })
  await feature('scrutineer', 'advancement-edit', async (p) => {
    await go(p, '/scrutineer/advancement')
    await p.locator('input[type=number]').first().fill('8').catch(() => {})
    await sleep(500)
  })
  await feature('scrutineer', 'account-signature', async (p) => {
    await go(p, '/account')
    await sleep(500)
  })

  // ------------------------------------------------------------------------------------------------ chairperson: a tie waiting for them
  await feature('chairperson', 'recall-confirm-tie', async (p) => {
    await go(p, '/scrutineer/recall')
    await sleep(500)
  })
  await feature('chairperson', 'results-confirm-tie', async (p) => {
    await go(p, '/scrutineer/results')
    await sleep(500)
  })

  // ------------------------------------------------------------------------------------------------ compere: what was just published
  for (const [key, name] of [['4', 'call'], ['5', 'recall'], ['6', 'finalists'], ['7', 'results']]) {
    await feature('compere', `slide-${name}`, async (p) => {
      await go(p, '/compere')
      await p.keyboard.press(key)
      await sleep(1200)
    })
  }
  await feature('compere', 'slide-results-podium', async (p) => {
    await p.keyboard.press('7')
    for (let i = 0; i < 4; i++) {
      await p.keyboard.press(' ')
      await sleep(500)
    }
    await sleep(3500)
  })
  await feature('compere', 'next-announcement', async (p) => {
    await p.keyboard.press('ArrowRight')
    await sleep(900)
  })

  // ------------------------------------------------------------------------------------------------ adjudicator: waiting, then a final
  const pinOf = async (id) => {
    const adm = await sess('admin')
    const all = await api(adm, 'getAdjudicatorPins', C)
    console.log('PINS', all.length, JSON.stringify((await api(adm, 'getCompetitions')).map((c) => c.name + ' ' + c.date)), (await api(adm, 'getAdjudicators')).map((a) => a.letter + ':' + a.id).join(','))
    return all.find((x) => x.adjudicatorId === id).pin
  }
  await quietly('start a final for F, G and H', async () => {
    const scr = await sess('scrutineer')
    const sec = await sess('secretariat')
    const adm = await sess('admin')
    const db = new Database(dbPath)
    db.prepare("UPDATE events SET syllabus = ? WHERE number = 14").run(
      'Closed syllabus. Only the figures in the 2026 association syllabus may be danced. Samba: basic movement, whisk, samba walk. Jive: basic movement, change of places, American spin. No lifts, drops or open-leg moves.',
    )
    db.close()
    await api(adm, 'setPanel', eid(14), ['adj-f', 'adj-g', 'adj-h'])
    const ent = (await api(sec, 'getCompetitionEntries', C)).filter((x) => x.eventId === eid(14))
    const pays = Object.fromEntries((await api(sec, 'getPayments')).map((x) => [x.id, x.status]))
    for (const e of ent) if (['unpaid', 'rejected', 'for_checking'].includes(pays[e.paymentId])) await api(sec, 'markPaidAtVenue', e.paymentId).catch(() => api(sec, 'setEntryScratched', e.id, true))
    const all = await api(scr, 'getCompetitionRounds', C)
    const r = all.find((x) => x.eventNumber === 14 && x.type === 'final') ?? all.find((x) => x.eventNumber === 14)
    await api(scr, 'startRound', r.roundId)
  })
  await feature('adjudicator', 'final-placing', async () => {
    const s = await sess('adjudicator', (await pinOf('adj-f')))
    await go(s.page, '/adjudicator/mark')
    await s.page.locator('button[aria-label^="Place "]').first().waitFor()
    return { page: s.page }
  })
  await feature('adjudicator', 'final-placed', async () => {
    const s = await sess('adjudicator', await pinOf('adj-f'))
    const p = s.page
    const tabs = p.getByRole('tab')
    for (let t = 0; t < Math.max(await tabs.count(), 1); t++) {
      if (await tabs.count()) await tabs.nth(t).click()
      await sleep(300)
      const names = await p.locator('button[aria-label^="Place "]').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label')))
      for (const n of names) await p.getByRole('button', { name: n, exact: true }).click().catch(() => {})
    }
    await sleep(500)
    return { page: p }
  })
  await feature('adjudicator', 'final-review', async () => {
    const s = await sess('adjudicator', (await pinOf('adj-f')))
    await press(s.page, /^Submit/)
    await s.page.getByRole('button', { name: 'Final and submit' }).waitFor()
    return { page: s.page }
  })
  await feature('adjudicator', 'final-sign', async () => {
    const s = await sess('adjudicator', (await pinOf('adj-f')))
    const p = s.page
    await p.getByRole('button', { name: 'Final and submit' }).click()
    const canvas = p.locator('canvas').first()
    await canvas.waitFor()
    const box = await canvas.boundingBox()
    await p.mouse.move(box.x + 20, box.y + box.height / 2)
    await p.mouse.down()
    for (let i = 1; i <= 12; i++) await p.mouse.move(box.x + 20 + (i * (box.width - 40)) / 12, box.y + box.height / 2 + (i % 2 ? -18 : 18))
    await p.mouse.up()
    return { page: p }
  })
  await feature('adjudicator', 'final-submitted', async () => {
    const s = await sess('adjudicator', (await pinOf('adj-f')))
    await s.page.getByRole('button', { name: 'Finalize' }).click()
    await s.page.waitForURL((u) => u.pathname.endsWith('/submitted'))
    await settle(s.page)
    return { page: s.page }
  })

  // ------------------------------------------------------------------------------------------------ barker
  await feature('barker', 'floor-with-round', async (p) => {
    await go(p, '/barker')
  })
  await feature('barker', 'next-event', async (p) => {
    await go(p, '/barker/next')
  })
}

// ======================================================================================================== go
browser = await chromium.launch({ executablePath: CHROME })
const wanted = process.argv.slice(2)
for (const d of Object.keys(DEVICES)) {
  if (wanted.length && !wanted.includes(d)) continue
  device = d
  sessions = {}
  counters = {}
  console.log(`=== ${d}`)
  const db = await startServer()
  try {
    await sequence(db)
  } catch (e) {
    console.error(`SEQUENCE STOPPED (${d}): ${e.message}`)
  }
  for (const s of Object.values(sessions)) await s.ctx.close().catch(() => {})
  await stopServer()
}
await browser.close()
rmSync(work, { recursive: true, force: true })
console.log(`${taken} screenshots, ${missed.length} missed`)
for (const m of missed) console.log(`  - ${m}`)
