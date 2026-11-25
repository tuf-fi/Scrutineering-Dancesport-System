import { sampleFees } from '@bis/shared'
import { eq, isNull } from 'drizzle-orm'
import type { Db } from './client.ts'
import * as t from './schema.ts'

type EventRow = typeof t.events.$inferSelect

// For sample and test data: gives the events that have no fee the sample one. Sample data must pass `only`, so that it
// never prices an event someone else made; tests price everything they created.
export function priceSampleEvents(db: Pick<Db, 'select' | 'insert' | 'update'>, only: (event: EventRow) => boolean = () => true) {
  const events = db.select().from(t.events).where(isNull(t.events.feeId)).all().filter(only)
  for (const competitionId of new Set(events.map((e) => e.competitionId))) {
    const { fees, feeIds } = sampleFees(competitionId, events.filter((e) => e.competitionId === competitionId))
    fees.forEach((fee, i) => db.insert(t.competitionFees).values({ ...fee, sortOrder: i + 1 }).onConflictDoNothing().run())
    for (const [eventId, feeId] of feeIds) db.update(t.events).set({ feeId }).where(eq(t.events.id, eventId)).run()
  }
}
