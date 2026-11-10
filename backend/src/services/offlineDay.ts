import type { OfflineDayInfo } from '@bis/shared'
import { asc, eq, isNotNull } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { now } from '../ids.ts'
import type { Access } from '../registry.ts'

// Running a competition on a venue laptop with no internet. The online server hands the competition over (and keeps its
// hands off it) until the laptop's day is loaded back. See docs/operations/OFFLINE_MODE.md.

export const offlineDay = {
  getOfflineDays(ctx: Ctx): OfflineDayInfo {
    const list = ctx.db.select().from(t.competitions).orderBy(asc(t.competitions.date)).all()
    return { venue: ctx.config.venue, competitions: list.map((c) => ({ id: c.id, name: c.name, date: c.date, heldAt: c.offlineHeldAt })) }
  },

  startOfflineDay(ctx: Ctx, competitionId: string): void {
    if (ctx.config.venue) return fail('This is the venue laptop. Start the offline day on the online server.')
    const competition = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, String(competitionId))).get(), 'Competition')
    if (competition.offlineHeldAt) return fail('This competition is already with a venue laptop.', 409)
    ctx.db.update(t.competitions).set({ offlineHeldAt: now() }).where(eq(t.competitions.id, competition.id)).run()
    record(ctx.db, actor(ctx).id, 'Handed the competition to a venue laptop', competition.name)
  },

  // The laptop is lost or not used after all: the competition goes back to being run online, with nothing loaded
  cancelOfflineDay(ctx: Ctx, competitionId: string): void {
    const competition = found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, String(competitionId))).get(), 'Competition')
    if (!competition.offlineHeldAt) return fail('This competition is not with a venue laptop.', 409)
    ctx.db.update(t.competitions).set({ offlineHeldAt: null }).where(eq(t.competitions.id, competition.id)).run()
    record(ctx.db, actor(ctx).id, 'Took the competition back from the venue laptop', competition.name)
  },
}

// What people may still do online while a laptop holds a competition: their own sign-in details and the offline day itself
const STILL_ALLOWED = /^(startOfflineDay|cancelOfflineDay|changeMyStaffPassword|saveMyStaffName|.*Totp.*|.*SecondStep.*)$/
const WORKING_ROLES = ['admin', 'secretariat', 'scrutineer', 'chairperson']

// While a venue laptop runs a competition, the online server must not change what the day replaces: the staff's changes
// and the teams' entry requests are paused, and say why. Reading, and the athletes' own pages, carry on.
export function pauseWhileOffline(ctx: Ctx, name: string, rule: Access): void {
  if (ctx.config.venue || STILL_ALLOWED.test(name)) return
  const staffWrite = Array.isArray(rule) && rule.some((role) => WORKING_ROLES.includes(role))
  if (!staffWrite && name !== 'submitEntryRequest') return
  const held = ctx.db.select({ name: t.competitions.name }).from(t.competitions).where(isNotNull(t.competitions.offlineHeldAt)).get()
  if (held) return fail(`${held.name} is being run on a venue laptop. Changes are paused here until its day is loaded back.`, 409)
}
