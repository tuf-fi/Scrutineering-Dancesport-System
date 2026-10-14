import {
  placeEliminated,
  placeFinal,
  recalledIds,
  tallyCallback,
  type RoundOutcome,
} from '@bis/scoring'
import {
  RoundStatus,
  type Announcement,
  type Event,
  type Mark,
  type RecallRow,
  type RecallTable,
  type Round,
  type SkatingRow,
  type SkatingTable,
  type TieDecision,
} from '@bis/shared'
import { and, asc, eq } from 'drizzle-orm'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import { record } from '../core/audit.ts'
import * as t from '../db/schema.ts'
import { newId, now } from '../ids.ts'
import { recomputeEventPoints } from './ranking.ts'
import { groupsFor, submissionSnapshot } from './rounds.ts'
import {
  backNumbers,
  currentCompetition,
  fieldOf,
  getEventRow,
  getRoundRow,
  heatsOfRound,
  panelAdjudicatorIds,
  roundAdvanced,
  roundsOfEvent,
  saveHeats,
  toEvent,
  toMark,
  toRound,
} from './shared.ts'

const marksOf = (ctx: Ctx, roundId: string): Mark[] =>
  ctx.db.select().from(t.marks).where(eq(t.marks.roundId, roundId)).all().map(toMark)

const peopleOf = (ctx: Ctx, ids: string[]) =>
  new Map(
    ctx.db
      .select()
      .from(t.competitors)
      .all()
      .filter((c) => ids.includes(c.id))
      .map((c) => [c.id, c]),
  )

const dancesIn = (list: Mark[]) => [...new Set(list.map((m) => m.dance))]

function tieDecisionOf(ctx: Ctx, roundId: string): TieDecision | null {
  const row = ctx.db.select().from(t.tieDecisions).where(eq(t.tieDecisions.roundId, roundId)).get()
  return row ? { choice: row.choice, proposedBy: row.proposedBy, confirmedBy: row.confirmedBy } : null
}

// The engine only needs the adjudicators who have submitted, so a round in progress gives a provisional tally
function callbackFor(ctx: Ctx, round: typeof t.rounds.$inferSelect, recall: number) {
  const roundMarks = marksOf(ctx, round.id).filter((m) => m.kind === 'x')
  const field = fieldOf(ctx, round)
  const result = tallyCallback({
    competitorIds: field,
    adjudicatorIds: panelAdjudicatorIds(ctx, round.eventId).filter((id) => roundMarks.some((m) => m.adjudicatorId === id)),
    dances: dancesIn(roundMarks),
    recallNumber: recall,
    marks: roundMarks.map((m) => ({ adjudicatorId: m.adjudicatorId, competitorId: m.competitorId, dance: m.dance })),
  })
  return { result, field }
}

export function recallTable(ctx: Ctx, roundId: string): RecallTable {
  const round = getRoundRow(ctx, roundId)
  if (round.recallNumber === null) return fail('A final is placed, not recalled.', 409)
  const recall = round.recallNumber
  const { result, field } = callbackFor(ctx, round, recall)
  const panel = panelAdjudicatorIds(ctx, round.eventId)
  const submitted = new Set(marksOf(ctx, roundId).map((m) => m.adjudicatorId))
  const numbers = backNumbers(ctx, field)
  const people = peopleOf(ctx, field)
  const decision = result.tie ? tieDecisionOf(ctx, roundId) : null

  // A round that is already decided has its recall in the next round's heats, whatever the counts say
  const next = roundsOfEvent(ctx, round.eventId).find((r) => r.position === round.position + 1)
  const through = roundAdvanced(round.status) && next ? new Set(heatsOfRound(ctx, next.id).flatMap((h) => h.competitorIds)) : null
  const settled = through !== null && through.size > 0

  const rows: RecallRow[] = [...result.rows]
    .sort((a, b) => b.xCount - a.xCount || (numbers.get(a.competitorId) ?? 0) - (numbers.get(b.competitorId) ?? 0))
    .map((r, i) => {
      let outcome = r.outcome
      if (settled) outcome = through.has(r.competitorId) ? 'recalled' : 'out'
      else if (r.outcome === 'tied' && decision) outcome = decision.choice === 'more' ? 'recalled' : 'out'
      return {
        competitorId: r.competitorId,
        backNumber: numbers.get(r.competitorId) ?? null,
        names: people.get(r.competitorId)?.names ?? [],
        xCount: r.xCount,
        // Position in the list, so the cutoff line sits under the last recalled row
        rank: i + 1,
        outcome,
      }
    })

  const tie = result.tie
  return {
    roundId,
    recallNumber: recall,
    adjudicatorCount: panel.length,
    submittedCount: panel.filter((id) => submitted.has(id)).length,
    rows,
    recalled: settled
      ? through.size
      : !tie
        ? rows.filter((r) => r.outcome === 'recalled').length
        : decision
          ? decision.choice === 'more' ? tie.moreCount : tie.fewerCount
          : recall,
    tie: tie && !settled ? { xCount: tie.xCount, count: tie.competitorIds.length, decision } : null,
  }
}

export function skatingTable(ctx: Ctx, roundId: string): SkatingTable {
  const round = getRoundRow(ctx, roundId)
  const panel = panelAdjudicatorIds(ctx, round.eventId)
  const roundMarks = marksOf(ctx, roundId)
  const isPlacing = roundMarks.some((m) => m.kind === 'placing') || round.recallNumber === null
  const letters = new Map(ctx.db.select().from(t.adjudicators).all().map((a) => [a.id, a.letter]))
  const adjudicatorList = panel.map((id) => ({ id, letter: letters.get(id) ?? '?' }))
  const markedBy = new Set(roundMarks.map((m) => m.adjudicatorId))
  const complete = panel.length > 0 && panel.every((id) => markedBy.has(id))
  const ids = [...new Set(roundMarks.map((m) => m.competitorId)), ...fieldOf(ctx, round)]
  const numbers = backNumbers(ctx, ids)
  const people = peopleOf(ctx, ids)

  const base = (competitorId: string) => {
    const marks: Record<string, number | null> = {}
    for (const { id } of adjudicatorList) {
      const own = roundMarks.filter((m) => m.adjudicatorId === id && m.competitorId === competitorId)
      marks[id] = markedBy.has(id) ? own.reduce((sum, m) => sum + (m.kind === 'placing' ? m.placing : 1), 0) : null
    }
    return {
      competitorId,
      backNumber: numbers.get(competitorId) ?? null,
      names: people.get(competitorId)?.names ?? [],
      marks,
      total: Object.values(marks).reduce<number>((sum, v) => sum + (v ?? 0), 0),
    }
  }
  const byBackNumber = (a: SkatingRow, b: SkatingRow) => (a.backNumber ?? 0) - (b.backNumber ?? 0)

  if (!isPlacing) {
    const { result } = callbackFor(ctx, round, round.recallNumber ?? 0)
    const rows = result.rows.map<SkatingRow>((r) => ({
      ...base(r.competitorId),
      majority: [],
      place: r.rank,
      shared: false,
      dancePlaces: [],
      decidedBy: null,
    }))
    rows.sort((a, b) => b.total - a.total || byBackNumber(a, b))
    return { roundId, kind: 'x', complete, adjudicators: adjudicatorList, places: 0, rows }
  }

  const placings = roundMarks.filter((m) => m.kind === 'placing')
  const finalists = [...new Set(placings.map((m) => m.competitorId))]
  if (finalists.length === 0) return { roundId, kind: 'placing', complete, adjudicators: adjudicatorList, places: 0, rows: [] }

  const dances = dancesIn(placings)
  const final = placeFinal({
    competitorIds: finalists,
    adjudicatorIds: panel.filter((id) => markedBy.has(id)),
    dances: dances.map((dance) => ({
      dance,
      marks: placings
        .filter((m) => m.dance === dance)
        .map((m) => ({ adjudicatorId: m.adjudicatorId, competitorId: m.competitorId, placing: m.kind === 'placing' ? m.placing : 0 })),
    })),
  })
  const single = dances.length === 1

  const rows = final.rows.map<SkatingRow>((r) => ({
    ...base(r.competitorId),
    // The column counts are the Skating System working; a multi-dance final shows dance places instead
    majority: single ? (final.dances[0]?.result.columns[r.competitorId] ?? []).map((c) => c.count) : [],
    place: r.announcedPlace,
    shared: r.shared,
    dancePlaces: single ? [] : final.dances.map((d) => ({ dance: d.dance, place: r.dancePlaces[d.dance] ?? 0 })),
    decidedBy: r.decidedBy,
  }))
  rows.sort((a, b) => a.place - b.place || byBackNumber(a, b))
  return { roundId, kind: 'placing', complete, adjudicators: adjudicatorList, places: single ? finalists.length : 0, rows }
}

export const scrutiny = {
  getRecallTable: (ctx: Ctx, roundId: string) => assertCanView(ctx, roundId, () => recallTable(ctx, roundId)),

  getSkatingTable: (ctx: Ctx, roundId: string) => assertCanView(ctx, roundId, () => skatingTable(ctx, roundId)),

  proposeTieDecision(ctx: Ctx, roundId: string, choice: TieDecision['choice']): void {
    const round = getRoundRow(ctx, roundId)
    if (round.recallNumber === null) return fail('A final has no recall to decide.', 409)
    if (round.status !== 'marking' && round.status !== 'review') return fail('This round is already decided.', 409)
    if (choice !== 'more' && choice !== 'fewer') return fail('Choose to recall more or fewer.')
    const tie = callbackFor(ctx, round, round.recallNumber).result.tie
    if (!tie) return fail('There is no tie to decide.', 409)
    if (choice === 'fewer' && tie.fewerCount === 0) return fail('Recalling only those above the tie would recall nobody.', 409)
    const user = actor(ctx)
    const previous = tieDecisionOf(ctx, roundId)
    ctx.db.delete(t.tieDecisions).where(eq(t.tieDecisions.roundId, roundId)).run()
    ctx.db.insert(t.tieDecisions).values({ roundId, choice, proposedBy: user.id, proposedAt: now() }).run()
    record(ctx.db, user.id, 'Proposed tie decision', roundId, { before: previous, after: { choice } })
  },

  confirmTieDecision(ctx: Ctx, roundId: string): void {
    const round = getRoundRow(ctx, roundId)
    if (round.status !== 'marking' && round.status !== 'review') return fail('This round is already decided.', 409)
    const decision = found(ctx.db.select().from(t.tieDecisions).where(eq(t.tieDecisions.roundId, roundId)).get(), 'Tie decision')
    const user = actor(ctx)
    ctx.db.update(t.tieDecisions).set({ confirmedBy: user.id, confirmedAt: now() }).where(eq(t.tieDecisions.roundId, roundId)).run()
    record(ctx.db, user.id, 'Confirmed tie decision', roundId, { after: { choice: decision.choice } })
  },

  approveRound(ctx: Ctx, roundId: string): void {
    const user = actor(ctx)
    const round = getRoundRow(ctx, roundId)
    const event = getEventRow(ctx, round.eventId)
    if (round.status !== 'review') return fail('Every adjudicator must submit before approving.', 409)

    if (round.recallNumber !== null) {
      const { result } = callbackFor(ctx, round, round.recallNumber)
      const decision = tieDecisionOf(ctx, roundId)
      if (result.tie && !decision?.confirmedBy) return fail('Resolve the tie and get the chairperson to confirm it first.', 409)
      const recalled = recalledIds(result, result.tie ? decision?.choice : undefined)
      const next = found(roundsOfEvent(ctx, round.eventId).find((r) => r.position === round.position + 1), 'Next round')
      saveHeats(ctx, next.id, groupsFor(ctx, next, recalled))
    } else {
      writeResults(ctx, round, event, user.id)
    }

    ctx.db.update(t.rounds).set({ status: 'approved' }).where(eq(t.rounds.id, roundId)).run()
    ctx.db.update(t.competitions).set({ floorRoundId: null }).where(eq(t.competitions.floorRoundId, roundId)).run()
    record(ctx.db, user.id, 'Approved round', `Event ${event.number}, ${round.type}`, { before: { status: round.status }, after: { status: 'approved' } })
    ctx.defer(() => {
      ctx.hub.floor(null)
      ctx.hub.submissions(roundId, submissionSnapshot(ctx, roundId))
      if (round.recallNumber === null) ctx.hub.rankings()
      ctx.afterApproval?.()
    })
  },

  publishRound(ctx: Ctx, roundId: string): void {
    const user = actor(ctx)
    const round = getRoundRow(ctx, roundId)
    const event = getEventRow(ctx, round.eventId)
    if (round.status !== 'approved') return fail('Approve the round before publishing it.', 409)
    ctx.db.update(t.rounds).set({ status: 'published', publishedAt: now() }).where(eq(t.rounds.id, roundId)).run()
    record(ctx.db, user.id, 'Published round', `Event ${event.number}, ${round.type}`, { before: { status: 'approved' }, after: { status: 'published' } })
    ctx.defer(() => {
      ctx.hub.published({ competitionId: event.competitionId, eventId: event.id, roundId })
      if (round.recallNumber === null) ctx.hub.rankings()
    })
  },

  getAnnouncements: (ctx: Ctx) => announcements(ctx),
}

// Guests see a round's tables once it is published; everyone else who may call this is staff
function assertCanView<T>(ctx: Ctx, roundId: string, build: () => T): T {
  if (ctx.user && ctx.user.role !== 'club' && ctx.user.role !== 'adjudicator') return build()
  const round = getRoundRow(ctx, roundId)
  if (round.status !== RoundStatus.Published) return fail('These results are not published yet.', 403)
  return build()
}

// Works out the final places and the places of everyone cut before it, and stores them
function writeResults(ctx: Ctx, round: typeof t.rounds.$inferSelect, event: typeof t.events.$inferSelect, approvedBy: string) {
  const roundMarks = marksOf(ctx, round.id)
  const panel = panelAdjudicatorIds(ctx, event.id)
  const placings = roundMarks.filter((m) => m.kind === 'placing')
  const final = placeFinal({
    competitorIds: [...new Set(placings.map((m) => m.competitorId))],
    adjudicatorIds: panel,
    dances: dancesIn(placings).map((dance) => ({
      dance,
      marks: placings
        .filter((m) => m.dance === dance)
        .map((m) => ({ adjudicatorId: m.adjudicatorId, competitorId: m.competitorId, placing: m.kind === 'placing' ? m.placing : 0 })),
    })),
  })

  const sequence = roundsOfEvent(ctx, event.id)
  const outcomes: RoundOutcome[] = sequence
    .filter((r) => r.recallNumber !== null)
    .map((r) => {
      const next = sequence.find((n) => n.position === r.position + 1)
      const xCounts: Record<string, number> = {}
      for (const m of marksOf(ctx, r.id)) xCounts[m.competitorId] = (xCounts[m.competitorId] ?? 0) + 1
      return {
        roundType: r.type,
        competitorIds: fieldOf(ctx, r),
        recalledIds: next ? fieldOf(ctx, next) : [],
        xCounts,
      }
    })
  const eliminated = placeEliminated(outcomes)

  const at = now()
  ctx.db.delete(t.results).where(eq(t.results.eventId, event.id)).run()
  const sharing = (place: number) => final.rows.filter((r) => r.announcedPlace === place).length
  for (const r of final.rows) {
    ctx.db
      .insert(t.results)
      .values({
        id: newId(),
        eventId: event.id,
        competitorId: r.competitorId,
        place: r.announcedPlace,
        placeFrom: r.announcedPlace,
        placeTo: r.announcedPlace + sharing(r.announcedPlace) - 1,
        stage: 'final',
        approvedBy,
        approvedAt: at,
      })
      .run()
  }
  for (const e of eliminated) {
    ctx.db
      .insert(t.results)
      .values({
        id: newId(),
        eventId: event.id,
        competitorId: e.competitorId,
        place: e.announcedPlace,
        placeFrom: e.from,
        placeTo: e.to,
        stage: e.roundType,
        approvedBy,
        approvedAt: at,
      })
      .run()
  }
  recomputeEventPoints(ctx, event.id)
}

// ---- MC ----

function announcements(ctx: Ctx): Announcement[] {
  const competition = currentCompetition(ctx)
  if (!competition) return []
  const events = ctx.db.select().from(t.events).where(eq(t.events.competitionId, competition.id)).orderBy(asc(t.events.number)).all()
  const eventById = new Map(events.map((e) => [e.id, e]))
  const allRounds = events.flatMap((e) => roundsOfEvent(ctx, e.id))
  const call: Announcement[] = []
  const done: Array<{ at: string; items: Announcement[] }> = []

  const base = (event: Event, round: Round) => ({
    eventNumber: event.number,
    dances: event.dances,
    ageGroup: event.ageGroup,
    class: event.class,
    discipline: event.discipline,
    roundType: round.type,
    heat: null,
    numbers: [] as number[],
    result: null,
  })
  const numbersOf = (ids: string[]) =>
    [...backNumbers(ctx, ids).values()].filter((n): n is number => typeof n === 'number').sort((a, b) => a - b)

  // The round on the floor: each heat is called in turn
  if (competition.floorRoundId) {
    const round = allRounds.find((r) => r.id === competition.floorRoundId)
    const row = round ? eventById.get(round.eventId) : undefined
    if (round && row && round.status !== 'pending') {
      for (const heat of heatsOfRound(ctx, round.id)) {
        call.push({ ...base(toEvent(row), toRound(round)), id: `call:${round.id}:${heat.number}`, kind: 'call', heat: heat.number, numbers: numbersOf(heat.competitorIds) })
      }
    }
  }

  const publishedRounds = allRounds.filter((r) => r.status === 'published').sort((a, b) => (a.publishedAt ?? '').localeCompare(b.publishedAt ?? ''))
  for (const round of publishedRounds) {
    const row = eventById.get(round.eventId)
    if (!row) continue
    const event = toEvent(row)
    const roundOut = toRound(round)
    if (round.recallNumber !== null) {
      const next = roundsOfEvent(ctx, round.eventId).find((r) => r.position === round.position + 1)
      const through = next ? heatsOfRound(ctx, next.id).flatMap((h) => h.competitorIds) : []
      done.push({ at: round.publishedAt ?? '', items: [{ ...base(event, roundOut), id: `recall:${round.id}`, kind: 'recall', numbers: numbersOf(through) }] })
      continue
    }
    const placed = ctx.db
      .select()
      .from(t.results)
      .where(and(eq(t.results.eventId, round.eventId), eq(t.results.stage, 'final')))
      .all()
      .sort((a, b) => b.place - a.place)
    const people = peopleOf(ctx, placed.map((p) => p.competitorId))
    const clubs = new Map(ctx.db.select().from(t.clubs).all().map((c) => [c.id, c.name]))
    const items: Announcement[] = [
      { ...base(event, roundOut), id: `finalists:${round.id}`, kind: 'finalists', numbers: numbersOf(placed.map((p) => p.competitorId)) },
      ...placed.map<Announcement>((r) => {
        const dancer = people.get(r.competitorId)
        return {
          ...base(event, roundOut),
          id: `result:${r.id}`,
          kind: 'result',
          // Read out from last place up, one at a time
          result: { place: r.place, backNumber: dancer?.backNumber ?? null, names: dancer?.names ?? [], clubName: dancer ? (clubs.get(dancer.clubId) ?? '') : '' },
        }
      }),
    ]
    done.push({ at: round.publishedAt ?? '', items })
  }

  return [...call, ...done.flatMap((d) => d.items)]
}
