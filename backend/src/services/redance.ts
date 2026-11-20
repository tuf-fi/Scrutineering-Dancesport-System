import { Role, type Dance, type MarkSubmission, type Redance } from '@bis/shared'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { record } from '../core/audit.ts'
import { actor, fail, type Ctx } from '../core/context.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { submissionSnapshot } from './rounds.ts'
import { MAX_SIGNATURE, PNG_PREFIX, clean, getEventRow, getRoundRow, heatsOfRound, openRedance, roundAdjudicatorIds, toRedance } from './shared.ts'

// A redance: one heat of a round is danced again because adjudicators asked. Marks are one sheet per adjudicator for the
// whole round, so the heat's marks are cleared for everyone who had submitted, and each re-marks just that heat with the
// same number of X per dance as before (the other heats are unchanged, so the round's total still comes out right).
// The final is one heat: everyone who had placed the finalists places them all again.

const PENDING = 'A redance is waiting for its marks.'

export const redance = {
  getRedances: (ctx: Ctx, roundId: string): Redance[] =>
    ctx.db.select().from(t.redances).where(eq(t.redances.roundId, roundId)).orderBy(asc(t.redances.seq)).all().map(toRedance),

  startRedance(ctx: Ctx, roundId: string, heat: number, reason: string): Redance {
    const round = getRoundRow(ctx, roundId)
    if (round.status !== 'marking' && round.status !== 'review') return fail('A heat can be redanced while the round is being marked.', 409)
    const why = clean(reason)
    if (why.length < 3 || why.length > 200) return fail('Give the reason in a few words.')
    if (openRedance(ctx, roundId)) return fail(`${PENDING} Finish it before starting another.`, 409)
    const target = heatsOfRound(ctx, roundId).find((h) => h.number === Number(heat))
    if (!target) return fail('That heat does not exist.', 404)

    const event = getEventRow(ctx, round.eventId)
    const members = new Set(target.competitorIds)
    const submitted = ctx.db.select().from(t.submissions).where(eq(t.submissions.roundId, roundId)).all()
    const marks = ctx.db.select().from(t.marks).where(eq(t.marks.roundId, roundId)).all()

    // Who must re-mark, and how many X in each dance: what they gave this heat before
    const required: Record<string, Record<string, number>> = {}
    const cleared: Array<typeof t.marks.$inferSelect> = []
    for (const s of submitted) {
      const own = marks.filter((m) => m.adjudicatorId === s.adjudicatorId && members.has(m.competitorId))
      if (own.length === 0) continue
      required[s.adjudicatorId] = Object.fromEntries(event.dances.map((d) => [d, own.filter((m) => m.dance === d).length]))
      cleared.push(...own)
    }

    const last = ctx.db.select({ seq: t.redances.seq }).from(t.redances).where(eq(t.redances.roundId, roundId)).orderBy(asc(t.redances.seq)).all().at(-1)?.seq ?? 0
    // When nobody had marked the heat yet there is nothing to re-mark: it is only called to the floor again
    const row = { id: newId(), roundId, seq: last + 1, heat: target.number, reason: why, startedBy: actor(ctx).id, startedAt: now(), doneAt: Object.keys(required).length === 0 ? now() : null, required, redone: [] as string[] }

    ctx.db.transaction(() => {
      // What is cleared stays in the audit log
      record(ctx.db, actor(ctx).id, 'Started a redance', `Event ${event.number}, heat ${target.number}`, {
        before: { marks: cleared.map((m) => ({ adjudicatorId: m.adjudicatorId, competitorId: m.competitorId, dance: m.dance, placing: m.placing, signedAt: m.submittedAt })) },
        after: { roundId, heat: target.number, reason: why, mustRemark: Object.keys(required) },
      })
      if (cleared.length > 0) ctx.db.delete(t.marks).where(inArray(t.marks.id, cleared.map((m) => m.id))).run()
      const owing = Object.keys(required)
      if (owing.length > 0) ctx.db.delete(t.submissions).where(and(eq(t.submissions.roundId, roundId), inArray(t.submissions.adjudicatorId, owing))).run()
      // Any tie decision was made on marks that are gone
      ctx.db.delete(t.tieDecisions).where(eq(t.tieDecisions.roundId, roundId)).run()
      ctx.db.delete(t.finalTieDecisions).where(eq(t.finalTieDecisions.roundId, roundId)).run()
      ctx.db.update(t.rounds).set({ status: 'marking' }).where(eq(t.rounds.id, roundId)).run()
      ctx.db.insert(t.redances).values(row).run()
    })

    ctx.defer(() => {
      ctx.hub.submissions(roundId, submissionSnapshot(ctx, roundId))
      ctx.hub.floor(roundId)
      ctx.hub.alert([Role.Scrutineer, Role.Chairperson], {
        title: `Redance: heat ${target.number}`,
        detail: `E${event.number} · ${why}`,
        link: '/scrutineer/live',
      })
    })
    return toRedance(row)
  },

  // An adjudicator's marks for the redanced heat only
  submitRedanceMarks(ctx: Ctx, roundId: string, submissions: MarkSubmission[], signature?: string | null): void {
    storeRedance(ctx, actor(ctx).id, roundId, submissions, null, signature ?? null)
  },

  // The scrutineer types them in from a paper sheet
  enterRedanceMarks(ctx: Ctx, adjudicatorId: string, roundId: string, submissions: MarkSubmission[]): void {
    storeRedance(ctx, adjudicatorId, roundId, submissions, actor(ctx).id, null)
  },
}

function storeRedance(ctx: Ctx, adjudicatorId: string, roundId: string, submissions: MarkSubmission[], enteredBy: string | null, signature: string | null) {
  if (signature !== null && (typeof signature !== 'string' || !signature.startsWith(PNG_PREFIX) || signature.length > MAX_SIGNATURE)) {
    return fail('The signature could not be read. Sign again.')
  }
  const round = getRoundRow(ctx, roundId)
  const event = getEventRow(ctx, round.eventId)
  if (!roundAdjudicatorIds(ctx, round).includes(adjudicatorId)) return fail('This adjudicator is not marking this round.', 403)
  const open = openRedance(ctx, roundId)
  const mine = open?.required[adjudicatorId]
  if (!open || !mine) return fail('There is no redance waiting for these marks.', 409)

  const members = new Set(heatsOfRound(ctx, roundId).find((h) => h.number === open.heat)?.competitorIds ?? [])
  const list = Array.isArray(submissions) ? submissions : []
  const dances = new Set(list.map((s) => s.dance))
  if (list.length !== event.dances.length || dances.size !== list.length || event.dances.some((d) => !dances.has(d))) return fail('Mark every dance before submitting.')
  for (const s of list) {
    const ids = Array.isArray(s.competitorIds) ? s.competitorIds : []
    if (new Set(ids).size !== ids.length || ids.some((id) => !members.has(id))) return fail(`Mark each competitor once, and only those in heat ${open.heat}.`)
    if (ids.length !== (mine[s.dance] ?? 0)) {
      return fail(round.recallNumber === null ? 'Place every finalist.' : `Mark exactly ${mine[s.dance] ?? 0} in heat ${open.heat} for each dance, as before.`)
    }
  }
  // In the final the order is the placing; otherwise an X per competitor
  const incoming = list.flatMap((s) => s.competitorIds.map((id, i): [string, string, number] => [s.dance, id, round.recallNumber === null ? i + 1 : 0]))

  if (open.redone.includes(adjudicatorId)) {
    const stored = ctx.db.select().from(t.marks).where(and(eq(t.marks.roundId, roundId), eq(t.marks.adjudicatorId, adjudicatorId))).all().filter((m) => members.has(m.competitorId))
    const same = stored.length === incoming.length && incoming.every(([d, c, p]) => stored.some((m) => m.dance === d && m.competitorId === c && (m.placing ?? 0) === p))
    return same ? undefined : fail('You have already marked this redance.', 409)
  }

  const at = now()
  const redone = [...open.redone, adjudicatorId]
  const finished = Object.keys(open.required).every((id) => redone.includes(id))
  ctx.db.transaction(() => {
    for (const [dance, competitorId, placing] of incoming) {
      ctx.db
        .insert(t.marks)
        .values({ id: newId(), roundId, adjudicatorId, competitorId, dance: dance as Dance, kind: round.recallNumber === null ? 'placing' : 'x', placing: round.recallNumber === null ? placing : null, submittedAt: at })
        .run()
    }
    ctx.db.insert(t.submissions).values({ roundId, adjudicatorId, submittedAt: at, enteredBy, signature }).run()
    ctx.db.update(t.redances).set({ redone, doneAt: finished ? at : null }).where(eq(t.redances.id, open.id)).run()
    ctx.db.delete(t.tieDecisions).where(eq(t.tieDecisions.roundId, roundId)).run()
    ctx.db.delete(t.finalTieDecisions).where(eq(t.finalTieDecisions.roundId, roundId)).run()
    record(ctx.db, enteredBy ?? adjudicatorId, enteredBy ? 'Entered redance marks from paper' : 'Submitted redance marks', roundId, { after: { adjudicatorId, heat: open.heat, marks: incoming.length } })
    const panel = roundAdjudicatorIds(ctx, round)
    const submitted = ctx.db.select().from(t.submissions).where(eq(t.submissions.roundId, roundId)).all().length
    if (finished && submitted >= panel.length && round.status === 'marking') ctx.db.update(t.rounds).set({ status: 'review' }).where(eq(t.rounds.id, roundId)).run()
  })

  ctx.defer(() => {
    ctx.hub.submissions(roundId, submissionSnapshot(ctx, roundId))
    ctx.hub.floor(roundId)
    if (finished) {
      ctx.hub.alert([Role.Scrutineer, Role.Chairperson], { title: 'Redance marked', detail: `E${event.number} · heat ${open.heat} has been re-marked`, link: '/scrutineer/live' })
    }
  })
}

