// Screenshots of every screen and feature of each role (admin, secretariat, scrutineer, chairperson, compere,
// barker, adjudicator) and each account kind (athlete, coach, team), plus the public site. Each one is taken twice:
// MacBook 12" (1920x1200) and iPhone 15 (1179x2556), one screen each. Output: screenshots/<role>/<device>/<NN>-<name>.png
//
// It needs a running server on a throwaway database that holds the scenario data (see docs/operations/TEST_ACCOUNTS.md,
// "One competition with every scenario") after `node rehearsal/polish-data.mjs`.
//   BASE=http://localhost:4062 node rehearsal/role-shots.mjs [role ...]
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright-core'

const ROOT = resolve(import.meta.dirname, '..')
const OUT = process.env.OUT ?? join(ROOT, 'screenshots')
const BASE = process.env.BASE ?? 'http://localhost:4062'
const CHROME = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => p && existsSync(p))
if (!CHROME) throw new Error('No Chrome or Edge found. Set CHROME_PATH.')

const DEVICES = {
  'macbook-12': { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 },
  'iphone-15': {
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
}
const PASSWORD = 'bis2026'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ------------------------------------------------------------------------------------------------ plumbing
let browser
const post = (ctx, path, data) => ctx.request.post(BASE + path, { data })
async function api(ctx, name, ...args) {
  const r = await post(ctx, `/api/call/${name}`, { args })
  const j = await r.json()
  if (!r.ok()) throw new Error(`${name}: ${j.error ?? r.status()}`)
  return j.data
}
async function newContext(device, signIn) {
  const ctx = await browser.newContext({ ...DEVICES[device], reducedMotion: 'reduce' })
  if (signIn) {
    const [kind, body] = signIn
    const r = await post(ctx, `/api/auth/${kind}`, body)
    if (!r.ok()) throw new Error(`sign-in ${kind} gave ${r.status()}`)
  }
  const page = await ctx.newPage()
  page.setDefaultTimeout(15000)
  return { ctx, page }
}
async function settle(page) {
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForFunction(() => !document.querySelector('[class*="skeleton" i], [data-skeleton]'), null, { timeout: 8000 }).catch(() => {})
  await page.evaluate(() => document.fonts?.ready).catch(() => {})
  await sleep(700)
}
const dialog = async (page) => {
  await page.locator('[role=dialog]').first().waitFor()
  await sleep(500)
}
const closeDialogs = async (page) => {
  await page.keyboard.press('Escape')
  await page.locator('[role=dialog]').first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {})
  await sleep(300)
}
const fill = (page, label, value) => page.locator('[role=dialog]').getByLabel(label).first().fill(value)
const tap = (page, n) => page.locator('button', { hasText: new RegExp(`^0*${n}$`) }).first().click()

const markAll = async (p) => {
  const tabs = p.getByRole('tab')
  const count = await tabs.count()
  for (let i = 0; i < Math.max(count, 1); i++) {
    if (count) await tabs.nth(i).click()
    await sleep(300)
    const numbers = await p.locator('button').evaluateAll((bs) => bs.map((b) => b.textContent.trim()).filter((t) => /^[0-9]{3}$/.test(t)))
    const done = count ? Number((await tabs.nth(i).locator('span').last().textContent()) || 0) : 0
    for (const n of numbers.slice(done, 6)) await tap(p, Number(n))
  }
}
let missed = 0
let taken = 0
async function capture(page, role, index, name, device) {
  const dir = join(OUT, role, device)
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${String(index).padStart(2, '0')}-${name}.png`)
  const overlay = await page.locator('[role=dialog]').first().isVisible().catch(() => false)
  // An open dialog or drawer is shown over the page as it is; otherwise the whole page, top to bottom
  await page.screenshot({ path: file, fullPage: false })
  taken++
}

// A step is { name, path?, act?, only?, anon? }: open the path, run act, take the picture
async function run(role, steps, signIn) {
  for (const device of Object.keys(DEVICES)) {
    let session = await newContext(device, signIn)
    let anon
    const others = new Map()
    for (const [i, s] of steps.entries()) {
      if (s.only && s.only !== device) continue
      if (process.env.ONLY && !process.env.ONLY.split(',').includes(s.name)) continue
      const sess = s.as ? (others.get(s.as[1].pin ?? s.as[1].email) ?? others.set(s.as[1].pin ?? s.as[1].email, await newContext(device, s.as)).get(s.as[1].pin ?? s.as[1].email)) : s.anon ? (anon ??= await newContext(device, null)) : session
      const { page } = sess
      try {
        if (s.path) {
          await page.goto(BASE + s.path)
          await settle(page)
        }
        await s.act?.(page, device)
        if (s.act) await sleep(500)
        await capture(page, role, i + 1, s.name, device)
        console.log(`shot ${role}/${String(i + 1).padStart(2, '0')}-${s.name}-${device}`)
      } catch (e) {
        missed++
        await page.screenshot({ path: process.env.TEMP + '/miss.png' }).catch(() => {})
        console.error(`MISSED ${role}/${s.name} (${device}): ${e.message.split('\n').slice(0, 3).join(' | ')}`)
      }
      await closeDialogs(page).catch(() => {})
    }
    await session.ctx.close()
    await anon?.ctx.close()
    for (const o of others.values()) await o.ctx.close()
  }
}

// ------------------------------------------------------------------------------------------------ the data
const STAFF = {
  admin: 'amelia.rosales@gmail.com',
  secretariat: 'jonas.bellosillo@gmail.com',
  scrutineer: 'teresita.quimpo@gmail.com',
  chairperson: 'gregorio.almazan@gmail.com',
  compere: 'dante.ibarra@gmail.com',
  barker: 'ruben.soriano@gmail.com',
}
const staffIn = (role) => ['staff', { username: STAFF[role], password: PASSWORD }]
const ctx0 = await (async () => {
  browser = await chromium.launch({ executablePath: CHROME })
  return newContext('macbook-12', staffIn('admin'))
})()
const comp = (await api(ctx0.ctx, 'getCompetitions'))[0]
const events = await api(ctx0.ctx, 'getEvents', comp.id)
const rounds = await api(ctx0.ctx, 'getCompetitionRounds', comp.id)
const eventId = (n) => events.find((e) => e.number === n).id
const roundOf = (n, type) => rounds.find((r) => r.eventNumber === n && r.type === type)?.roundId
const pins = await api(ctx0.ctx, 'getAdjudicatorPins', comp.id)
const pinOf = (id) => pins.find((p) => p.adjudicatorId === id).pin
await ctx0.ctx.close()
const C = comp.id
const E_PUBLISHED = 3 // every round, heats, final
const E_LIVE = 6
console.log(`competition ${comp.name}, ${events.length} events`)

const menu = { name: 'menu', only: 'iphone-15', path: null, act: (p) => p.getByRole('button', { name: /menu/i }).first().click() }
const account = [
  { name: 'account', path: '/account' },
  { name: 'notifications', path: '/notifications' },
]
const staffSignIn = { name: 'sign-in', path: '/staff-access', anon: true }

// ------------------------------------------------------------------------------------------------ the roles
const ROLES = {
  public: {
    steps: [
      { name: 'home', path: '/' },
      { name: 'menu', path: '/', only: 'iphone-15', act: (p) => p.getByRole('button', { name: /menu/i }).first().click() },
      { name: 'competitions', path: '/competitions' },
      { name: 'competition', path: `/competitions/${C}` },
      { name: 'program', path: `/competitions/${C}/program` },
      { name: 'live-competition', path: `/live/${C}` },
      { name: 'live', path: '/live' },
      { name: 'event-results', path: `/competitions/${C}/events/${eventId(E_PUBLISHED)}` },
      { name: 'results', path: '/results' },
      { name: 'results-competition', path: `/results/${C}` },
      { name: 'athletes', path: '/athletes' },
      {
        name: 'competitor',
        path: '/athletes',
        act: async (p) => {
          const href = await p.locator('a[href^="/competitors/"]').first().getAttribute('href')
          await p.goto(BASE + href)
          await settle(p)
        },
      },
      { name: 'standings', path: '/standings' },
      { name: 'privacy', path: '/privacy' },
      { name: 'choose-sign-in', path: '/login' },
      { name: 'forgot-password', path: '/forgot-password' },
      { name: 'not-found', path: '/nothing-here' },
    ],
  },

  admin: {
    signIn: staffIn('admin'),
    steps: [
      staffSignIn,
      { name: 'menu', path: '/admin/competitions', only: 'iphone-15', act: (p) => p.getByRole('button', { name: /menu/i }).first().click() },
      { name: 'competitions', path: '/admin/competitions' },
      {
        name: 'competition-new',
        path: '/admin/competitions',
        act: async (p) => {
          await p.getByRole('button', { name: 'New competition' }).click()
          await dialog(p)
          await fill(p, 'Name', 'Naga Dancesport Open 2027')
          await fill(p, 'Date', '2027-03-14')
          await fill(p, 'Organizer', 'Camarines Sur Dancesport Association')
          await fill(p, 'Venue', 'Naga City Coliseum, Naga City')
          await fill(p, 'Executor', 'BIS Scrutineering Team')
          await fill(p, 'Entries close', '2027-03-01')
          await fill(p, 'Fees due', '2027-03-07')
        },
      },
      { name: 'categories', path: '/admin/categories' },
      { name: 'staff', path: '/admin/staff' },
      {
        name: 'staff-add',
        path: '/admin/staff',
        act: async (p) => {
          await p.getByRole('button', { name: 'Add account' }).click()
          await dialog(p)
          await fill(p, 'Name', 'Marites Dela Cruz')
          await fill(p, 'Email', 'marites.delacruz@gmail.com')
        },
      },
      { name: 'adjudicators', path: '/admin/adjudicators' },
      {
        name: 'adjudicator-add',
        path: '/admin/adjudicators',
        act: async (p) => {
          await p.getByRole('button', { name: 'Add adjudicator' }).evaluate((b) => b.click())
          await dialog(p)
          await fill(p, 'Name', 'Marina S. Villanueva')
        },
      },
      {
        name: 'panels',
        path: '/admin/adjudicators',
        act: async (p) => {
          await p.getByRole('tab', { name: 'Panels' }).click()
          await settle(p)
        },
      },
      { name: 'pin-cards', path: `/print/pin-cards/${C}` },
      { name: 'points', path: '/admin/points' },
      { name: 'payments', path: '/admin/payments' },
      {
        name: 'payment-detail',
        path: '/admin/payments',
        act: async (p) => {
          await p.locator('tbody tr').first().click()
          await dialog(p)
        },
      },
      { name: 'fees', path: '/admin/fees' },
      {
        name: 'fees-memberships',
        path: '/admin/fees',
        act: async (p) => {
          await p.getByText('Memberships', { exact: true }).first().click()
          await settle(p)
        },
      },
      {
        name: 'fees-accounts',
        path: '/admin/fees',
        act: async (p) => {
          await p.getByText('Accounts', { exact: true }).first().click()
          await settle(p)
        },
      },
      {
        name: 'payment-method-add',
        path: '/admin/fees',
        act: async (p) => {
          await p.getByRole('button', { name: 'Add a way to pay' }).evaluate((b) => b.click())
          await dialog(p)
        },
      },
      { name: 'offline-day', path: '/admin/offline-day' },
      { name: 'past-competition', path: '/admin/past-competition' },
      { name: 'site', path: '/admin/site' },
      { name: 'results', path: '/admin/results' },
      { name: 'event-list', path: '/admin/event-list' },
      { name: 'event-list-print', path: `/print/event-list/${C}` },
      { name: 'certificates', path: '/admin/certificates' },
      { name: 'security', path: '/admin/security' },
      {
        name: 'two-step',
        path: '/admin/security',
        act: async (p) => {
          await p.getByRole('button', { name: /turn on/i }).first().click()
          await dialog(p)
        },
      },
      ...account,
    ],
  },

  secretariat: {
    signIn: staffIn('secretariat'),
    steps: [
      staffSignIn,
      { name: 'menu', path: '/secretariat', only: 'iphone-15', act: (p) => p.getByRole('button', { name: /menu/i }).first().click() },
      { name: 'events', path: '/secretariat' },
      {
        name: 'event-add',
        path: '/secretariat',
        act: async (p) => {
          await p.getByRole('button', { name: 'Add event' }).click()
          await dialog(p)
        },
      },
      { name: 'event', path: `/secretariat/events/${eventId(E_LIVE)}` },
      { name: 'athletes', path: '/secretariat/athletes' },
      {
        name: 'athlete-add',
        path: '/secretariat/athletes',
        act: async (p) => {
          await p.getByRole('button', { name: 'Add athlete' }).click()
          await dialog(p)
        },
      },
      {
        name: 'import',
        path: '/secretariat/athletes',
        act: async (p) => {
          await p.getByRole('button', { name: 'Import CSV' }).click()
          await dialog(p)
        },
      },
      {
        name: 'enter-in-events',
        path: '/secretariat/athletes',
        act: async (p) => {
          await p.getByRole('button', { name: /^Enter .* in events/ }).first().click()
          await dialog(p)
          await sleep(1200)
        },
      },
      { name: 'teams', path: '/secretariat/teams' },
      {
        name: 'team-add',
        path: '/secretariat/teams',
        act: async (p) => {
          await p.getByRole('button', { name: /Add team/ }).click()
          await dialog(p)
        },
      },
      { name: 'coaches', path: '/secretariat/coaches' },
      {
        name: 'coach-add',
        path: '/secretariat/coaches',
        act: async (p) => {
          await p.getByRole('button', { name: /Add coach/ }).click()
          await dialog(p)
        },
      },
      { name: 'entry-requests', path: '/secretariat/entry-requests' },
      {
        name: 'request-turn-down',
        path: '/secretariat/entry-requests',
        act: async (p) => {
          await p.locator('tbody tr').first().getByRole('button', { name: /Turn down/ }).click()
          await dialog(p)
          await p.locator('[role=dialog]').locator('textarea, input').first().fill('The amount on the screenshot is lower than the fee.')
        },
      },
      { name: 'account-links', path: '/secretariat/account-links' },
      { name: 'profile-changes', path: '/secretariat/profile-changes' },
      { name: 'late-entries', path: '/secretariat/late-entries' },
      {
        name: 'late-entry-add',
        path: '/secretariat/late-entries',
        act: async (p) => {
          await p.getByRole('button', { name: /Add late entry|Add/ }).first().click()
          await dialog(p)
        },
      },
      {
        name: 'cash-payments',
        path: '/secretariat/late-entries',
        act: async (p) => {
          await p.getByText('Cash payments').first().click()
          await settle(p)
        },
      },
      { name: 'schedule', path: '/secretariat/schedule' },
      { name: 'heats', path: '/secretariat/heats' },
      { name: 'program', path: '/secretariat/program' },
      {
        name: 'program-break',
        path: '/secretariat/program',
        act: async (p) => {
          await p.getByRole('button', { name: 'Add break' }).click()
          await dialog(p)
        },
      },
      { name: 'panels', path: '/secretariat/panels' },
      { name: 'print-index', path: '/print' },
      { name: 'print-heats', path: `/print/heats/${eventId(E_LIVE)}` },
      { name: 'security', path: '/secretariat/security' },
      ...account,
    ],
  },

  scrutineer: {
    signIn: staffIn('scrutineer'),
    steps: [
      staffSignIn,
      { name: 'menu', path: '/scrutineer', only: 'iphone-15', act: (p) => p.getByRole('button', { name: /menu/i }).first().click() },
      { name: 'rounds', path: '/scrutineer' },
      { name: 'heats', path: '/scrutineer/heats' },
      { name: 'panels', path: '/scrutineer/panels' },
      { name: 'advancement', path: '/scrutineer/advancement' },
      { name: 'certificates', path: '/scrutineer/certificates' },
      { name: 'paper-marks', path: '/scrutineer/paper-marks' },
      { name: 'schedule', path: '/scrutineer/schedule' },
      { name: 'program', path: '/scrutineer/program' },
      { name: 'live', path: '/scrutineer/live' },
      { name: 'recall', path: '/scrutineer/recall' },
      { name: 'results', path: '/scrutineer/results' },
      { name: 'print-heats', path: `/print/heats/${eventId(E_PUBLISHED)}` },
      { name: 'print-recall', path: `/print/recall/${eventId(E_PUBLISHED)}` },
      { name: 'print-scores', path: `/print/scores/${eventId(E_PUBLISHED)}` },
      { name: 'print-results', path: `/print/results/${eventId(E_PUBLISHED)}` },
      { name: 'print-certificates', path: `/print/certificates/${eventId(E_PUBLISHED)}` },
      { name: 'print-blank-sheets', path: `/print/blank-sheets/${eventId(E_LIVE)}` },
      { name: 'security', path: '/scrutineer/security' },
      ...account,
    ],
  },

  chairperson: {
    signIn: staffIn('chairperson'),
    steps: [
      staffSignIn,
      { name: 'menu', path: '/scrutineer', only: 'iphone-15', act: (p) => p.getByRole('button', { name: /menu/i }).first().click() },
      { name: 'rounds', path: '/scrutineer' },
      { name: 'live', path: '/scrutineer/live' },
      { name: 'recall', path: '/scrutineer/recall' },
      { name: 'results', path: '/scrutineer/results' },
      { name: 'program', path: '/scrutineer/program' },
      { name: 'print-scores', path: `/print/scores/${eventId(E_PUBLISHED)}` },
      { name: 'security', path: '/scrutineer/security' },
      ...account,
    ],
  },

  compere: {
    signIn: staffIn('compere'),
    steps: [
      staffSignIn,
      { name: 'show', path: '/compere' },
      ...[['program', '2'], ['floor', '3'], ['call', '4'], ['recall', '5'], ['finalists', '6'], ['results', '7']].map(([name, key]) => ({
        name,
        path: '/compere',
        act: async (p) => {
          await p.keyboard.press(key)
          await sleep(1200)
        },
      })),
      ...account,
    ],
  },

  barker: {
    signIn: staffIn('barker'),
    steps: [staffSignIn, { name: 'floor', path: '/barker' }, { name: 'next', path: '/barker/next' }, ...account],
  },

  adjudicator: {
    signIn: ['adjudicator', { pin: pinOf('adj-i') }],
    steps: [
      { name: 'pin', path: '/adjudicator', anon: true },
      {
        name: 'pin-typed',
        path: '/adjudicator',
        anon: true,
        act: async (p) => {
          await p.keyboard.type('1770')
        },
      },
      { name: 'mark', path: '/adjudicator/mark' },
      {
        name: 'mark-chosen',
        path: '/adjudicator/mark',
        act: async (p) => {
          const numbers = await p.locator('button').evaluateAll((bs) => bs.map((b) => b.textContent.trim()).filter((t) => /^\d{1,3}$/.test(t)))
          for (const n of numbers.slice(0, 5)) await tap(p, Number(n))
        },
      },
      {
        name: 'review',
        path: '/adjudicator/mark',
        act: async (p) => {
          await markAll(p)
          await p.getByRole('button', { name: /^Submit/ }).click()
          await p.getByRole('button', { name: 'Final and submit' }).waitFor()
        },
      },
      {
        name: 'sign',
        path: '/adjudicator/mark',
        act: async (p) => {
          await markAll(p)
          await p.getByRole('button', { name: /^Submit/ }).click()
          await p.getByRole('button', { name: 'Final and submit' }).click()
          const canvas = p.locator('canvas').first()
          await canvas.waitFor()
          const box = await canvas.boundingBox()
          await p.mouse.move(box.x + 20, box.y + box.height / 2)
          await p.mouse.down()
          for (let i = 1; i <= 12; i++) await p.mouse.move(box.x + 20 + (i * (box.width - 40)) / 12, box.y + box.height / 2 + (i % 2 ? -18 : 18))
          await p.mouse.up()
        },
      },
      {
        name: 'submitted',
        path: '/adjudicator/submitted',
        as: ['adjudicator', { pin: pinOf('adj-g') }],
      },
    ],
  },

  athlete: {
    signIn: ['athlete', { email: 'kai.ibarra@gmail.com', password: PASSWORD }],
    steps: [
      { name: 'sign-in', path: '/login?as=athlete', anon: true },
      {
        name: 'sign-up',
        path: '/login?as=athlete',
        anon: true,
        act: async (p) => {
          await p.getByText('Create an account').first().click()
          await settle(p)
        },
      },
      { name: 'account', path: '/athlete' },
      { name: 'menu', path: '/athlete', only: 'iphone-15', act: (p) => p.getByRole('button', { name: /menu/i }).first().click() },
      { name: 'edit', path: '/athlete/edit' },
      { name: 'membership', path: '/athlete/membership' },
      { name: 'payments', path: '/athlete/payments' },
      { name: 'results', path: '/athlete/results' },
      { name: 'rankings', path: '/athlete/rankings' },
      { name: 'entries', path: '/athlete/entries' },
      { name: 'notifications', path: '/athlete/notifications' },
      { name: 'password', path: '/athlete/password' },
    ],
  },
}

const MEMBER_PAGES = ['', 'link', 'edit', 'notifications', 'dancers', 'results', 'rankings', 'entries', 'password']
for (const [kind, email, extra] of [
  ['coach', 'marites.villareal@gmail.com', []],
  ['team', 'naga.rhythm.studio@gmail.com', ['payments', 'membership', 'register', 'requests']],
]) {
  ROLES[kind] = {
    signIn: [kind, { email, password: PASSWORD }],
    steps: [
      { name: 'sign-in', path: `/login?as=${kind}`, anon: true },
      { name: 'menu', path: `/${kind}`, only: 'iphone-15', act: (p) => p.getByRole('button', { name: /menu/i }).first().click() },
      ...[...MEMBER_PAGES, ...extra].map((page) => ({ name: page || 'account', path: `/${kind}${page ? `/${page}` : ''}` })),
      {
        name: 'register-fee',
        path: `/${kind}/register`,
        act: async (p) => {
          await p.locator('input[type=checkbox]').first().check().catch(() => {})
          await sleep(900)
        },
      },
    ].filter((s) => kind === 'team' || s.name !== 'register-fee'),
  }
}

// ------------------------------------------------------------------------------------------------ go
const want = process.argv.slice(2)
for (const [role, def] of Object.entries(ROLES)) {
  if (want.length && !want.includes(role)) continue
  console.log(`--- ${role}`)
  await run(role, def.steps, def.signIn ?? null).catch((e) => console.error(`FAILED ${role}: ${e.message}`))
}
await browser.close()
console.log(`${taken} screenshots in ${OUT}, ${missed} missed`)
