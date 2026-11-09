import { DEFAULT_FEE_SCHEDULE, Role, type TeamMembershipInput, type TeamMembershipPage } from '@bis/shared'
import { eq, inArray } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { now } from '../ids.ts'
import { readPaymentSettings } from '../paymentSettings.ts'
import { requireVerified } from './emailLinks.ts'
import { MAX_RECEIPT, PHOTO, clean } from './shared.ts'

const year = () => new Date().getFullYear()

// The team this account is linked to; a team that is not linked has no athletes to pay for
function linkedTeam(ctx: Ctx) {
  const account = found(ctx.db.select().from(t.memberAccounts).where(eq(t.memberAccounts.id, actor(ctx).id)).get(), 'Account')
  const team = account.linkedId ? ctx.db.select().from(t.teams).where(eq(t.teams.id, account.linkedId)).get() : undefined
  if (!team) return fail('Your account is not linked to a team yet.', 409)
  return team
}

const statusOf = (a: typeof t.athletes.$inferSelect, now: number): TeamMembershipPage['athletes'][number]['status'] =>
  a.memberYear === now ? 'paid' : a.request ? (a.request.rejectedReason ? 'rejected' : 'waiting') : 'unpaid'

// The team's athletes, who is paid up, and where to send the money
export function getTeamMembership(ctx: Ctx): TeamMembershipPage {
  const team = linkedTeam(ctx)
  const settings = readPaymentSettings(ctx.sqlite)
  const current = year()
  const athletes = ctx.db
    .select()
    .from(t.athletes)
    .where(eq(t.athletes.teamId, team.id))
    .all()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((a) => ({ id: a.id, name: a.name, membershipId: a.membershipId ?? null, status: statusOf(a, current), reason: a.request?.rejectedReason ?? null }))
  return { year: current, fee: (settings.schedule ?? DEFAULT_FEE_SCHEDULE).athleteMembership, methods: settings.methods, athletes }
}

// The team says it paid for these athletes; the secretariat checks the screenshot against the money received
export function requestTeamMembership(ctx: Ctx, input: TeamMembershipInput): void {
  requireVerified(ctx)
  const team = linkedTeam(ctx)
  const current = year()
  const ids = Array.isArray(input?.athleteIds) ? [...new Set(input.athleteIds.map(String))] : []
  if (ids.length === 0) return fail('Choose the athletes you are paying for.')
  const method = clean(input.method)
  const receipt = typeof input.receipt === 'string' ? input.receipt : ''
  if (!method || method.length > 40) return fail('Say how you paid.')
  if (!receipt) return fail('Send a screenshot of your payment.')
  if (!PHOTO.test(receipt) || receipt.length > MAX_RECEIPT) return fail('Send the screenshot as a JPEG, PNG or WebP picture.')

  const rows = ctx.db.select().from(t.athletes).where(inArray(t.athletes.id, ids)).all()
  if (rows.length !== ids.length || rows.some((a) => a.teamId !== team.id)) return fail('You can only pay for your own athletes.', 403)
  for (const a of rows) {
    if (a.memberYear === current) return fail(`${a.name} is already a member for ${current}.`, 409)
    if (a.request && !a.request.rejectedReason) return fail(`A payment for ${a.name} is already waiting for the secretariat.`, 409)
  }

  const at = now()
  for (const a of rows) {
    const request = { year: current, method, receipt, requestedAt: at, paidBy: team.name }
    const membershipHistory = [...(a.membershipHistory ?? []), { at, kind: 'sent' as const, year: current, method }]
    ctx.db.update(t.athletes).set({ request, membershipHistory }).where(eq(t.athletes.id, a.id)).run()
  }
  record(ctx.db, actor(ctx).id, 'Sent a membership payment for athletes', team.name, { after: { year: current, method, athletes: rows.map((a) => a.name) } })
  ctx.defer(() =>
    ctx.hub.alert([Role.Secretariat, Role.Admin], { title: 'Membership payment sent', detail: `${team.name} · ${rows.length} athlete${rows.length === 1 ? '' : 's'} by ${method}`, link: '/secretariat/athletes' }),
  )
}
