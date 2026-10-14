import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from './db/client.ts'
import * as t from './db/schema.ts'

const KEY = 'cookie_secret'

// A random signing key for sign-in cookies, made on the first start and kept in the database. It stays the same after
// a restart, so adjudicators stay signed in if the server is restarted in the middle of a round. Because it lives in
// the database, a backup restored on Laptop 3 carries it too, and nobody is signed out by the takeover.
export function databaseSecret(db: Db): string {
  const saved = db.select().from(t.settings).where(eq(t.settings.key, KEY)).get()
  if (saved && saved.value.length >= 32) return saved.value
  const value = randomBytes(32).toString('hex')
  db.insert(t.settings).values({ key: KEY, value }).onConflictDoUpdate({ target: t.settings.key, set: { value } }).run()
  return value
}
