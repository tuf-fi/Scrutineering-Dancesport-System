import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

// A random signing key kept next to the database, made on the first start. It stays the same after a restart,
// so adjudicators stay signed in if the server is restarted in the middle of a round.
export function persistedSecret(databasePath: string): string {
  const file = join(dirname(databasePath), 'cookie-secret')
  if (existsSync(file)) {
    const saved = readFileSync(file, 'utf8').trim()
    if (saved.length >= 32) return saved
  }
  mkdirSync(dirname(file), { recursive: true })
  const secret = randomBytes(32).toString('hex')
  writeFileSync(file, secret, { mode: 0o600 })
  return secret
}
