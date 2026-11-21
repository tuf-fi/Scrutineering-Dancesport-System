import { MAX_CERTIFICATE_BACKGROUND, cleanCertificateLayout, type CertificateLayout } from '@bis/shared'
import { record } from '../core/audit.ts'
import { actor, fail, type Ctx } from '../core/context.ts'
import { PHOTO } from './shared.ts'

// One layout for every certificate. It lives in the settings table, so a backup carries it.
const KEY = 'certificate_layout'

function read(ctx: Ctx): CertificateLayout {
  const row = ctx.sqlite.prepare('SELECT value FROM settings WHERE key = ?').get(KEY) as { value: string } | undefined
  try {
    return cleanCertificateLayout(row ? JSON.parse(row.value) : null)
  } catch {
    return cleanCertificateLayout(null)
  }
}

export const certificate = {
  getCertificateLayout: (ctx: Ctx): CertificateLayout => read(ctx),

  // null goes back to the built-in layout
  saveCertificateLayout(ctx: Ctx, layout: CertificateLayout | null): CertificateLayout {
    if (layout === null) {
      ctx.sqlite.prepare('DELETE FROM settings WHERE key = ?').run(KEY)
      record(ctx.db, actor(ctx).id, 'Reset the certificate layout', 'Certificates')
      return read(ctx)
    }
    const clean = cleanCertificateLayout(layout)
    if (clean.background && (!PHOTO.test(clean.background) || clean.background.length > MAX_CERTIFICATE_BACKGROUND)) {
      return fail('Send the background as a JPEG, PNG or WebP picture under 1.5 MB.')
    }
    ctx.sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(KEY, JSON.stringify(clean))
    record(ctx.db, actor(ctx).id, 'Changed the certificate layout', 'Certificates')
    return clean
  },
}
