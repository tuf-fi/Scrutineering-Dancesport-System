// Rewrites the change-capture triggers migration from the current schema. Run after any change to a synced table:
//   pnpm --filter @bis/backend db:sync-migration
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { captureMigrationSql } from '../src/sync/triggers.ts'

const dir = join(import.meta.dirname, '..', 'drizzle')
const file = readdirSync(dir).find((f) => /^\d{4}_sync_capture\.sql$/.test(f))
if (!file) throw new Error('No *_sync_capture.sql migration found. Create one with: drizzle-kit generate --custom --name=sync_capture')
writeFileSync(join(dir, file), captureMigrationSql())
console.log(`Wrote ${file}`)
