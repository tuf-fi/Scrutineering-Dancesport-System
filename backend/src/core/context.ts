import type { SessionUser } from '@bis/shared'
import type { Config } from '../config.ts'
import type { Db, Sqlite } from '../db/client.ts'
import type { Backups } from '../backup.ts'
import type { Hub } from '../realtime/hub.ts'
import type { SyncService } from '../sync/venue.ts'

// A request the API turns into a message for the user; the status is the HTTP status it is sent with
export class HttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export const fail = (message: string, status = 400): never => {
  throw new HttpError(status, message)
}

export function found<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) return fail(`${what} not found`, 404)
  return value
}

// What every service gets: the database, who is calling and how to tell the other screens
export interface Ctx {
  db: Db
  sqlite: Sqlite
  hub: Hub
  backups: Backups
  // Venue only: talks to the cloud; null online
  sync: SyncService | null
  config: Config
  user: SessionUser | null
  // Runs after the request's transaction has committed: tell screens, start a backup
  defer: (task: () => void) => void
  // Set by the app: copies the database to the backup folders
  afterApproval?: () => void
}

export function actor(ctx: Ctx): SessionUser {
  return ctx.user ?? fail('Sign in first.', 401)
}
