import { checkAdvancementRules, type AdvancementRule } from '@bis/shared'
import { eq } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { advancementOf } from './shared.ts'

// How many couples go through each round, by how many entered. The scrutineer edits it; it decides the rounds an event
// gets when they are planned. Events whose rounds exist already keep them.
export const advancement = {
  getAdvancementRules(ctx: Ctx, competitionId: string): AdvancementRule[] {
    found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, String(competitionId))).get(), 'Competition')
    return advancementOf(ctx, competitionId)
  },

  setAdvancementRules(ctx: Ctx, competitionId: string, rules: AdvancementRule[]): void {
    found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, String(competitionId))).get(), 'Competition')
    const checked = checkAdvancementRules(rules)
    if ('error' in checked) return fail(checked.error, checked.status)
    const before = advancementOf(ctx, competitionId)
    ctx.db
      .insert(t.advancementRules)
      .values({ competitionId, rules: JSON.stringify(checked.values) })
      .onConflictDoUpdate({ target: t.advancementRules.competitionId, set: { rules: JSON.stringify(checked.values) } })
      .run()
    record(ctx.db, actor(ctx).id, 'Changed the advancement table', competitionId, { before, after: checked.values })
    ctx.defer(() => ctx.hub.program())
  },
}
