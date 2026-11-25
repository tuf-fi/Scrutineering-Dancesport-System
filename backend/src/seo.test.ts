import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.ts'
import { loadConfig } from './config.ts'
import { openDatabase } from './db/client.ts'
import { runMigrations } from './db/migrate.ts'
import * as t from './db/schema.ts'
import { silentHub } from './realtime/hub.ts'

// What search engines and link previews read: robots.txt, the sitemap, and the tags of the page for each address

const PAGE = `<!doctype html><html><head>
<title>Default title</title>
<meta name="description" content="Default description" />
<link rel="canonical" href="__ORIGIN__/" />
<meta property="og:title" content="Default title" />
<meta property="og:description" content="Default description" />
<meta property="og:url" content="__ORIGIN__/" />
<meta property="og:image" content="__ORIGIN__/logo.png" />
</head><body></body></html>`

let app: Awaited<ReturnType<typeof buildApp>>
let dir = ''
const closers: Array<() => unknown> = []

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'bis-seo-'))
  mkdirSync(join(dir, 'assets'))
  writeFileSync(join(dir, 'index.html'), PAGE)
  const { db, sqlite } = openDatabase(':memory:')
  runMigrations(db)
  db.insert(t.competitions).values({ id: 'c1', name: 'Bicol "Open" & Cup', date: '2099-05-01', venue: 'Naga Gym', organizer: 'Org', image: 'data:image/png;base64,iVBORw0KGgo=' }).run()
  app = await buildApp({ config: loadConfig({ FRONTEND_DIR: dir, PUBLIC_URL: 'https://bis.example.com' }), sqlite, db, hub: silentHub(), liveBoardMs: 0 })
  closers.push(() => app.close(), () => sqlite.close(), () => rmSync(dir, { recursive: true, force: true }))
})
afterAll(async () => {
  for (const close of closers) await close()
})

const get = (url: string) => app.inject({ method: 'GET', url })

describe('search engines', () => {
  it('robots.txt keeps private screens and people out and points at the sitemap', async () => {
    const res = await get('/robots.txt')
    expect(res.headers['content-type']).toContain('text/plain')
    for (const line of ['Disallow: /api/', 'Disallow: /admin', 'Disallow: /staff-access', 'Disallow: /competitors', 'Allow: /api/competition-image/', 'Sitemap: https://bis.example.com/sitemap.xml']) {
      expect(res.body).toContain(line)
    }
    expect(res.body).not.toContain('Disallow: /competitions')
  })

  it('the sitemap lists the public pages and each competition, with full addresses', async () => {
    const res = await get('/sitemap.xml')
    expect(res.headers['content-type']).toContain('application/xml')
    expect(res.body).toContain('<loc>https://bis.example.com/</loc>')
    expect(res.body).toContain('<loc>https://bis.example.com/competitions</loc>')
    expect(res.body).toContain('<loc>https://bis.example.com/competitions/c1</loc><lastmod>2099-05-01</lastmod>')
    expect(res.body).not.toContain('/admin')
  })

  it('the home page gets its full address in the tags', async () => {
    const res = await get('/')
    expect(res.body).toContain('<title>Default title</title>')
    expect(res.body).toContain('<link rel="canonical" href="https://bis.example.com/" />')
    expect(res.body).toContain('<meta property="og:image" content="https://bis.example.com/logo.png" />')
    expect(res.body).not.toContain('__ORIGIN__')
    expect(res.headers['x-robots-tag']).toBeUndefined()
  })

  it("a competition's page, results and program carry its name, date, venue and card photo, with the text escaped", async () => {
    for (const url of ['/competitions/c1', '/results/c1', '/competitions/c1/program', '/competitions/c1/events/e9?x=1']) {
      const body = (await get(url)).body
      expect(body).toContain('<title>Bicol &quot;Open&quot; &amp; Cup | Bicol Oragon Scrutineering System</title>')
      expect(body).toContain('1 May 2099 at Naga Gym')
      expect(body).toContain('<meta property="og:image" content="https://bis.example.com/api/competition-image/c1" />')
      expect(body).toContain('<link rel="canonical" href="https://bis.example.com/competitions/c1" />')
    }
  })

  it('an unknown competition keeps the default tags', async () => {
    const body = (await get('/competitions/nope')).body
    expect(body).toContain('<title>Default title</title>')
    expect(body).toContain('<link rel="canonical" href="https://bis.example.com/competitions/nope" />')
  })

  it('tells search engines to skip sign-in, staff and people pages, but not the public ones', async () => {
    for (const url of ['/staff-access', '/admin/competitions', '/login', '/scrutineer/live', '/competitors/x', '/athletes']) {
      expect((await get(url)).headers['x-robots-tag'], url).toBe('noindex, nofollow')
    }
    for (const url of ['/competitions', '/competitions/c1', '/results', '/standings']) {
      expect((await get(url)).headers['x-robots-tag'], url).toBeUndefined()
    }
  })

  it('still serves files and answers JSON 404 for the API', async () => {
    expect((await get('/api/nope')).statusCode).toBe(404)
    expect((await get('/api/health')).statusCode).toBe(200)
  })
})
