import {
  DISCIPLINE_DANCES,
  parseCompetitorCsv,
  PaymentStatus,
  Role,
  RoundStatus,
  type Adjudicator,
  type CompetitionInput,
  type EventInput,
  type RankingFilter,
  type AdjudicatorPin,
  type AgeGroup,
  type BackupStatus,
  type CloudCompetition,
  type MessengerLink,
  type PaymentSettings,
  type PullSummary,
  type SyncStatus,
  type Competition,
  type Competitor,
  type ClubSignUp,
  type CompetitorRow,
  type HeatAssignment,
  type MarkSubmission,
  type FinalTie,
  type TieDecision,
  type Entry,
  type EntryRow,
  type Event,
  type ImportResult,
  type LateEntryRow,
  type ScheduleItem,
  type CompetitorHistoryLine,
  type Panel,
  type PaymentDetail,
  type PointsRow,
  type SessionUser,
  type StaffUser,
} from '@bis/shared'
import { adjudicatorPins, adjudicators, panels } from './data/adjudicators.ts'
import { clubs } from './data/clubs.ts'
import { competitions, currentCompetitionId } from './data/competitions.ts'
import { ageGroupOf, competitors } from './data/competitors.ts'
import { entries } from './data/entries.ts'
import { events } from './data/events.ts'
import { feeFor, paymentDetail, payments } from './data/payments.ts'
import './data/late.ts'
import { announcements } from './announcing.ts'
import {
  clubDancers,
  clubPasswords,
  clubPayments,
  deleteDancer,
  entryOptions,
  paymentMethods,
  registerEntries,
  saveDancer,
  signUpClub,
  submitPaymentProof,
} from './clubPortal.ts'
import {
  approveRoundResults,
  confirmTie,
  currentRoundId,
  heatAssignments,
  proposeTie,
  publishRoundResults,
  recallTable,
  roundRows,
  saveHeatAssignments,
  skatingTable,
} from './scrutinizing.ts'
import { adjudicatorState, demoRounds, startDemoRound, submitMarks, taskFor } from './adjudicating.ts'
import { heats, rounds } from './data/progress.ts'
import { pointsTable, rankingPoints, results } from './data/results.ts'
import { auditLog, staffUsers } from './data/staff.ts'
import { isLiveRound, liveRoundComplete, visibleMarks } from './realtime.ts'

export type { CompetitionInput, EventInput, RankingFilter } from '@bis/shared'
export { getSubmissionSnapshot, resetLiveRound, subscribeSubmissions } from './realtime.ts'

const LATENCY_MS = 250

// Copies the value so callers cannot change the sample data, and waits like a network call
function reply<T>(value: T): Promise<T> {
  const copy = structuredClone(value)
  return new Promise((resolve) => setTimeout(() => resolve(copy), LATENCY_MS))
}

function found<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} not found`)
  return value
}

export const getCompetitions = () => reply(competitions)
export const getCompetition = (id: string) =>
  reply(found(competitions.find((c) => c.id === id), 'Competition'))

export const getEvents = (competitionId?: string) =>
  reply(competitionId ? events.filter((e) => e.competitionId === competitionId) : events)
export const getEvent = (id: string) => reply(found(events.find((e) => e.id === id), 'Event'))

export const getEntries = (eventId: string) => reply(entries.filter((e) => e.eventId === eventId))
export const getCompetitors = () => reply(competitors)
export const getClubs = () => reply(clubs)

export const getAdjudicators = () => reply(adjudicators)
export const getAdjudicatorPins = (competitionId: string) =>
  reply(adjudicatorPins.filter((p) => p.competitionId === competitionId))
export const getPanel = (eventId: string) =>
  reply(found(panels.find((p) => p.eventId === eventId), 'Panel'))

// The live round turns to review once every adjudicator has submitted
function withLiveStatus<T extends { id: string; status: RoundStatus }>(round: T): T {
  return round.status === RoundStatus.Marking && isLiveRound(round.id) && liveRoundComplete()
    ? { ...round, status: RoundStatus.Review }
    : round
}

export const getRounds = (eventId: string) =>
  reply(rounds.filter((r) => r.eventId === eventId).map(withLiveStatus))
export const getRound = (id: string) =>
  reply(withLiveStatus(found(rounds.find((r) => r.id === id), 'Round')))
export const getHeats = (roundId: string) => reply(heats.filter((h) => h.roundId === roundId))
export const getMarks = (roundId: string) => reply(visibleMarks(roundId))
export const getResults = (eventId: string) => reply(results.filter((r) => r.eventId === eventId))

export const getPayments = (status?: PaymentStatus) =>
  reply(status ? payments.filter((p) => p.status === status) : payments)

export const getPointsTable = () => reply(pointsTable)

export const getRankingPoints = (filter: RankingFilter = {}) =>
  reply(
    rankingPoints.filter(
      (r) =>
        (!filter.ageGroup || r.ageGroup === filter.ageGroup) &&
        (!filter.class || r.class === filter.class) &&
        (!filter.discipline || r.discipline === filter.discipline),
    ),
  )

export const getCompetitorHistory = (competitorId: string) =>
  reply(
    results
      .filter((r) => r.competitorId === competitorId)
      .flatMap((r) => {
        const event = events.find((e) => e.id === r.eventId)
        const competition = competitions.find((c) => c.id === event?.competitionId)
        if (!event || !competition) return []
        return [
          {
            resultId: r.id,
            competitionId: competition.id,
            competitionName: competition.name,
            competitionDate: competition.date,
            eventNumber: event.number,
            dances: event.dances,
            ageGroup: event.ageGroup,
            class: event.class,
            discipline: event.discipline,
            place: r.place,
            points: rankingPoints.find((p) => p.id === `rp:${r.id}`)?.points ?? 0,
          } satisfies CompetitorHistoryLine,
        ]
      })
      .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate) || a.eventNumber - b.eventNumber),
  )

export const getStaffUsers = () => reply(staffUsers)
export const getAuditLog = () => reply(auditLog)

export const getPaymentDetails = () => reply(payments.map(paymentDetail))
export const getPanels = (competitionId: string) =>
  reply(
    panels.filter((p) => events.find((e) => e.id === p.eventId)?.competitionId === competitionId),
  )

// TODO: admin writes change the sample data in memory only; phase 3 sends them to the backend
function record(actorId: string, action: string, target: string) {
  auditLog.push({
    id: `audit-${auditLog.length + 1}`,
    actorId,
    action,
    target,
    at: new Date().toISOString(),
  })
}

const tempPassword = () => Math.random().toString(36).slice(2, 10)

export const saveCompetition = (actorId: string, input: CompetitionInput, id?: string) =>
  settle<Competition>(() => {
    const values: CompetitionInput = {
      name: input.name.trim(),
      date: input.date,
      venue: input.venue.trim(),
      organizer: input.organizer.trim(),
    }
    if (!values.name || !values.date || !values.venue || !values.organizer) {
      throw new Error('Fill in every field.')
    }
    if (id) {
      const competition = found(competitions.find((c) => c.id === id), 'Competition')
      Object.assign(competition, values)
      record(actorId, 'Edited competition', values.name)
      return competition
    }
    const created: Competition = {
      id: `comp-${competitions.length + 1}-${Date.now().toString(36)}`,
      ...values,
    }
    competitions.push(created)
    record(actorId, 'Created competition', values.name)
    return created
  })

export const deleteCompetition = (actorId: string, id: string) =>
  settle<{ id: string }>(() => {
    const index = competitions.findIndex((c) => c.id === id)
    const competition = found(competitions[index], 'Competition')
    const eventTotal = events.filter((e) => e.competitionId === id).length
    if (eventTotal > 0) {
      throw new Error(`${competition.name} has ${eventTotal} events, so it can't be deleted.`)
    }
    competitions.splice(index, 1)
    record(actorId, 'Deleted competition', competition.name)
    return { id }
  })

export const createStaffUser = (
  actorId: string,
  input: { name: string; username: string; role: Role },
) =>
  settle(() => {
    const username = input.username.trim().toLowerCase()
    const name = input.name.trim()
    if (!name || !username) throw new Error('Enter a name and a username.')
    if (staffUsers.some((s) => s.username === username)) throw new Error('That username is taken.')
    const user: StaffUser = { id: `staff-${username}`, name, username, role: input.role }
    const password = tempPassword()
    passwords.set(username, password)
    staffUsers.push(user)
    record(actorId, 'Added staff account', name)
    return { user, tempPassword: password }
  })

const adminCount = () => staffUsers.filter((s) => s.role === Role.Admin).length

export const updateStaffUser = (actorId: string, id: string, input: { name: string; role: Role }) =>
  settle<StaffUser>(() => {
    const user = found(staffUsers.find((s) => s.id === id), 'Staff account')
    const name = input.name.trim()
    if (!name) throw new Error('Enter a name.')
    if (user.role === Role.Admin && input.role !== Role.Admin && adminCount() === 1) {
      throw new Error('There must be at least one admin.')
    }
    user.name = name
    user.role = input.role
    record(actorId, 'Edited staff account', name)
    return user
  })

export const deleteStaffUser = (actorId: string, id: string) =>
  settle<{ id: string }>(() => {
    if (id === actorId) throw new Error("You can't delete your own account.")
    const index = staffUsers.findIndex((s) => s.id === id)
    const user = found(staffUsers[index], 'Staff account')
    if (user.role === Role.Admin && adminCount() === 1) throw new Error('There must be at least one admin.')
    staffUsers.splice(index, 1)
    passwords.delete(user.username)
    record(actorId, 'Deleted staff account', user.name)
    return { id }
  })

export const updateAdjudicator = (actorId: string, id: string, input: { name: string }) =>
  settle<Adjudicator>(() => {
    const adjudicator = found(adjudicators.find((a) => a.id === id), 'Adjudicator')
    const name = input.name.trim()
    if (!name) throw new Error('Enter a name.')
    adjudicator.name = name
    record(actorId, 'Edited adjudicator', `${adjudicator.letter} ${name}`)
    return adjudicator
  })

export const deleteAdjudicator = (actorId: string, id: string) =>
  settle<{ id: string }>(() => {
    const index = adjudicators.findIndex((a) => a.id === id)
    const adjudicator = found(adjudicators[index], 'Adjudicator')
    const onPanels = panels.filter((p) => p.adjudicatorIds.includes(id)).length
    if (onPanels > 0) {
      throw new Error(`${adjudicator.name} is on ${onPanels} panels, so can't be deleted.`)
    }
    adjudicators.splice(index, 1)
    for (let i = adjudicatorPins.length - 1; i >= 0; i--) {
      if (adjudicatorPins[i].adjudicatorId === id) adjudicatorPins.splice(i, 1)
    }
    record(actorId, 'Deleted adjudicator', `${adjudicator.letter} ${adjudicator.name}`)
    return { id }
  })

export const resetStaffPassword = (actorId: string, id: string) =>
  settle(() => {
    const user = found(staffUsers.find((s) => s.id === id), 'Staff account')
    const password = tempPassword()
    passwords.set(user.username, password)
    record(actorId, 'Reset password', user.name)
    return { tempPassword: password }
  })

export const createAdjudicator = (actorId: string, input: { name: string; letter: string }) =>
  settle<Adjudicator>(() => {
    const letter = input.letter.toUpperCase()
    const name = input.name.trim()
    if (!name) throw new Error('Enter a name.')
    if (!/^[A-J]$/.test(letter)) throw new Error('Pick a letter from A to J.')
    if (adjudicators.some((a) => a.letter === letter)) throw new Error(`Letter ${letter} is already taken.`)
    const adjudicator: Adjudicator = { id: `adj-${letter.toLowerCase()}`, name, letter }
    adjudicators.push(adjudicator)
    adjudicators.sort((a, b) => a.letter.localeCompare(b.letter))
    record(actorId, 'Added adjudicator', `${letter} ${name}`)
    return adjudicator
  })

// Without an adjudicatorId, creates PINs for everyone who has none; with one, replaces that PIN
export const generatePins = (actorId: string, competitionId: string, adjudicatorId?: string) =>
  settle<AdjudicatorPin[]>(() => {
    const competition = found(competitions.find((c) => c.id === competitionId), 'Competition')
    const inCompetition = () => adjudicatorPins.filter((p) => p.competitionId === competitionId)
    const taken = new Set(inCompetition().map((p) => p.pin))
    const nextPin = () => {
      for (;;) {
        const pin = String(1000 + Math.floor(Math.random() * 9000))
        if (!taken.has(pin)) {
          taken.add(pin)
          return pin
        }
      }
    }
    const targets = adjudicatorId
      ? [found(adjudicators.find((a) => a.id === adjudicatorId), 'Adjudicator')]
      : adjudicators
    for (const adjudicator of targets) {
      const existing = inCompetition().find((p) => p.adjudicatorId === adjudicator.id)
      if (existing && !adjudicatorId) continue
      if (existing) {
        const old = existing.pin
        existing.pin = nextPin()
        taken.delete(old)
      } else {
        adjudicatorPins.push({ competitionId, adjudicatorId: adjudicator.id, pin: nextPin() })
      }
    }
    record(actorId, adjudicatorId ? 'Changed PIN' : 'Generated PINs', competition.name)
    return inCompetition()
  })

export const setPanel = (actorId: string, eventId: string, adjudicatorIds: string[]) =>
  settle<Panel>(() => {
    const event = found(events.find((e) => e.id === eventId), 'Event')
    const ids = adjudicators.filter((a) => adjudicatorIds.includes(a.id)).map((a) => a.id)
    if (ids.length === 0) throw new Error('Choose at least one adjudicator.')
    let panel = panels.find((p) => p.eventId === eventId)
    if (panel) {
      panel.adjudicatorIds = ids
    } else {
      panel = { id: `panel-${eventId}`, eventId, adjudicatorIds: ids }
      panels.push(panel)
    }
    record(actorId, 'Changed panel', `Event ${event.number}`)
    return panel
  })

// TODO: ranking points already computed from the old table are not recalculated in the sample
export const savePointsTable = (actorId: string, rows: PointsRow[]) =>
  settle<PointsRow[]>(() => {
    if (rows.some((r) => !Number.isInteger(r.points) || r.points < 0)) {
      throw new Error('Points must be whole numbers, zero or more.')
    }
    rows.forEach((row, i) => {
      pointsTable[i].points = row.points
    })
    record(actorId, 'Edited points table', 'Points table')
    return pointsTable
  })

function checkable(id: string) {
  const payment = found(payments.find((p) => p.id === id), 'Payment')
  if (payment.status !== PaymentStatus.ForChecking) {
    throw new Error('Only payments waiting to be checked can be decided.')
  }
  return payment
}

export const approvePayment = (adminId: string, id: string) =>
  settle<PaymentDetail>(() => {
    const payment = checkable(id)
    payment.status = PaymentStatus.Approved
    payment.rejectionReason = null
    payment.checkedBy = adminId
    payment.checkedAt = new Date().toISOString()
    const detail = paymentDetail(payment)
    record(adminId, 'Approved payment', detail.clubName)
    return detail
  })

export const rejectPayment = (adminId: string, id: string, reason: string) =>
  settle<PaymentDetail>(() => {
    const payment = checkable(id)
    const trimmed = reason.trim()
    if (!trimmed) throw new Error('Give a reason so the club knows what to fix.')
    payment.status = PaymentStatus.Rejected
    payment.rejectionReason = trimmed
    payment.checkedBy = adminId
    payment.checkedAt = new Date().toISOString()
    const detail = paymentDetail(payment)
    record(adminId, 'Rejected payment', detail.clubName)
    return detail
  })

// TODO: fake sign-in for the sample app. Phase 3 replaces this with JWT in httpOnly cookies.
const SAMPLE_PASSWORD = 'bis2026'

function settle<T>(produce: () => T): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        resolve(structuredClone(produce()))
      } catch (error) {
        reject(error)
      }
    }, LATENCY_MS),
  )
}

// Passwords set by an admin reset; everyone else uses the sample password
const passwords = new Map<string, string>()

export const signInStaff = (username: string, password: string) =>
  settle<SessionUser>(() => {
    const user = staffUsers.find((s) => s.username === username.trim().toLowerCase())
    if (!user || password !== (passwords.get(user.username) ?? SAMPLE_PASSWORD)) {
      throw new Error('Wrong username or password.')
    }
    return { id: user.id, name: user.name, role: user.role }
  })

export const signInClub = (email: string, password: string) =>
  settle<SessionUser>(() => {
    const club = clubs.find((c) => c.contactEmail === email.trim().toLowerCase())
    if (!club || password !== (clubPasswords.get(club.id) ?? SAMPLE_PASSWORD)) throw new Error('Wrong email or password.')
    return { id: club.id, name: club.name, role: Role.Club }
  })

export const signInAdjudicator = (pin: string) =>
  settle<SessionUser>(() => {
    const entry = adjudicatorPins.find(
      (p) => p.competitionId === currentCompetitionId && p.pin === pin,
    )
    const adjudicator = adjudicators.find((a) => a.id === entry?.adjudicatorId)
    if (!adjudicator) throw new Error("That PIN isn't registered for this competition.")
    return {
      id: adjudicator.id,
      name: adjudicator.name,
      role: Role.Adjudicator,
      letter: adjudicator.letter,
    }
  })

// TODO: sample-only helper for the dev sign-in hint; delete with the mocks
export const getSampleCredentials = () =>
  settle(() => ({
    password: SAMPLE_PASSWORD,
    usernames: staffUsers.map((s) => s.username),
    clubEmail: clubs[0].contactEmail,
    pins: adjudicatorPins
      .filter((p) => p.competitionId === currentCompetitionId)
      .slice(0, 3)
      .map((p) => ({
        letter: adjudicators.find((a) => a.id === p.adjudicatorId)?.letter ?? '',
        pin: p.pin,
      })),
  }))

// The sample app keeps no session across a reload; the real one reads it from the cookie
export const signOut = () => settle<null>(() => null)
export const getSession = () => settle<SessionUser | null>(() => null)

// ---- Secretariat ----

const clubName = (clubId: string) => clubs.find((c) => c.id === clubId)?.name ?? 'Unknown club'

function entryRow(entry: Entry): EntryRow {
  const competitor = found(competitors.find((c) => c.id === entry.competitorId), 'Competitor')
  const payment = payments.find((p) => p.id === entry.paymentId)
  return {
    entryId: entry.id,
    competitorId: competitor.id,
    names: competitor.names,
    backNumber: competitor.backNumber,
    clubName: clubName(competitor.clubId),
    scratched: entry.scratched,
    late: entry.late ?? false,
    paymentStatus: payment?.status ?? null,
  }
}

export const getCompetitionEntries = (competitionId: string) =>
  reply(entries.filter((e) => events.find((ev) => ev.id === e.eventId)?.competitionId === competitionId))

export const getEntryRows = (eventId: string) =>
  reply(
    entries
      .filter((e) => e.eventId === eventId)
      .map(entryRow)
      .sort((a, b) => (a.backNumber ?? Infinity) - (b.backNumber ?? Infinity)),
  )

export const setEntryScratched = (actorId: string, entryId: string, scratched: boolean) =>
  settle<EntryRow>(() => {
    const entry = found(entries.find((e) => e.id === entryId), 'Entry')
    entry.scratched = scratched
    const event = found(events.find((e) => e.id === entry.eventId), 'Event')
    const row = entryRow(entry)
    record(actorId, scratched ? 'Scratched entry' : 'Restored entry', `Event ${event.number}, ${row.names.join(' & ')}`)
    return row
  })

const competitorRow = (c: Competitor): CompetitorRow => ({
  ...c,
  clubName: clubName(c.clubId),
  entryCount: entries.filter((e) => e.competitorId === c.id && !e.scratched).length,
})

export const getCompetitorRows = () => reply(competitors.map(competitorRow))

function checkBackNumber(competitorId: string, backNumber: number | null) {
  if (backNumber === null) return
  if (!Number.isInteger(backNumber) || backNumber < 1) throw new Error('A back number is a whole number from 1.')
  const owner = competitors.find((c) => c.backNumber === backNumber && c.id !== competitorId)
  if (owner) throw new Error(`Back number ${backNumber} is already taken by ${owner.names.join(' & ')}.`)
}

function cleanNames(names: string[]) {
  const cleaned = names.map((n) => n.trim()).filter(Boolean)
  if (cleaned.length < 1 || cleaned.length > 2) throw new Error('A competitor is one dancer or a couple.')
  return cleaned
}

export const createCompetitor = (actorId: string, input: { names: string[]; clubId: string }) =>
  settle<CompetitorRow>(() => {
    const names = cleanNames(input.names)
    found(clubs.find((c) => c.id === input.clubId), 'Club')
    const competitor: Competitor = {
      id: `c-${String(competitors.length + 1).padStart(3, '0')}`,
      names,
      backNumber: null,
      clubId: input.clubId,
    }
    competitors.push(competitor)
    record(actorId, 'Added competitor', names.join(' & '))
    return competitorRow(competitor)
  })

export const setBackNumber = (actorId: string, competitorId: string, backNumber: number | null) =>
  settle<CompetitorRow>(() => {
    const competitor = found(competitors.find((c) => c.id === competitorId), 'Competitor')
    checkBackNumber(competitorId, backNumber)
    competitor.backNumber = backNumber
    record(actorId, 'Set back number', competitor.names.join(' & '))
    return competitorRow(competitor)
  })

// Gives every competitor without a back number the next free one
export const assignBackNumbers = (actorId: string) =>
  settle<number>(() => {
    const taken = new Set(competitors.map((c) => c.backNumber).filter((n): n is number => n !== null))
    let next = 1
    let assigned = 0
    for (const competitor of competitors) {
      if (competitor.backNumber !== null) continue
      while (taken.has(next)) next++
      competitor.backNumber = next
      taken.add(next)
      assigned++
    }
    record(actorId, 'Assigned back numbers', `${assigned} competitors`)
    return assigned
  })

// TODO: the backend parses the uploaded file; here the screen sends the rows it read from the CSV
export const importCompetitors = (actorId: string, rows: Array<{ names: string[]; clubName: string }>) =>
  settle<ImportResult>(() => {
    const result: ImportResult = { created: 0, skipped: [] }
    rows.forEach((row, i) => {
      const line = i + 2
      const club = clubs.find((c) => c.name.toLowerCase() === row.clubName.trim().toLowerCase())
      if (!club) return void result.skipped.push({ line, reason: `Unknown club "${row.clubName}".` })
      let names: string[]
      try {
        names = cleanNames(row.names)
      } catch (error) {
        return void result.skipped.push({ line, reason: (error as Error).message })
      }
      competitors.push({
        id: `c-${String(competitors.length + 1).padStart(3, '0')}`,
        names,
        backNumber: null,
        clubId: club.id,
      })
      result.created++
    })
    record(actorId, 'Imported competitors', `${result.created} added`)
    return result
  })

// The real server reads the uploaded file itself; the sample reads it here with the same parser
export const importCompetitorsCsv = (actorId: string, text: string) =>
  importCompetitors(actorId, parseCompetitorCsv(text))

// TODO: a competitor's age group comes from their birth date in the real system; new sample competitors have none
function checkEligible(competitorId: string, event: { isSolo: boolean; ageGroup: AgeGroup }) {
  const competitor = found(competitors.find((c) => c.id === competitorId), 'Competitor')
  if ((competitor.names.length === 1) !== event.isSolo) {
    throw new Error(event.isSolo ? 'This is a solo event.' : 'This is a couple event.')
  }
  const age = ageGroupOf.get(competitorId)
  if (age && age !== event.ageGroup) throw new Error('This competitor is in a different age group.')
}

function lateRow(entry: Entry): LateEntryRow {
  const event = found(events.find((e) => e.id === entry.eventId), 'Event')
  return {
    ...entryRow(entry),
    eventId: event.id,
    eventNumber: event.number,
    dances: event.dances,
    fee: feeFor(event),
    paymentId: entry.paymentId ?? '',
  }
}

export const getLateEntries = (competitionId: string) =>
  reply(
    entries
      .filter((e) => e.late && events.find((ev) => ev.id === e.eventId)?.competitionId === competitionId)
      .map(lateRow),
  )

// A late entry gets its own payment, either paid in cash now or left unpaid
export const createLateEntry = (
  actorId: string,
  input: { competitorId: string; eventId: string; paidInCash: boolean },
) =>
  settle<LateEntryRow>(() => {
    const event = found(events.find((e) => e.id === input.eventId), 'Event')
    const competitor = found(competitors.find((c) => c.id === input.competitorId), 'Competitor')
    checkEligible(competitor.id, event)
    if (entries.some((e) => e.eventId === event.id && e.competitorId === competitor.id)) {
      throw new Error('This competitor is already entered in the event.')
    }
    const fee = feeFor(event)
    const paymentId = `pay-late-${payments.length + 1}`
    const entry: Entry = {
      id: `${event.id}:${competitor.id}`,
      eventId: event.id,
      competitorId: competitor.id,
      scratched: false,
      paymentId,
      late: true,
    }
    payments.push({
      id: paymentId,
      clubId: competitor.clubId,
      entryIds: [entry.id],
      amountDue: fee,
      amountPaid: input.paidInCash ? fee : null,
      referenceNumber: null,
      receiptUrl: null,
      status: input.paidInCash ? PaymentStatus.PaidAtVenue : PaymentStatus.Unpaid,
      rejectionReason: null,
      checkedBy: input.paidInCash ? actorId : null,
      checkedAt: input.paidInCash ? new Date().toISOString() : null,
    })
    entries.push(entry)
    record(actorId, 'Added late entry', `Event ${event.number}, ${competitor.names.join(' & ')}`)
    return lateRow(entry)
  })

export const markPaidAtVenue = (actorId: string, paymentId: string) =>
  settle<PaymentDetail>(() => {
    const payment = found(payments.find((p) => p.id === paymentId), 'Payment')
    if (payment.status !== PaymentStatus.Unpaid && payment.status !== PaymentStatus.Rejected) {
      throw new Error('Only unpaid or rejected payments can be paid at the venue.')
    }
    payment.status = PaymentStatus.PaidAtVenue
    payment.amountPaid = payment.amountDue
    payment.rejectionReason = null
    payment.checkedBy = actorId
    payment.checkedAt = new Date().toISOString()
    const detail = paymentDetail(payment)
    record(actorId, 'Recorded cash payment', detail.clubName)
    return detail
  })

// The order events run in; starts as event number order
const scheduleOrder = new Map<string, string[]>()

function orderFor(competitionId: string): string[] {
  let order = scheduleOrder.get(competitionId)
  if (!order) {
    order = events
      .filter((e) => e.competitionId === competitionId)
      .sort((a, b) => a.number - b.number)
      .map((e) => e.id)
    scheduleOrder.set(competitionId, order)
  }
  return order
}

function scheduleOf(competitionId: string): ScheduleItem[] {
  return orderFor(competitionId).map((eventId, i) => {
    const event = found(events.find((e) => e.id === eventId), 'Event')
    return {
      eventId,
      position: i + 1,
      eventNumber: event.number,
      ageGroup: event.ageGroup,
      class: event.class,
      discipline: event.discipline,
      dances: event.dances,
      isSolo: event.isSolo,
      rounds: rounds.filter((r) => r.eventId === eventId).map((r) => ({ type: r.type, status: r.status })),
    }
  })
}

export const getSchedule = (competitionId: string) => reply(scheduleOf(competitionId))

export const moveScheduledEvent = (
  actorId: string,
  competitionId: string,
  eventId: string,
  direction: 'up' | 'down',
) =>
  settle<ScheduleItem[]>(() => {
    const order = orderFor(competitionId)
    const from = order.indexOf(eventId)
    const to = direction === 'up' ? from - 1 : from + 1
    if (from < 0 || to < 0 || to >= order.length) throw new Error('That event cannot move further.')
    ;[order[from], order[to]] = [order[to], order[from]]
    const event = found(events.find((e) => e.id === eventId), 'Event')
    record(actorId, 'Moved event in schedule', `Event ${event.number}`)
    return scheduleOf(competitionId)
  })

export const updateCompetitor = (actorId: string, id: string, input: { names: string[]; clubId: string }) =>
  settle<CompetitorRow>(() => {
    const competitor = found(competitors.find((c) => c.id === id), 'Competitor')
    const names = cleanNames(input.names)
    found(clubs.find((c) => c.id === input.clubId), 'Club')
    if ((names.length === 1) !== (competitor.names.length === 1) && entries.some((e) => e.competitorId === id)) {
      throw new Error('Remove their entries before changing between a solo dancer and a couple.')
    }
    competitor.names = names
    competitor.clubId = input.clubId
    record(actorId, 'Edited competitor', names.join(' & '))
    return competitorRow(competitor)
  })

export const deleteCompetitor = (actorId: string, id: string) =>
  settle<void>(() => {
    const index = competitors.findIndex((c) => c.id === id)
    if (index < 0) throw new Error('Competitor not found')
    if (entries.some((e) => e.competitorId === id)) {
      throw new Error('This competitor has entries. Remove or scratch them first.')
    }
    record(actorId, 'Deleted competitor', competitors[index].names.join(' & '))
    competitors.splice(index, 1)
  })

function lateEntry(entryId: string) {
  const entry = found(entries.find((e) => e.id === entryId), 'Entry')
  if (!entry.late) throw new Error('Only late entries can be changed here.')
  return entry
}

export const deleteLateEntry = (actorId: string, entryId: string) =>
  settle<void>(() => {
    const entry = lateEntry(entryId)
    const event = found(events.find((e) => e.id === entry.eventId), 'Event')
    const names = entryRow(entry).names.join(' & ')
    const payment = payments.find((p) => p.id === entry.paymentId)
    if (payment) payments.splice(payments.indexOf(payment), 1)
    entries.splice(entries.indexOf(entry), 1)
    record(actorId, 'Removed late entry', `Event ${event.number}, ${names}`)
  })

// Fixes a wrong event or payment on a late entry; the competitor stays the same
export const updateLateEntry = (actorId: string, entryId: string, input: { eventId: string; paidInCash: boolean }) =>
  settle<LateEntryRow>(() => {
    const entry = lateEntry(entryId)
    const event = found(events.find((e) => e.id === input.eventId), 'Event')
    if (event.id !== entry.eventId) {
      checkEligible(entry.competitorId, event)
      if (entries.some((e) => e.eventId === event.id && e.competitorId === entry.competitorId)) {
        throw new Error('This competitor is already entered in the event.')
      }
    }
    const payment = found(payments.find((p) => p.id === entry.paymentId), 'Payment')
    const newId = `${event.id}:${entry.competitorId}`
    payment.entryIds = payment.entryIds.map((id) => (id === entry.id ? newId : id))
    entry.id = newId
    entry.eventId = event.id
    const fee = feeFor(event)
    payment.amountDue = fee
    payment.amountPaid = input.paidInCash ? fee : null
    payment.status = input.paidInCash ? PaymentStatus.PaidAtVenue : PaymentStatus.Unpaid
    payment.checkedBy = input.paidInCash ? actorId : null
    payment.checkedAt = input.paidInCash ? new Date().toISOString() : null
    record(actorId, 'Edited late entry', `Event ${event.number}, ${entryRow(entry).names.join(' & ')}`)
    return lateRow(entry)
  })

function checkEvent(competitionId: string, input: EventInput, id?: string) {
  if (!Number.isInteger(input.number) || input.number < 1) throw new Error('The event number is a whole number from 1.')
  if (events.some((e) => e.competitionId === competitionId && e.number === input.number && e.id !== id)) {
    throw new Error(`Event ${input.number} already exists in this competition.`)
  }
  if (input.dances.length === 0) throw new Error('Choose at least one dance.')
  const allowed = DISCIPLINE_DANCES[input.discipline]
  if (input.dances.some((d) => !allowed.includes(d))) {
    throw new Error(`These dances do not belong to ${input.discipline}.`)
  }
}

export const saveEvent = (actorId: string, competitionId: string, input: EventInput, id?: string) =>
  settle<Event>(() => {
    found(competitions.find((c) => c.id === competitionId), 'Competition')
    checkEvent(competitionId, input, id)
    if (id) {
      const event = found(events.find((e) => e.id === id), 'Event')
      if (event.isSolo !== input.isSolo && entries.some((e) => e.eventId === id)) {
        throw new Error('Remove the entries before changing between solo and couple.')
      }
      Object.assign(event, input)
      record(actorId, 'Edited event', `Event ${event.number}`)
      return event
    }
    const event: Event = { id: `${competitionId}:e${input.number}`, competitionId, ...input }
    events.push(event)
    // orderFor builds the order from the events on first use, so the new one may already be in it
    const order = orderFor(competitionId)
    if (!order.includes(event.id)) order.push(event.id)
    record(actorId, 'Created event', `Event ${event.number}`)
    return event
  })

export const deleteEvent = (actorId: string, id: string) =>
  settle<void>(() => {
    const event = found(events.find((e) => e.id === id), 'Event')
    if (entries.some((e) => e.eventId === id) || rounds.some((r) => r.eventId === id)) {
      throw new Error('This event has entries or rounds. Remove them first.')
    }
    const order = orderFor(event.competitionId)
    order.splice(order.indexOf(id), 1)
    const panel = panels.findIndex((p) => p.eventId === id)
    if (panel >= 0) panels.splice(panel, 1)
    events.splice(events.indexOf(event), 1)
    record(actorId, 'Deleted event', `Event ${event.number}`)
  })

// ---- Adjudicator ----

export const getAdjudicatorState = (adjudicatorId: string) => reply(adjudicatorState(adjudicatorId))

export const submitAdjudicatorMarks = (adjudicatorId: string, roundId: string, submissions: MarkSubmission[]) =>
  settle<void>(() => submitMarks(adjudicatorId, roundId, submissions))

// TODO: dev-only controls that stand in for the scrutineer starting a round
export const getDemoRounds = () => reply(demoRounds())
export const startDemoRoundOnFloor = (roundId: string | null) => settle<void>(() => startDemoRound(roundId))

// Typing in a paper sheet: the sample takes it the same way as a phone's marks
export const getMarkingTask = (roundId: string) => reply(found(taskFor(roundId) ?? undefined, 'Round'))
export const enterAdjudicatorMarks = (_actorId: string, adjudicatorId: string, roundId: string, submissions: MarkSubmission[]) =>
  settle<void>(() => submitMarks(adjudicatorId, roundId, submissions))

// The sample rounds are all planned already; starting one puts it on the adjudicators' phones
export const planRounds = (_actorId: string, _competitionId: string) => settle<number>(() => 0)
export const startRound = (actorId: string, roundId: string) =>
  settle<void>(() => {
    startDemoRound(roundId)
    record(actorId, 'Started round', roundId)
  })
export const clearFloor = (actorId: string, _competitionId?: string) =>
  settle<void>(() => {
    startDemoRound(null)
    record(actorId, 'Cleared the floor', 'Floor')
  })

export const getBackupStatus = () =>
  reply<BackupStatus>({
    targets: [
      { path: 'USB drive', ok: true, lastBackupAt: new Date().toISOString(), error: null },
      { path: 'Laptop 3', ok: true, lastBackupAt: new Date().toISOString(), error: null },
    ],
    lastBackupAt: new Date().toISOString(),
  })

// ---- Scrutineer ----

export const getCurrentRoundId = () => reply(currentRoundId())
export const getCompetitionRounds = (competitionId: string) => reply(roundRows(competitionId))
export const getHeatAssignments = (roundId: string) => reply(heatAssignments(roundId))

export const saveHeats = (actorId: string, roundId: string, assignments: HeatAssignment[]) =>
  settle<void>(() => {
    saveHeatAssignments(roundId, assignments)
    record(actorId, 'Set heats', roundId)
  })

export const getRecallTable = (roundId: string) => reply(recallTable(roundId))

export const proposeTieDecision = (actorId: string, roundId: string, choice: TieDecision['choice']) =>
  settle<void>(() => {
    proposeTie(actorId, roundId, choice)
    record(actorId, 'Proposed tie decision', roundId)
  })

export const confirmTieDecision = (actorId: string, roundId: string) =>
  settle<void>(() => {
    confirmTie(actorId, roundId)
    record(actorId, 'Confirmed tie decision', roundId)
  })

// The sample finals have no shared places, so there is never a final tie to decide
export const getFinalTie = (roundId: string) => reply<FinalTie>({ roundId, groups: [], decision: null })
export const proposeFinalTie = (_actorId: string, _roundId: string, _mode: 'keep' | 'order', _order: string[]) => settle<void>(() => undefined)
export const confirmFinalTie = (_actorId: string, _roundId: string) => settle<void>(() => undefined)

export const getSkatingTable = (roundId: string) => reply(skatingTable(roundId))

export const approveRound = (actorId: string, roundId: string) =>
  settle<void>(() => {
    approveRoundResults(actorId, roundId)
    record(actorId, 'Approved round', roundId)
  })

export const publishRound = (actorId: string, roundId: string) =>
  settle<void>(() => {
    publishRoundResults(actorId, roundId)
    record(actorId, 'Published round', roundId)
  })

// ---- MC ----

export const getAnnouncements = () => reply(announcements())

// ---- Public ----

// Events that already have results, so the public site only links to what can be shown
export const getResultEventIds = (competitionId: string) =>
  reply(
    events
      .filter((e) => e.competitionId === competitionId && results.some((r) => r.eventId === e.id))
      .map((e) => e.id),
  )

// ---- Club portal ----

export const signUpNewClub = (input: ClubSignUp) => settle<SessionUser>(() => signUpClub(input))
export const getClubDancers = (clubId: string) => reply(clubDancers(clubId))
export const saveClubDancer = (clubId: string, input: { names: string[]; ageGroup: AgeGroup }, id?: string) =>
  settle(() => saveDancer(clubId, input, id))
export const deleteClubDancer = (clubId: string, id: string) => settle<void>(() => deleteDancer(clubId, id))
export const getEntryOptions = (clubId: string, dancerId: string) => reply(entryOptions(clubId, dancerId))
export const registerClubEntries = (clubId: string, dancerId: string, eventIds: string[]) =>
  settle<void>(() => registerEntries(clubId, dancerId, eventIds))
export const getClubPayments = (clubId: string) => reply(clubPayments(clubId))
export const getPaymentMethods = () => reply(paymentMethods())
export const submitClubPayment = (clubId: string, input: { amountPaid: number; referenceNumber: string; receiptUrl: string }) =>
  settle<void>(() => submitPaymentProof(clubId, input))

// ---- Syncing with the cloud ----
// The sample venue is connected to a sample cloud: downloading holds a competition, releasing lets it go.

const sampleSync = { held: [] as string[], pending: 0 }

const syncStatus = (): SyncStatus => ({
  enabled: true,
  venueId: 'sample-venue',
  cloudUrl: 'https://cloud.example',
  pending: sampleSync.pending,
  failing: 0,
  lastUploadAt: sampleSync.held.length ? new Date().toISOString() : null,
  lastError: null,
  reachable: true,
  held: [...sampleSync.held],
})

export const getSyncStatus = () => reply(syncStatus())
export const getCloudCompetitions = () =>
  reply<CloudCompetition[]>(
    competitions.map((c) => ({
      id: c.id,
      name: c.name,
      date: c.date,
      venue: c.venue,
      organizer: c.organizer,
      heldBy: sampleSync.held.includes(c.id) ? 'sample-venue' : null,
      heldAt: sampleSync.held.includes(c.id) ? new Date().toISOString() : null,
      entries: entries.filter((e) => events.find((ev) => ev.id === e.eventId)?.competitionId === c.id).length,
    })),
  )
export const pullCompetition = (competitionId: string) =>
  settle<PullSummary>(() => {
    found(competitions.find((c) => c.id === competitionId), 'Competition')
    if (!sampleSync.held.includes(competitionId)) sampleSync.held.push(competitionId)
    return { competitionId, added: { entries: 0 }, excludedEntries: 0 }
  })
export const syncNow = () =>
  settle<SyncStatus>(() => {
    sampleSync.pending = 0
    return syncStatus()
  })
export const uploadCompetition = (competitionId: string) =>
  settle<SyncStatus>(() => {
    found(competitions.find((c) => c.id === competitionId), 'Competition')
    return syncStatus()
  })
export const releaseCompetition = (competitionId: string) =>
  settle<void>(() => {
    sampleSync.held = sampleSync.held.filter((id) => id !== competitionId)
  })
export const unlockCompetition = (competitionId: string) => releaseCompetition(competitionId)

// ---- Fees, payment details and club accounts ----

let samplePaymentSettings: PaymentSettings = { fees: { solo: 500, couple: 800 }, methods: paymentMethods() }

export const getPaymentSettings = () => reply(samplePaymentSettings)
export const savePaymentSettings = (actorId: string, input: PaymentSettings) =>
  settle<PaymentSettings>(() => {
    samplePaymentSettings = structuredClone(input)
    record(actorId, 'Changed fees and payment details', 'Payment settings')
    return samplePaymentSettings
  })
export const changeClubPassword = (_current: string, _next: string) => settle<void>(() => undefined)
export const resetClubPassword = (actorId: string, id: string) =>
  settle<{ tempPassword: string }>(() => {
    const club = found(clubs.find((c) => c.id === id), 'Club')
    record(actorId, 'Reset a club password', club.name)
    return { tempPassword: tempPassword() }
  })
export const eraseClubAccount = (actorId: string, id: string) =>
  settle<void>(() => {
    const club = found(clubs.find((c) => c.id === id), 'Club')
    Object.assign(club, { contactName: 'Removed', contactEmail: `removed-${id}@removed.invalid`, contactPhone: '' })
    record(actorId, 'Erased a club account', club.name)
  })
let sampleMessengerLinked = false
export const getMessengerLink = () =>
  reply<MessengerLink>({ available: true, linked: sampleMessengerLinked, url: sampleMessengerLinked ? null : 'https://m.me/SamplePage?ref=sample' })
export const unlinkMessenger = () =>
  settle<void>(() => {
    sampleMessengerLinked = false
  })
export const clearOldReceipts = (actorId: string) =>
  settle<number>(() => {
    record(actorId, 'Removed old payment proofs', '0 proofs')
    return 0
  })
