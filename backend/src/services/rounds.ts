import {
  SubmissionStatus,
  type AdjudicatorState,
  type AdjudicatorSubmission,
  type HeatAssignment,
  type MarkSubmission,
  type MarkingTask,
  type RoundRow,
} from '@bis/shared'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import { record } from '../core/audit.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { QUIET_MS } from '../realtime/hub.ts'
import {
  activeEntryRows,
  backNumbers,
  fieldOf,
  getEventRow,
  getRoundRow,
  heatsOfRound,
  panelAdjudicatorIds,
  planFor,
  roundAdvanced,
  roundsOfEvent,
  saveHeats,
  splitIntoHeats,
  toEvent,
  toRound,
  unpaidEntries,
} from './shared.ts'

const competitionRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, id)).get(), 'Competition')

// The first heat a final is danced in: finals are one group
export const groupsFor = (ctx: Ctx, round: { type: string }, ids: string[]) =>
  round.type === 'final' ? [ids] : splitIntoHeats(ctx, ids)

// ---- Planning and the floor ----

export const rounds = {
  // Creates the rounds each event with entries needs, for events that have none yet
  planRounds(ctx: Ctx, competitionId: string): number {
    competitionRow(ctx, competitionId)
    const events = ctx.db.select().from(t.events).where(eq(t.events.competitionId, competitionId)).all()
    let planned = 0
    for (const event of events) {
      if (roundsOfEvent(ctx, event.id).length > 0) continue
      const entered = activeEntryRows(ctx, event.id).length
      if (entered === 0) continue
      planFor(entered).forEach((plan, i) => {
        ctx.db
          .insert(t.rounds)
          .values({ id: newId(), eventId: event.id, type: plan.type, position: i + 1, recallNumber: plan.recall, status: 'pending' })
          .run()
      })
      planned++
    }
    record(ctx.db, actor(ctx).id, 'Planned rounds', `${planned} events`)
    return planned
  },

  getCompetitionRounds(ctx: Ctx, competitionId: string): RoundRow[] {
    const events = ctx.db.select().from(t.events).where(eq(t.events.competitionId, competitionId)).orderBy(asc(t.events.number)).all()
    return events.flatMap((event) => {
      const entryCount = activeEntryRows(ctx, event.id).length
      return roundsOfEvent(ctx, event.id).map<RoundRow>((round) => ({
        roundId: round.id,
        eventId: event.id,
        eventNumber: event.number,
        dances: event.dances,
        ageGroup: event.ageGroup,
        class: event.class,
        discipline: event.discipline,
        type: round.type,
        recallNumber: round.recallNumber,
        status: round.status,
        heatCount: round.type === 'final' ? 0 : heatsOfRound(ctx, round.id).length,
        entryCount,
      }))
    })
  },

  getHeatAssignments(ctx: Ctx, roundId: string): HeatAssignment[] {
    const round = getRoundRow(ctx, roundId)
    const saved = heatsOfRound(ctx, roundId)
    if (saved.length > 0) return saved.flatMap((h) => h.competitorIds.map((competitorId) => ({ competitorId, heat: h.number })))
    const groups = groupsFor(ctx, round, fieldOf(ctx, round))
    return groups.flatMap((ids, i) => ids.map((competitorId) => ({ competitorId, heat: i + 1 })))
  },

  saveHeats(ctx: Ctx, roundId: string, assignments: HeatAssignment[]): void {
    const round = getRoundRow(ctx, roundId)
    if (roundAdvanced(round.status)) return fail('Heats cannot change after the round is approved.', 409)
    const field = new Set(fieldOf(ctx, round))
    if (field.size === 0) return fail('This round has no competitors yet. Approve the previous round first.', 409)
    const list = Array.isArray(assignments) ? assignments : []
    if (list.length !== field.size || list.some((a) => !field.has(a.competitorId)) || new Set(list.map((a) => a.competitorId)).size !== field.size) {
      return fail('Every competitor in the round needs a heat.')
    }
    const numbers = [...new Set(list.map((a) => a.heat))].sort((a, b) => a - b)
    if (numbers.some((n) => !Number.isInteger(n) || n < 1)) return fail('Heat numbers start at 1.')
    // Heats are renumbered from 1 so there are no gaps
    saveHeats(ctx, roundId, numbers.map((n) => list.filter((a) => a.heat === n).map((a) => a.competitorId)))
    record(ctx.db, actor(ctx).id, 'Set heats', roundId, { after: { heats: numbers.length } })
  },

  getCurrentRoundId(ctx: Ctx, competitionId?: string): string {
    actor(ctx)
    const row = competitionId
      ? competitionRow(ctx, competitionId)
      : ctx.db.select().from(t.competitions).where(sql`${t.competitions.floorRoundId} is not null`).get()
    return row?.floorRoundId ?? ''
  },

  // Puts a round on the floor: adjudicators' phones now show it
  startRound(ctx: Ctx, roundId: string): void {
    const round = getRoundRow(ctx, roundId)
    const event = getEventRow(ctx, round.eventId)
    if (round.status !== 'pending') return fail(`This round is already ${round.status}.`, 409)
    if (panelAdjudicatorIds(ctx, event.id).length === 0) return fail('Choose the adjudicators for this event first.', 409)
    const previous = roundsOfEvent(ctx, event.id).find((r) => r.position === round.position - 1)
    if (previous && !roundAdvanced(previous.status)) return fail('Approve the previous round first.', 409)

    const competition = competitionRow(ctx, event.competitionId)
    if (competition.floorRoundId && competition.floorRoundId !== roundId) {
      const onFloor = ctx.db.select().from(t.rounds).where(eq(t.rounds.id, competition.floorRoundId)).get()
      if (onFloor?.status === 'marking') return fail('Finish or clear the round on the floor first.', 409)
    }

    const field = fieldOf(ctx, round)
    if (field.length === 0) return fail('Nobody is entered in this round.', 409)
    const unpaid = unpaidEntries(ctx, event.id)
    if (unpaid > 0) {
      return fail(`${unpaid} ${unpaid === 1 ? 'entry in this event has' : 'entries in this event have'} not been paid. Record the payment or scratch the entry first.`, 409)
    }
    if (round.recallNumber !== null && field.length <= round.recallNumber) {
      return fail(`Only ${field.length} are in this round, so recalling ${round.recallNumber} would recall everyone.`, 409)
    }
    if (heatsOfRound(ctx, roundId).length === 0) saveHeats(ctx, roundId, groupsFor(ctx, round, field))

    ctx.db.update(t.rounds).set({ status: 'marking' }).where(eq(t.rounds.id, roundId)).run()
    ctx.db.update(t.competitions).set({ floorRoundId: roundId }).where(eq(t.competitions.id, competition.id)).run()
    record(ctx.db, actor(ctx).id, 'Started round', `Event ${event.number}, ${round.type}`, { before: { status: round.status }, after: { status: 'marking' } })
    ctx.defer(() => {
      ctx.hub.floor(roundId)
      ctx.hub.submissions(roundId, submissionSnapshot(ctx, roundId))
    })
  },

  // Takes a round off the floor without finishing it, e.g. started by mistake
  clearFloor(ctx: Ctx, competitionId?: string): void {
    const competitions = competitionId
      ? [competitionRow(ctx, competitionId)]
      : ctx.db.select().from(t.competitions).where(sql`${t.competitions.floorRoundId} is not null`).all()
    for (const competition of competitions) {
      if (!competition.floorRoundId) continue
      const round = ctx.db.select().from(t.rounds).where(eq(t.rounds.id, competition.floorRoundId)).get()
      const hasMarks = round ? ctx.db.select().from(t.submissions).where(eq(t.submissions.roundId, round.id)).get() : undefined
      if (round?.status === 'marking' && hasMarks) return fail('Adjudicators have already submitted this round, so it cannot be taken off the floor.', 409)
      if (round?.status === 'marking') ctx.db.update(t.rounds).set({ status: 'pending' }).where(eq(t.rounds.id, round.id)).run()
      ctx.db.update(t.competitions).set({ floorRoundId: null }).where(eq(t.competitions.id, competition.id)).run()
      record(ctx.db, actor(ctx).id, 'Cleared the floor', competition.name, { before: { floorRoundId: competition.floorRoundId } })
    }
    ctx.defer(() => ctx.hub.floor(null))
  },

  // ---- Live board ----

  getSubmissions: (ctx: Ctx, roundId: string): AdjudicatorSubmission[] => submissionSnapshot(ctx, roundId),

  // What there is to mark in a round that has started: used to type in an adjudicator's paper sheet
  getMarkingTask(ctx: Ctx, roundId: string): MarkingTask {
    const round = getRoundRow(ctx, roundId)
    if (round.status === 'pending') return fail('This round has not started.', 409)
    return markingTask(ctx, round)
  },

  // ---- Adjudicator ----

  getAdjudicatorState(ctx: Ctx): AdjudicatorState {
    const user = actor(ctx)
    const competition = ctx.db
      .select()
      .from(t.competitions)
      .innerJoin(t.adjudicatorPins, eq(t.adjudicatorPins.competitionId, t.competitions.id))
      .where(eq(t.adjudicatorPins.adjudicatorId, user.id))
      .all()
      .map((r) => r.competitions)
      .find((c) => c.floorRoundId)
    if (!competition?.floorRoundId) return { status: 'waiting' }
    const round = ctx.db.select().from(t.rounds).where(eq(t.rounds.id, competition.floorRoundId)).get()
    if (!round || round.status === 'pending') return { status: 'waiting' }
    if (!panelAdjudicatorIds(ctx, round.eventId).includes(user.id)) return { status: 'waiting' }
    ctx.hub.seen(user.id)
    const submitted = ctx.db
      .select()
      .from(t.submissions)
      .where(and(eq(t.submissions.roundId, round.id), eq(t.submissions.adjudicatorId, user.id)))
      .get()
    const task = markingTask(ctx, round)
    return submitted ? { status: 'submitted', task } : { status: 'marking', task }
  },

  submitAdjudicatorMarks(ctx: Ctx, roundId: string, submissions: MarkSubmission[]): void {
    storeMarks(ctx, actor(ctx).id, roundId, submissions, null)
  },

  // The scrutineer types in an adjudicator's marks from a paper sheet
  enterAdjudicatorMarks(ctx: Ctx, adjudicatorId: string, roundId: string, submissions: MarkSubmission[]): void {
    storeMarks(ctx, adjudicatorId, roundId, submissions, actor(ctx).id)
  },
}

function markingTask(ctx: Ctx, round: typeof t.rounds.$inferSelect): MarkingTask {
  const event = getEventRow(ctx, round.eventId)
  const heats = heatsOfRound(ctx, round.id)
  const ids = fieldOf(ctx, round)
  const numbers = backNumbers(ctx, ids)
  const heatOf = new Map(heats.flatMap((h) => h.competitorIds.map((id) => [id, h.number] as const)))
  return {
    round: toRound(round),
    event: toEvent(event),
    recallNumber: round.recallNumber,
    dances: event.dances,
    competitors: ids
      .map((id) => ({ id, backNumber: numbers.get(id) ?? null, heat: round.type === 'final' ? null : (heatOf.get(id) ?? 1) }))
      .sort((a, b) => (a.backNumber ?? Infinity) - (b.backNumber ?? Infinity)),
  }
}

// Each adjudicator on the panel: submitted, marking (phone heard from recently), or waiting
export function submissionSnapshot(ctx: Ctx, roundId: string): AdjudicatorSubmission[] {
  const round = getRoundRow(ctx, roundId)
  const panel = panelAdjudicatorIds(ctx, round.eventId)
  const done = new Map(
    ctx.db.select().from(t.submissions).where(eq(t.submissions.roundId, roundId)).all().map((s) => [s.adjudicatorId, s.submittedAt]),
  )
  const live = round.status === 'marking'
  const clock = Date.now()
  return panel.map((adjudicatorId) => {
    const submittedAt = done.get(adjudicatorId) ?? null
    if (submittedAt) return { roundId, adjudicatorId, status: SubmissionStatus.Submitted, submittedAt }
    const seen = live ? ctx.hub.lastSeen(adjudicatorId) : null
    if (seen === null) return { roundId, adjudicatorId, status: SubmissionStatus.Waiting, submittedAt: null }
    const quiet = clock - seen > QUIET_MS
    return {
      roundId,
      adjudicatorId,
      status: SubmissionStatus.Marking,
      submittedAt: null,
      quietSince: quiet ? new Date(seen).toISOString() : null,
      holdingMarks: ctx.hub.holding(adjudicatorId) === roundId,
    }
  })
}

function sameMarks(a: Array<[string, string, number]>, b: Array<[string, string, number]>) {
  const key = (m: [string, string, number]) => m.join('|')
  return a.length === b.length && new Set(a.map(key)).size === a.length && b.every((m) => a.some((x) => key(x) === key(m)))
}

// Validates and stores one adjudicator's marks for a round, all together. Sending the same marks again
// (after a Wi-Fi drop) is accepted and changes nothing; different marks are refused.
function storeMarks(ctx: Ctx, adjudicatorId: string, roundId: string, submissions: MarkSubmission[], enteredBy: string | null) {
  const round = getRoundRow(ctx, roundId)
  const event = getEventRow(ctx, round.eventId)
  if (!panelAdjudicatorIds(ctx, event.id).includes(adjudicatorId)) return fail('This adjudicator is not on the panel for this event.', 403)
  if (round.status !== 'marking' && round.status !== 'review') return fail('This round is not open for marking.', 409)

  const list = Array.isArray(submissions) ? submissions : []
  const field = new Set(fieldOf(ctx, round))
  const dances = new Set(list.map((s) => s.dance))
  if (list.length !== event.dances.length || dances.size !== list.length || event.dances.some((d) => !dances.has(d))) {
    return fail('Mark every dance before submitting.')
  }
  for (const s of list) {
    const ids = Array.isArray(s.competitorIds) ? s.competitorIds : []
    if (new Set(ids).size !== ids.length || ids.some((id) => !field.has(id))) {
      return fail('Each competitor can be marked once, and only those in this round.')
    }
    if (round.recallNumber === null && ids.length !== field.size) return fail('Place every finalist.')
    if (round.recallNumber !== null && ids.length !== round.recallNumber) {
      return fail(`Mark exactly ${round.recallNumber} competitors in each dance.`)
    }
  }

  const incoming = list.flatMap((s) => s.competitorIds.map((id, i): [string, string, number] => [s.dance, id, round.recallNumber === null ? i + 1 : 0]))
  const existing = ctx.db
    .select()
    .from(t.submissions)
    .where(and(eq(t.submissions.roundId, roundId), eq(t.submissions.adjudicatorId, adjudicatorId)))
    .get()
  if (existing) {
    const stored = ctx.db
      .select()
      .from(t.marks)
      .where(and(eq(t.marks.roundId, roundId), eq(t.marks.adjudicatorId, adjudicatorId)))
      .all()
      .map((m): [string, string, number] => [m.dance, m.competitorId, m.placing ?? 0])
    if (sameMarks(stored, incoming)) return
    return fail('You have already submitted this round.', 409)
  }

  const at = now()
  for (const [dance, competitorId, placing] of incoming) {
    ctx.db
      .insert(t.marks)
      .values({
        id: newId(),
        roundId,
        adjudicatorId,
        competitorId,
        dance: dance as (typeof event.dances)[number],
        kind: round.recallNumber === null ? 'placing' : 'x',
        placing: round.recallNumber === null ? placing : null,
        submittedAt: at,
      })
      .run()
  }
  ctx.db.insert(t.submissions).values({ roundId, adjudicatorId, submittedAt: at, enteredBy }).run()
  // Any tie decision was made on fewer marks
  ctx.db.delete(t.tieDecisions).where(eq(t.tieDecisions.roundId, roundId)).run()

  const panel = panelAdjudicatorIds(ctx, event.id)
  const submitted = ctx.db.select().from(t.submissions).where(eq(t.submissions.roundId, roundId)).all().length
  if (submitted >= panel.length && round.status === 'marking') {
    ctx.db.update(t.rounds).set({ status: 'review' }).where(and(eq(t.rounds.id, roundId), inArray(t.rounds.status, ['marking']))).run()
  }
  record(ctx.db, enteredBy ?? adjudicatorId, enteredBy ? 'Entered marks from paper' : 'Submitted marks', roundId, {
    after: { adjudicatorId, marks: incoming.length },
  })
  ctx.defer(() => {
    ctx.hub.submissions(roundId, submissionSnapshot(ctx, roundId))
    ctx.hub.floor(roundId)
  })
}
