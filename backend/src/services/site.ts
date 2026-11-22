import { type SiteSettings } from '@bis/shared'
import { record } from '../core/audit.ts'
import { actor, fail, type Ctx } from '../core/context.ts'
import { PHOTO, SITE_IMAGE_PATH, pictureVersion } from './shared.ts'

// What the admin sets for the public home page and the sign-in pages. It lives in the settings table, so a backup carries it.
const HERO_KEY = 'hero_image'
const SIGN_IN_KEY = 'sign_in_image'
const MAX_HERO = 1_500_000

const read = (ctx: Ctx, key: string): string | null => (ctx.sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined)?.value ?? null

const urlOf = (which: string, data: string | null) => (data ? `${SITE_IMAGE_PATH}${which}?v=${pictureVersion(data)}` : null)

// The pictures are sent as addresses, not inline, because every public page asks for these settings
const settingsOf = (ctx: Ctx): SiteSettings => ({ heroImage: urlOf('hero', read(ctx, HERO_KEY)), signInImage: urlOf('sign-in', read(ctx, SIGN_IN_KEY)) })

export const SITE_IMAGE_KEYS: Record<string, string> = { hero: HERO_KEY, 'sign-in': SIGN_IN_KEY }
export const readSetting = read

// A picture for one place, or null to go back to the built-in one
function savePicture(ctx: Ctx, key: string, what: string, image: string | null): SiteSettings {
  if (image === null) {
    ctx.sqlite.prepare('DELETE FROM settings WHERE key = ?').run(key)
    record(ctx.db, actor(ctx).id, `Reset the ${what} picture`, 'Home page')
    return settingsOf(ctx)
  }
  if (typeof image !== 'string' || !PHOTO.test(image) || image.length > MAX_HERO) return fail('Send the picture as a JPEG, PNG or WebP image.')
  ctx.sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(key, image)
  record(ctx.db, actor(ctx).id, `Changed the ${what} picture`, 'Home page')
  return settingsOf(ctx)
}

export const site = {
  getSiteSettings: (ctx: Ctx): SiteSettings => settingsOf(ctx),

  saveHeroImage: (ctx: Ctx, image: string | null): SiteSettings => savePicture(ctx, HERO_KEY, 'home page', image),

  saveSignInImage: (ctx: Ctx, image: string | null): SiteSettings => savePicture(ctx, SIGN_IN_KEY, 'sign-in', image),
}
