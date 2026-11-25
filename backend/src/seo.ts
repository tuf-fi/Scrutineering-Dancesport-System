import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { readFileSync } from 'node:fs'
import type { Sqlite } from './db/client.ts'

const NAME = 'Bicol Oragon Scrutineering System'

// Screens behind a sign-in, the staff tools, and the pages about people: kept out of search
export const PRIVATE_PREFIXES = [
  '/admin', '/secretariat', '/scrutineer', '/compere', '/mc', '/barker', '/print', '/notifications', '/account',
  '/adjudicator', '/athlete', '/coach', '/team', '/staff-access', '/login', '/sign-in', '/forgot-password',
  '/reset-password', '/verify-email', '/dev', '/athletes', '/competitors',
]

const PUBLIC_PAGES = ['/', '/competitions', '/results', '/standings', '/privacy']

const underPrefix = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
export const isPrivate = (path: string) => PRIVATE_PREFIXES.some((p) => underPrefix(path, p))

const escapeHtml = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeXml = (text: string) => escapeHtml(text).replace(/'/g, '&apos;')

export function robotsTxt(origin: string): string {
  return [
    'User-agent: *',
    'Allow: /api/competition-image/',
    'Allow: /api/site-image/',
    'Disallow: /api/',
    ...PRIVATE_PREFIXES.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n')
}

export function sitemapXml(origin: string, competitions: Array<{ id: string; date: string }>): string {
  const url = (path: string, lastmod?: string) => `  <url><loc>${escapeXml(origin + path)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod)}</lastmod>` : ''}</url>`
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PUBLIC_PAGES.map((p) => url(p)),
    ...competitions.map((c) => url(`/competitions/${c.id}`, c.date)),
    '</urlset>',
    '',
  ].join('\n')
}

interface PageMeta {
  title?: string
  description?: string
  image?: string
  url: string
}

// The page is one file for every address; crawlers and link previews read only this file, so the tags are set here per address
export function pageHtml(html: string, origin: string, meta: PageMeta): string {
  const set = (source: string, pattern: RegExp, tag: (value: string) => string, value: string | undefined) =>
    value === undefined ? source : source.replace(pattern, () => tag(escapeHtml(value)))
  let out = html.replaceAll('__ORIGIN__', origin)
  out = set(out, /<title>[^<]*<\/title>/, (v) => `<title>${v}</title>`, meta.title)
  out = set(out, /<meta name="description" content="[^"]*" ?\/?>/, (v) => `<meta name="description" content="${v}" />`, meta.description)
  out = set(out, /<meta property="og:title" content="[^"]*" ?\/?>/, (v) => `<meta property="og:title" content="${v}" />`, meta.title)
  out = set(out, /<meta property="og:description" content="[^"]*" ?\/?>/, (v) => `<meta property="og:description" content="${v}" />`, meta.description)
  out = set(out, /<meta property="og:image" content="[^"]*" ?\/?>/, (v) => `<meta property="og:image" content="${v}" />`, meta.image)
  out = set(out, /<meta property="og:url" content="[^"]*" ?\/?>/, (v) => `<meta property="og:url" content="${v}" />`, meta.url)
  out = set(out, /<link rel="canonical" href="[^"]*" ?\/?>/, (v) => `<link rel="canonical" href="${v}" />`, meta.url)
  return out
}

const longDate = (iso: string) => {
  const date = new Date(`${iso}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

// A competition's page, its program and its results share the competition's name and card photo
const COMPETITION_PATH = /^\/(?:competitions|results|live)\/([^/]+)(?:\/(program|events\/[^/]+))?$/

export function registerSeo(app: FastifyInstance, { sqlite, origin, indexPath }: { sqlite: Sqlite; origin: string; indexPath: string | null }) {
  app.get('/robots.txt', async (_request, reply) => reply.header('content-type', 'text/plain; charset=utf-8').header('cache-control', 'public, max-age=3600').send(robotsTxt(origin)))

  app.get('/sitemap.xml', async (_request, reply) => {
    const rows = sqlite.prepare('SELECT id, date FROM competitions ORDER BY date DESC').all() as Array<{ id: string; date: string }>
    return reply.header('content-type', 'application/xml; charset=utf-8').header('cache-control', 'public, max-age=3600').send(sitemapXml(origin, rows))
  })

  if (!indexPath) return null
  const template = readFileSync(indexPath, 'utf8')

  return (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0]!.replace(/\/+$/, '') || '/'
    let meta: PageMeta = { url: origin + (path === '/' ? '/' : path) }
    const match = COMPETITION_PATH.exec(path)
    if (match) {
      const row = sqlite.prepare('SELECT name, date, venue FROM competitions WHERE id = ?').get(match[1]) as { name: string; date: string; venue: string } | undefined
      if (row) {
        meta = {
          title: `${row.name} | ${NAME}`,
          description: `${row.name}, ${longDate(row.date)} at ${row.venue}. Events, program and results.`,
          image: `${origin}/api/competition-image/${match[1]}`,
          url: `${origin}/competitions/${match[1]}`,
        }
      }
    }
    if (isPrivate(path)) reply.header('x-robots-tag', 'noindex, nofollow')
    return reply.header('content-type', 'text/html; charset=utf-8').header('cache-control', 'no-cache').send(pageHtml(template, origin, meta))
  }
}
