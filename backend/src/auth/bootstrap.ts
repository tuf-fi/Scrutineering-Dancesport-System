import { Role } from '@bis/shared'
import { eq } from 'drizzle-orm'
import type { Db } from '../db/client.ts'
import * as t from '../db/schema.ts'
import { record } from '../core/audit.ts'
import { newId } from '../ids.ts'
import { hashPassword, temporaryPassword } from './password.ts'

// The first admin of a new database. Everything else is done from the admin screens once this person signs in.
export function createAdmin(db: Db, input: { username: string; name: string; password?: string }): { id: string; username: string; password: string } {
  const username = input.username.trim().toLowerCase()
  const name = input.name.trim()
  if (!username || !name) throw new Error('Give a username and a name.')
  if (db.select().from(t.staffUsers).where(eq(t.staffUsers.username, username)).get()) throw new Error(`The username "${username}" is already taken.`)
  const password = input.password ?? temporaryPassword()
  if (password.length < 8) throw new Error('Use a password of at least 8 characters.')
  const id = newId()
  db.insert(t.staffUsers).values({ id, name, username, role: Role.Admin, passwordHash: hashPassword(password), disabled: false }).run()
  record(db, id, 'Created the first admin', name)
  return { id, username, password }
}
