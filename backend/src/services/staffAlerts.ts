import type { AthleteNotification, Role } from '@bis/shared'
import { desc, eq, lt } from 'drizzle-orm'
import { actor, type Ctx } from '../core/context.ts'
import type { Db } from '../db/client.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'

const KEPT = 100

// Keeps an alert for the roles it is for; a screen that was closed when it was sent can still read it
export function keepAlert(db: Db, roles: Role[], note: { title: string; detail: string; link: string | null }) {
  db.insert(t.staffAlerts).values({ id: newId(), roles, title: note.title, detail: note.detail, link: note.link, createdAt: now() }).run()
  // A month is long enough to look back
  db.delete(t.staffAlerts).where(lt(t.staffAlerts.createdAt, new Date(Date.now() - 30 * 86_400_000).toISOString())).run()
}

// The alerts for the caller's role, newest first, each with when the caller read it
export function staffNotifications(ctx: Ctx): AthleteNotification[] {
  const me = actor(ctx)
  const reads = new Map(ctx.db.select().from(t.staffAlertReads).where(eq(t.staffAlertReads.userId, me.id)).all().map((r) => [r.alertId, r.readAt]))
  return ctx.db
    .select()
    .from(t.staffAlerts)
    .orderBy(desc(t.staffAlerts.createdAt))
    .limit(KEPT * 4)
    .all()
    .filter((a) => a.roles.includes(me.role))
    .slice(0, KEPT)
    .map((a) => ({ id: a.id, kind: 'alert' as const, title: a.title, detail: a.detail, link: a.link, createdAt: a.createdAt, readAt: reads.get(a.id) ?? null }))
}

// Marks the given alerts as read by the caller, or every unread one when none are given
export function markStaffNotificationsRead(ctx: Ctx, ids?: string[]) {
  const me = actor(ctx)
  const unread = staffNotifications(ctx).filter((n) => n.readAt === null)
  const wanted = Array.isArray(ids) && ids.length > 0 ? new Set(ids.map(String)) : null
  for (const n of unread) {
    if (wanted && !wanted.has(n.id)) continue
    ctx.db.insert(t.staffAlertReads).values({ alertId: n.id, userId: me.id, readAt: now() }).onConflictDoNothing().run()
  }
}
