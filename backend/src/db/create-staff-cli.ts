import { Role, samplePhoto } from '@bis/shared'
import { eq } from 'drizzle-orm'
import { hashPassword, temporaryPassword } from '../auth/password.ts'
import { record } from '../core/audit.ts'
import { loadConfig } from '../config.ts'
import { newId } from '../ids.ts'
import { openDatabase } from './client.ts'
import { runMigrations } from './migrate.ts'
import * as t from './schema.ts'

// pnpm --filter @bis/backend staff:create [domain]
// One account for each staff role, signing in as <role>@<domain>. A role that already has that email is left alone.
const domain = (process.argv[2] ?? 'boss2026.com').trim().toLowerCase()
const ROLES = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Compere, Role.Barker]

const config = loadConfig()
const { db, sqlite } = openDatabase(config.databasePath)
runMigrations(db)
for (const role of ROLES) {
  const username = `${role}@${domain}`
  if (db.select().from(t.staffUsers).where(eq(t.staffUsers.username, username)).get()) {
    console.log(`${username}: already exists, left alone`)
    continue
  }
  const name = role[0]!.toUpperCase() + role.slice(1)
  const password = temporaryPassword()
  const id = newId()
  // The photo is a placeholder: change it, and the name, from Staff accounts
  db.insert(t.staffUsers).values({ id, name, username, role, photo: samplePhoto(name), passwordHash: hashPassword(password), disabled: false }).run()
  record(db, id, 'Created a staff account', `${name} (${username})`)
  console.log(`${username}: ${password}`)
}
sqlite.close()
