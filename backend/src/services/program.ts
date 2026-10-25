import {
  PROGRAM_START,
  ProgramKind,
  ProgramStatus,
  RoundType,
  clockTime,
  programStatuses,
  type Program,
  type ProgramRow,
  type ProgramSlotInput,
} from '@bis/shared'
import { asc, eq } from 'drizzle-orm'
import { actor, fail, found, type Ctx } from '../core/context.ts'
import { record } from '../core/audit.ts'
import * as t from '../db/schema.ts'
import { newId } from '../ids.ts'
import { activeEntryRows, assertNotHeld, planFor, roundAdvanced, roundsOfEvent } from './shared.ts'

type Slot = typeof t.programSlots.$inferSelect

const MAX_MINUTES = 600

// Rounds of the same kind are danced together across events, so a new program starts in this order
const ROUND_ORDER: RoundType[] = [RoundType.Round1, RoundType.Round2, RoundType.QuarterFinal, RoundType.SemiFinal, RoundType.Final]

// A starting guess for how long a round takes; the secretariat edits it on the program screen
const defaultMinutes = (isSolo: boolean, type: RoundType) => (isSolo ? 3 : type === RoundType.Final ? 10 : 8)

const competitionRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.competitions).where(eq(t.competitions.id, id)).get(), 'Competition')

const startOf = (ctx: Ctx, competitionId: string): string | null =>
  ctx.db.select().from(t.programStarts).where(eq(t.programStarts.competitionId, competitionId)).get()?.start ?? null

const slotRow = (ctx: Ctx, id: string) =>
  found(ctx.db.select().from(t.programSlots).where(eq(t.programSlots.id, id)).get(), 'Program line')

const slotsOf = (ctx: Ctx, competitionId: string) =>
  ctx.db.select().from(t.programSlots).where(eq(t.programSlots.competitionId, competitionId)).orderBy(asc(t.programSlots.sequence)).all()

// Keeps the order 1..n with no gaps
function renumber(ctx: Ctx, ordered: Slot[]) {
  ordered.forEach((slot, i) => {
    if (slot.sequence !== i + 1) ctx.db.update(t.programSlots).set({ sequence: i + 1 }).where(eq(t.programSlots.id, slot.id)).run()
  })
}

const panelLetters = (ctx: Ctx, eventId: string): string[] =>
  ctx.db
    .select({ letter: t.adjudicators.letter })
    .from(t.panels)
    .innerJoin(t.panelMembers, eq(t.panelMembers.panelId, t.panels.id))
    .innerJoin(t.adjudicators, eq(t.adjudicators.id, t.panelMembers.adjudicatorId))
    .where(eq(t.panels.eventId, eventId))
    .orderBy(asc(t.adjudicators.letter))
    .all()
    .map((r) => r.letter)

// Who dances a round and how many are recalled from it. Before rounds are planned this follows the plan the
// scrutineer would get, so the program can be laid out early.
function fieldFor(ctx: Ctx, eventId: string, type: RoundType): { entryCount: number; recallNumber: number | null } {
  const entered = activeEntryRows(ctx, eventId).length
  const saved = roundsOfEvent(ctx, eventId)
  const list = saved.length > 0 ? saved.map((r) => ({ type: r.type, recall: r.recallNumber })) : planFor(entered)
  const i = list.findIndex((r) => r.type === type)
  if (i < 0) return { entryCount: 0, recallNumber: null }
  return { entryCount: i === 0 ? entered : (list[i - 1]!.recall ?? 0), recallNumber: list[i]!.recall }
}

function build(ctx: Ctx, competitionId: string): Program {
  const competition = competitionRow(ctx, competitionId)
  const slots = slotsOf(ctx, competitionId)
  const start = startOf(ctx, competitionId)
  const events = new Map(ctx.db.select().from(t.events).where(eq(t.events.competitionId, competitionId)).all().map((e) => [e.id, e]))

  const roundOf = (slot: Slot) =>
    slot.eventId && slot.roundType ? roundsOfEvent(ctx, slot.eventId).find((r) => r.type === slot.roundType) : undefined

  // TODO: floorRoundId stays at the venue, so online no line is ever "current"; sync it to show the live line there
  const states = slots.map((slot) => {
    const round = roundOf(slot)
    if (slot.kind !== ProgramKind.Round) return null
    if (round && roundAdvanced(round.status)) return ProgramStatus.Completed
    if (round && round.id === competition.floorRoundId) return ProgramStatus.Current
    return ProgramStatus.Upcoming
  })

  const status = programStatuses(states)

  let elapsed = 0
  const rows = slots.map<ProgramRow>((slot, i) => {
    const event = slot.eventId ? events.get(slot.eventId) : undefined
    const field = event && slot.roundType ? fieldFor(ctx, event.id, slot.roundType) : null
    const row: ProgramRow = {
      slotId: slot.id,
      sequence: slot.sequence,
      kind: slot.kind,
      startTime: start ? clockTime(start, elapsed) : null,
      minutes: slot.minutes,
      label: slot.label,
      eventId: event?.id ?? null,
      eventNumber: event?.number ?? null,
      ageGroup: event?.ageGroup ?? null,
      class: event?.class ?? null,
      discipline: event?.discipline ?? null,
      isSolo: event?.isSolo ?? null,
      dances: event?.dances ?? [],
      roundType: slot.roundType,
      recallNumber: field?.recallNumber ?? null,
      entryCount: field?.entryCount ?? 0,
      panel: event ? panelLetters(ctx, event.id) : [],
      status: status[i]!,
    }
    elapsed += slot.minutes
    return row
  })
  return { start, rows }
}

function checkMinutes(minutes: unknown): number {
  if (!Number.isInteger(minutes) || (minutes as number) < 1 || (minutes as number) > MAX_MINUTES) {
    return fail(`Minutes is a whole number from 1 to ${MAX_MINUTES}.`)
  }
  return minutes as number
}

const changed = (ctx: Ctx) => ctx.defer(() => ctx.hub.program())

export const program = {
  getProgram: (ctx: Ctx, competitionId: string): Program => build(ctx, competitionId),

  setProgramStart(ctx: Ctx, competitionId: string, start: string | null): Program {
    const competition = competitionRow(ctx, competitionId)
    assertNotHeld(ctx, competitionId)
    if (start !== null && !PROGRAM_START.test(start)) return fail('The start time is hours and minutes, like 08:30.')
    const before = startOf(ctx, competitionId)
    if (start === null) ctx.db.delete(t.programStarts).where(eq(t.programStarts.competitionId, competitionId)).run()
    else ctx.db.insert(t.programStarts).values({ competitionId, start }).onConflictDoUpdate({ target: t.programStarts.competitionId, set: { start } }).run()
    record(ctx.db, actor(ctx).id, 'Set program start', competition.name, { before: { start: before }, after: { start } })
    changed(ctx)
    return build(ctx, competitionId)
  },

  // Adds a line for every round that has none yet, after the ones already there. Safe to run again.
  generateProgram(ctx: Ctx, competitionId: string): Program {
    const competition = competitionRow(ctx, competitionId)
    assertNotHeld(ctx, competitionId)
    const existing = slotsOf(ctx, competitionId)
    const has = new Set(existing.filter((s) => s.kind === ProgramKind.Round).map((s) => `${s.eventId}:${s.roundType}`))

    const events = ctx.db.select().from(t.events).where(eq(t.events.competitionId, competitionId)).orderBy(asc(t.events.position)).all()
    const missing = events
      .flatMap((event) => {
        const types = roundsOfEvent(ctx, event.id).map((r) => r.type)
        const planned = types.length > 0 ? types : planFor(activeEntryRows(ctx, event.id).length).map((p) => p.type)
        return planned.map((type) => ({ event, type }))
      })
      .filter(({ event, type }) => !has.has(`${event.id}:${type}`))
      .sort((a, b) => ROUND_ORDER.indexOf(a.type) - ROUND_ORDER.indexOf(b.type) || a.event.position - b.event.position)

    missing.forEach(({ event, type }, i) => {
      ctx.db
        .insert(t.programSlots)
        .values({
          id: newId(),
          competitionId,
          sequence: existing.length + i + 1,
          kind: ProgramKind.Round,
          eventId: event.id,
          roundType: type,
          label: null,
          minutes: defaultMinutes(event.isSolo, type),
        })
        .run()
    })
    record(ctx.db, actor(ctx).id, 'Generated program', competition.name, { after: { added: missing.length } })
    changed(ctx)
    return build(ctx, competitionId)
  },

  // A break or the awarding, after the given line or at the end
  addProgramBreak(
    ctx: Ctx,
    competitionId: string,
    input: { kind: ProgramKind; label: string; minutes: number; afterSequence?: number },
  ): Program {
    competitionRow(ctx, competitionId)
    assertNotHeld(ctx, competitionId)
    if (input?.kind !== ProgramKind.Break && input?.kind !== ProgramKind.Awarding) return fail('Choose a break or the awarding.')
    const label = typeof input.label === 'string' ? input.label.trim() : ''
    if (!label) return fail('Give it a name, like Lunch.')
    const minutes = checkMinutes(input.minutes)
    const slots = slotsOf(ctx, competitionId)
    const at = Number.isInteger(input.afterSequence) ? Math.min(Math.max(input.afterSequence!, 0), slots.length) : slots.length
    const added: Slot = { id: newId(), competitionId, sequence: at + 1, kind: input.kind, eventId: null, roundType: null, label, minutes }
    ctx.db.insert(t.programSlots).values(added).run()
    renumber(ctx, [...slots.slice(0, at), added, ...slots.slice(at)])
    record(ctx.db, actor(ctx).id, 'Added to program', label, { after: { kind: input.kind, minutes } })
    changed(ctx)
    return build(ctx, competitionId)
  },

  updateProgramSlot(ctx: Ctx, slotId: string, input: ProgramSlotInput): Program {
    const slot = slotRow(ctx, slotId)
    assertNotHeld(ctx, slot.competitionId)
    const patch: Partial<Slot> = {}
    if (input?.minutes !== undefined) patch.minutes = checkMinutes(input.minutes)
    if (input?.label !== undefined) {
      if (slot.kind === ProgramKind.Round) return fail('A round is named by its event.')
      const label = String(input.label).trim()
      if (!label) return fail('Give it a name, like Lunch.')
      patch.label = label
    }
    if (Object.keys(patch).length > 0) {
      ctx.db.update(t.programSlots).set(patch).where(eq(t.programSlots.id, slotId)).run()
      record(ctx.db, actor(ctx).id, 'Edited program line', slot.label ?? `Line ${slot.sequence}`, { before: { minutes: slot.minutes, label: slot.label }, after: patch })
    }
    changed(ctx)
    return build(ctx, slot.competitionId)
  },

  moveProgramSlot(ctx: Ctx, slotId: string, direction: 'up' | 'down'): Program {
    const slot = slotRow(ctx, slotId)
    assertNotHeld(ctx, slot.competitionId)
    const order = slotsOf(ctx, slot.competitionId)
    const from = order.findIndex((s) => s.id === slotId)
    const to = direction === 'up' ? from - 1 : from + 1
    if (to < 0 || to >= order.length) return fail('That line cannot move further.')
    ;[order[from], order[to]] = [order[to]!, order[from]!]
    renumber(ctx, order)
    record(ctx.db, actor(ctx).id, 'Moved program line', slot.label ?? `Line ${slot.sequence}`, { before: { sequence: from + 1 }, after: { sequence: to + 1 } })
    changed(ctx)
    return build(ctx, slot.competitionId)
  },

  removeProgramSlot(ctx: Ctx, slotId: string): Program {
    const slot = slotRow(ctx, slotId)
    assertNotHeld(ctx, slot.competitionId)
    ctx.db.delete(t.programSlots).where(eq(t.programSlots.id, slotId)).run()
    renumber(ctx, slotsOf(ctx, slot.competitionId))
    record(ctx.db, actor(ctx).id, 'Removed program line', slot.label ?? `Line ${slot.sequence}`)
    changed(ctx)
    return build(ctx, slot.competitionId)
  },
}
