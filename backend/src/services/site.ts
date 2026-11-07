import { type SiteSettings } from '@bis/shared'
import { record } from '../core/audit.ts'
import { actor, fail, type Ctx } from '../core/context.ts'
import { PHOTO } from './shared.ts'

// What the admin sets for the public home page. It lives in the settings table, so a backup carries it.
const HERO_KEY = 'hero_image'
const MAX_HERO = 1_500_000

const readHero = (ctx: Ctx): string | null => (ctx.sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(HERO_KEY) as { value: string } | undefined)?.value ?? null

export const site = {
  getSiteSettings: (ctx: Ctx): SiteSettings => ({ heroImage: readHero(ctx) }),

  // A picture for the home page's hero, or null to go back to the built-in one
  saveHeroImage(ctx: Ctx, image: string | null): SiteSettings {
    if (image === null) {
      ctx.sqlite.prepare('DELETE FROM settings WHERE key = ?').run(HERO_KEY)
      record(ctx.db, actor(ctx).id, 'Reset the home page picture', 'Home page')
      return { heroImage: null }
    }
    if (typeof image !== 'string' || !PHOTO.test(image) || image.length > MAX_HERO) return fail('Send the picture as a JPEG, PNG or WebP image.')
    ctx.sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(HERO_KEY, image)
    record(ctx.db, actor(ctx).id, 'Changed the home page picture', 'Home page')
    return { heroImage: image }
  },
}
