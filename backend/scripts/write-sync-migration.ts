// Rewrites the change-capture triggers migrations from the current schema. Run after any change to a synced table:
//   pnpm --filter @bis/backend db:sync-migration
import { readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { captureMigrationSql, programCaptureMigrationSql } from '../src/sync/triggers.ts'

const dir = join(import.meta.dirname, '..', 'drizzle')

function write(name: string, sql: string) {
  const file = readdirSync(dir).find((f) => f.endsWith(`_${name}.sql`))
  if (!file) throw new Error(`No *_${name}.sql migration found. Create one with: drizzle-kit generate --custom --name=${name}`)
  writeFileSync(join(dir, file), sql)
  console.log(`Wrote ${file}`)
}

write('sync_capture', captureMigrationSql())
write('sync_program', programCaptureMigrationSql())
