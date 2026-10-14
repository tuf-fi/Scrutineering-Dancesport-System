import { auditLog } from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import type { Db } from '../db/client.ts'

// A database or a transaction; both can write the log
type Writer = Pick<Db, 'insert'>

// Every change is written here with who did it. Call it inside the same transaction as the change,
// so the log and the data can never disagree.
export function record(
  db: Writer,
  actorId: string,
  action: string,
  target: string,
  change: { before?: unknown; after?: unknown } = {},
) {
  db.insert(auditLog)
    .values({
      id: newId(),
      actorId,
      action,
      target,
      before: change.before ?? null,
      after: change.after ?? null,
      at: now(),
    })
    .run()
}
