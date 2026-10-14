import type { CloudCompetition, PullSummary, SyncStatus } from '@bis/shared'
import { eq } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { SyncError, type SyncService } from '../sync/venue.ts'

const nothing: SyncStatus = {
  enabled: false,
  venueId: '',
  cloudUrl: null,
  pending: 0,
  failing: 0,
  lastUploadAt: null,
  lastError: null,
  reachable: null,
  held: [],
}

function service(ctx: Ctx): SyncService {
  if (!ctx.sync?.enabled) return fail('This laptop is not set up to talk to the cloud. See VENUE.md.', 409)
  return ctx.sync
}

// What went wrong with the cloud, in words for the screen. A refusal by the cloud is never passed on as "sign in again".
async function viaCloud<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  } catch (error) {
    if (!(error instanceof SyncError)) throw error
    if (error.status === 0) return fail(error.message, 503)
    if (error.status === 401 || error.status === 403) return fail('The cloud did not accept this laptop. Check its sync token.', 502)
    return fail(error.message, error.status === 404 ? 409 : error.status)
  }
}

export const syncFunctions = {
  getSyncStatus: (ctx: Ctx): SyncStatus => ctx.sync?.status() ?? { ...nothing, venueId: ctx.config.venueId },

  getCloudCompetitions: (ctx: Ctx): Promise<CloudCompetition[]> => viaCloud(() => service(ctx).cloudCompetitions()),

  // Downloads a competition from the cloud to run it here
  async pullCompetition(ctx: Ctx, competitionId: string): Promise<PullSummary> {
    const user = actor(ctx)
    if (typeof competitionId !== 'string' || competitionId === '') return fail('Choose a competition.')
    const summary = await viaCloud(() => service(ctx).pull(competitionId))
    record(ctx.db, user.id, 'Downloaded a competition from the cloud', competitionId, { after: summary })
    return summary
  },

  // Sends what is waiting to the cloud now, instead of at the next check
  async syncNow(ctx: Ctx): Promise<SyncStatus> {
    actor(ctx)
    return viaCloud(() => service(ctx).uploadNow())
  },

  // Queues everything of a competition again and sends it, for when changes were not being captured
  async uploadCompetition(ctx: Ctx, competitionId: string): Promise<SyncStatus> {
    const user = actor(ctx)
    const sync = service(ctx)
    const queued = sync.queueAll(String(competitionId))
    record(ctx.db, user.id, 'Queued a whole competition for upload', String(competitionId), { after: { queued } })
    return viaCloud(() => sync.uploadNow())
  },

  // Finished with a competition: it can change online again
  async releaseCompetition(ctx: Ctx, competitionId: string): Promise<void> {
    const user = actor(ctx)
    await viaCloud(() => service(ctx).release(String(competitionId)))
    record(ctx.db, user.id, 'Released a competition to the cloud', String(competitionId))
  },

  // Online only. The venue that holds a competition is gone and will not come back: let entries change online again.
  unlockCompetition(ctx: Ctx, competitionId: string): void {
    const user = actor(ctx)
    const competition = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, String(competitionId))).get(), 'Competition')
    if (!competition.heldBy) return fail('Nobody is running this competition.', 409)
    ctx.db.update(t.competitions).set({ heldBy: null, heldAt: null }).where(eq(t.competitions.id, competition.id)).run()
    record(ctx.db, user.id, 'Took a competition back from a venue', competition.name, { before: { heldBy: competition.heldBy } })
  },
}
