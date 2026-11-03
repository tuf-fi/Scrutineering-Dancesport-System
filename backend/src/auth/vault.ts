import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { eq, isNotNull } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import * as t from '../db/schema.ts'

// Secrets the server must read back (an authenticator app's secret) cannot be hashed, so they are encrypted with
// AES-256-GCM. The key comes from DATA_KEY, which lives in the server's environment and never in the database or its backups.

const PREFIX = 'enc1:'

const keyFrom = (dataKey: string) => Buffer.from(hkdfSync('sha256', dataKey, 'bis', 'bis data vault v1', 32))

export function encryptSecret(plain: string, dataKey: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyFrom(dataKey), iv)
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `${PREFIX}${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${body.toString('base64')}`
}

// A value without the prefix is one saved before encryption was added; it is read as it is and encrypted at the next start.
// Returns null for a value that cannot be opened (a different key, or tampered with), which reads as "wrong code".
export function decryptSecret(stored: string, dataKey: string): string | null {
  if (!stored.startsWith(PREFIX)) return stored
  const [iv, tag, body] = stored.slice(PREFIX.length).split(':')
  if (!iv || !tag || !body) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFrom(dataKey), Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

// Encrypts the secrets saved before encryption existed; returns how many it changed
export function encryptLegacySecrets(db: Db, dataKey: string): number {
  const rows = db.select({ id: t.staffUsers.id, totpSecret: t.staffUsers.totpSecret }).from(t.staffUsers).where(isNotNull(t.staffUsers.totpSecret)).all()
  let changed = 0
  for (const row of rows) {
    if (!row.totpSecret || row.totpSecret.startsWith(PREFIX)) continue
    db.update(t.staffUsers).set({ totpSecret: encryptSecret(row.totpSecret, dataKey) }).where(eq(t.staffUsers.id, row.id)).run()
    changed++
  }
  return changed
}
