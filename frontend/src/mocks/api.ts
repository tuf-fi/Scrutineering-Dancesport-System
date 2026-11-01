import { ApiError } from '../api/http.ts'
import {
  DEFAULT_FEE_SCHEDULE,
  DISCIPLINE_DANCES,
  EventKind,
  PIN_LENGTH,
  PayMethod,
  registrationFee,
  registrationWarnings,
  sameProvince,
  type AccountKind,
  type TotpSetup,
  type TotpStatus,
  parseCompetitorCsv,
  PaymentStatus,
  Role,
  RoundStatus,
  type Adjudicator,
  type AthleteInput,
  type AthletePage,
  type AthleteProfile,
  type AthleteRow,
  type CompetitionInput,
  type Coach,
  type CoachInput,
  type CompetitorCsvRow,
  type CompetitorDetails,
  type EventInput,
  type RankingFilter,
  type RegistrationInput,
  type RegistrationQuote,
  type RegistrationResult,
  type AdjudicatorPin,
  type AgeGroup,
  type BackupStatus,
  type Club,
  type ClubInput,
  type PaymentMethod,
  type PaymentSettings,
  type Competition,
  type Competitor,
  type CompetitorRow,
  type HeatAssignment,
  type MarkSubmission,
  type RoundSignature,
  type FinalTie,
  type TieDecision,
  type Entry,
  type EntryRow,
  type Event,
  type ImportResult,
  type LateEntryRow,
  type ScheduleItem,
  type Program,
  type ProgramKind,
  type ProgramSlotInput,
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
import * as sampleProgram from './program.ts'

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
            placeFrom: r.placeFrom,
            placeTo: r.placeTo,
            points: rankingPoints.find((p) => p.id === `rp:${r.id}`)?.points ?? 0,
          } satisfies CompetitorHistoryLine,
        ]
      })
      .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate) || a.eventNumber - b.eventNumber),
  )

export const getStaffUsers = () => reply(staffUsers.map((s) => ({ ...s, twoStep: totpOf(s.id).enabled })))
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
      entryDeadline: input.entryDeadline || null,
      feeDeadline: input.feeDeadline || null,
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

export const revokeSessions = (actorId: string, kind: AccountKind, id: string) =>
  settle<void>(() => {
    record(actorId, 'Signed out everywhere', `${kind} ${id}`)
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
        const pin = String(10 ** (PIN_LENGTH - 1) + Math.floor(Math.random() * 9 * 10 ** (PIN_LENGTH - 1)))
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

// Two-step sign-in in the sample: the "authenticator app" always shows this code
export const SAMPLE_TOTP_CODE = '123456'
const sampleTotp = new Map<string, { enabled: boolean; secret: string | null; recovery: number }>()
const totpOf = (id: string) => sampleTotp.get(id) ?? { enabled: false, secret: null, recovery: 0 }

export const signInStaff = (username: string, password: string, code?: string) =>
  settle<SessionUser>(() => {
    const user = staffUsers.find((s) => s.username === username.trim().toLowerCase())
    if (!user || password !== (passwords.get(user.username) ?? SAMPLE_PASSWORD)) {
      throw new Error('Wrong username or password.')
    }
    if (totpOf(user.id).enabled) {
      if (!code) throw new ApiError(428, 'Enter the 6-digit code from your authenticator app, or a recovery code.')
      if (code.trim() !== SAMPLE_TOTP_CODE) throw new Error('That code is not right.')
    }
    return { id: user.id, name: user.name, role: user.role }
  })

export const getTotpStatus = (actorId: string) => reply<TotpStatus>({ enabled: totpOf(actorId).enabled, recoveryLeft: totpOf(actorId).recovery })
export const startTotpSetup = (actorId: string) =>
  settle<TotpSetup>(() => {
    if (totpOf(actorId).enabled) throw new Error('Two-step sign-in is already on.')
    const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'
    sampleTotp.set(actorId, { enabled: false, secret, recovery: 0 })
    return { secret, uri: `otpauth://totp/BIS%3A${actorId}?secret=${secret}&issuer=BIS&algorithm=SHA1&digits=6&period=30` }
  })
export const confirmTotpSetup = (actorId: string, code: string) =>
  settle<{ recoveryCodes: string[] }>(() => {
    const state = totpOf(actorId)
    if (!state.secret) throw new Error('Start the set-up first.')
    if (code.trim() !== SAMPLE_TOTP_CODE) throw new Error('That code is not right. Check the app and try again.')
    sampleTotp.set(actorId, { enabled: true, secret: state.secret, recovery: 8 })
    return { recoveryCodes: ['ABCDE-FGHJK', 'KLMNP-QRSTU', 'VWXYZ-23456', '789AB-CDEFG', 'HJKLM-NPQRS', 'TUVWX-YZ234', '56789-ABCDE', 'FGHJK-LMNPQ'] }
  })
export const disableTotp = (actorId: string, password: string, code: string) =>
  settle<void>(() => {
    const user = staffUsers.find((s) => s.id === actorId)
    if (!user || password !== (passwords.get(user.username) ?? SAMPLE_PASSWORD)) throw new Error('The password is not right.')
    if (code.trim() !== SAMPLE_TOTP_CODE) throw new Error('That code is not right.')
    sampleTotp.delete(actorId)
  })
export const resetTotp = (actorId: string, id: string) =>
  settle<void>(() => {
    if (!totpOf(id).enabled) throw new Error('Two-step sign-in is not on for this account.')
    sampleTotp.delete(id)
    record(actorId, 'Reset two-step sign-in', id)
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

export const createCompetitor = (actorId: string, input: { names: string[]; clubId: string; details?: CompetitorDetails }) =>
  settle<CompetitorRow>(() => {
    const names = cleanNames(input.names)
    found(clubs.find((c) => c.id === input.clubId), 'Club')
    const competitor: Competitor = {
      id: `c-${String(competitors.length + 1).padStart(3, '0')}`,
      names,
      backNumber: null,
      clubId: input.clubId,
      ...(input.details ? { details: input.details } : {}),
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
export const importCompetitors = (actorId: string, rows: CompetitorCsvRow[]) =>
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
      let details: CompetitorDetails | undefined
      if (row.details) {
        const coach = coaches.find((c) => c.name.toLowerCase() === row.details!.coachName.trim().toLowerCase())
        if (row.details.coachName.trim() && !coach) return void result.skipped.push({ line, reason: `Unknown coach "${row.details.coachName}".` })
        if (row.details.dancers.some((d) => d.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(d.birthDate))) {
          return void result.skipped.push({ line, reason: 'Enter each date of birth as year-month-day.' })
        }
        details = {
          province: row.details.province.trim(),
          coachId: coach?.id ?? null,
          dancers: names.map((_, i) => row.details!.dancers[i] ?? { birthDate: '', address: '', email: '', phone: '' }),
          beginner: row.details.beginner,
          memberYear: null,
        }
      }
      competitors.push({
        id: `c-${String(competitors.length + 1).padStart(3, '0')}`,
        names,
        backNumber: null,
        clubId: club.id,
        ...(details ? { details } : {}),
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
function checkEligible(competitorId: string, event: { number: number; isSolo: boolean; ageGroup: AgeGroup; kind?: EventKind; province?: string }) {
  const competitor = found(competitors.find((c) => c.id === competitorId), 'Competitor')
  if ((competitor.names.length === 1) !== event.isSolo) {
    throw new Error(event.isSolo ? 'This is a solo event.' : 'This is a couple event.')
  }
  const age = ageGroupOf.get(competitorId)
  if (age && age !== event.ageGroup) throw new Error('This competitor is in a different age group.')
  if (event.kind === EventKind.Closed && !sameProvince(competitor.details?.province, event.province)) {
    throw new Error(`E${event.number} is closed to ${event.province}. This entry is from ${competitor.details?.province?.trim() || 'no province'}.`)
  }
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

// ---- Coaches and registration ----

const coaches: Coach[] = [
  { id: 'coach-1', name: 'Ramon Villanueva', email: 'ramon@example.test', phone: '0917 000 0001', memberYear: null, summitYear: null },
]

export const getCoaches = () => reply([...coaches].sort((a, b) => a.name.localeCompare(b.name)))

export const saveCoach = (actorId: string, input: CoachInput, id?: string) =>
  settle<Coach>(() => {
    const name = input.name.trim()
    if (!name) throw new Error('Enter the coach\u2019s name.')
    const values = { ...input, name }
    if (id) {
      const coach = found(coaches.find((c) => c.id === id), 'Coach')
      Object.assign(coach, values)
      record(actorId, 'Edited coach', name)
      return coach
    }
    const coach: Coach = { id: `coach-${coaches.length + 1}`, ...values }
    coaches.push(coach)
    record(actorId, 'Added coach', name)
    return coach
  })

export const deleteCoach = (actorId: string, id: string) =>
  settle<void>(() => {
    const coach = found(coaches.find((c) => c.id === id), 'Coach')
    if (competitors.some((c) => c.details?.coachId === id)) throw new Error('This coach has competitors. Change their coach first.')
    coaches.splice(coaches.indexOf(coach), 1)
    record(actorId, 'Deleted coach', coach.name)
  })

function priceRegistration(competitorId: string, eventIds: string[], coachFees = { membership: false, summit: false }) {
  const competitor = found(competitors.find((c) => c.id === competitorId), 'Competitor')
  const chosen = [...new Set(eventIds)].map((id) => found(events.find((e) => e.id === id), 'Event'))
  if (chosen.length === 0) throw new Error('Choose at least one event.')
  const competition = found(competitions.find((c) => c.id === chosen[0].competitionId), 'Competition')
  const year = Number(competition.date.slice(0, 4))
  const members = competitor.details?.memberYear === year ? 0 : competitor.names.length
  const fixed: string[] = [EventKind.Ranking, EventKind.InterCollegiate]
  const prior = entries.filter((e) => {
    const event = events.find((x) => x.id === e.eventId)
    return e.competitorId === competitorId && !e.scratched && event?.competitionId === competition.id && !fixed.includes(event.kind ?? '')
  }).length
  const coachRow = coaches.find((c) => c.id === competitor.details?.coachId)
  const coach = coachRow
    ? { name: coachRow.name, membershipDue: coachRow.memberYear !== year, summitDue: coachRow.summitYear !== year }
    : undefined
  const collect = { membership: Boolean(coach?.membershipDue && coachFees.membership), summit: Boolean(coach?.summitDue && coachFees.summit) }
  const { lines, total } = registrationFee(DEFAULT_FEE_SCHEDULE, chosen, members, prior, collect)
  return {
    competitor,
    chosen,
    year,
    members,
    collect,
    coachRow,
    quote: { lines, total, warnings: registrationWarnings(competitor.details, competitor.names.length, chosen, year), ...(coach ? { coach } : {}) },
  }
}

export const quoteRegistration = (competitorId: string, eventIds: string[], coachFees?: { membership: boolean; summit: boolean }) =>
  settle<RegistrationQuote>(() => priceRegistration(competitorId, eventIds, coachFees).quote)

export const registerCompetitor = (actorId: string, input: RegistrationInput) =>
  settle<RegistrationResult>(() => {
    const { competitor, chosen, year, members, collect, coachRow, quote } = priceRegistration(input.competitorId, input.eventIds, input.coachFees)
    for (const event of chosen) {
      checkEligible(competitor.id, event)
      if (entries.some((e) => e.eventId === event.id && e.competitorId === competitor.id)) {
        throw new Error(`Already entered in E${event.number}.`)
      }
    }
    const paid = input.method !== PayMethod.Unpaid
    const paymentId = `pay-reg-${payments.length + 1}`
    const made = chosen.map((event): Entry => ({ id: `${event.id}:${competitor.id}`, eventId: event.id, competitorId: competitor.id, scratched: false, paymentId, late: false }))
    payments.push({
      id: paymentId,
      clubId: competitor.clubId,
      entryIds: made.map((e) => e.id),
      amountDue: quote.total,
      amountPaid: paid ? quote.total : null,
      referenceNumber: paid ? (input.reference?.trim() ?? '') || null : null,
      receiptUrl: null,
      status: !paid ? PaymentStatus.Unpaid : input.method === PayMethod.Cash ? PaymentStatus.PaidAtVenue : PaymentStatus.Approved,
      rejectionReason: null,
      checkedBy: paid ? actorId : null,
      checkedAt: paid ? new Date().toISOString() : null,
    })
    entries.push(...made)
    // TODO: the sample records memberships only when paid at once; the real server also records them when a later payment is paid
    if (paid && members > 0 && competitor.details) competitor.details = { ...competitor.details, memberYear: year }
    if (paid && coachRow) {
      if (collect.membership) coachRow.memberYear = year
      if (collect.summit) coachRow.summitYear = year
    }
    record(actorId, 'Registered entries', competitor.names.join(' & '))
    return { ...quote, paymentId }
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

export const getProgram = (competitionId: string) => reply(sampleProgram.programOf(competitionId))
export const getEntriesByBackNumber = (competitionId: string, backNumber: number) =>
  reply(
    entries
      .filter(
        (e) =>
          !e.scratched &&
          competitors.find((c) => c.id === e.competitorId)?.backNumber === backNumber &&
          events.find((ev) => ev.id === e.eventId)?.competitionId === competitionId,
      )
      .map((e) => e.eventId),
  )
export const setProgramStart = (actorId: string, competitionId: string, start: string | null) =>
  settle<Program>(() => {
    record(actorId, 'Set program start', competitionId)
    return sampleProgram.setStart(competitionId, start)
  })
export const generateProgram = (actorId: string, competitionId: string) =>
  settle<Program>(() => {
    record(actorId, 'Generated program', competitionId)
    return sampleProgram.generate(competitionId)
  })
export const addProgramBreak = (
  actorId: string,
  competitionId: string,
  input: { kind: ProgramKind; label: string; minutes: number; afterSequence?: number },
) =>
  settle<Program>(() => {
    record(actorId, 'Added to program', input.label)
    return sampleProgram.addBreak(competitionId, input)
  })
export const updateProgramSlot = (actorId: string, slotId: string, input: ProgramSlotInput) =>
  settle<Program>(() => {
    record(actorId, 'Edited program line', slotId)
    return sampleProgram.updateSlot(slotId, input)
  })
export const moveProgramSlot = (actorId: string, slotId: string, direction: 'up' | 'down') =>
  settle<Program>(() => {
    record(actorId, 'Moved program line', slotId)
    return sampleProgram.moveSlot(slotId, direction)
  })
export const removeProgramSlot = (actorId: string, slotId: string) =>
  settle<Program>(() => {
    record(actorId, 'Removed program line', slotId)
    return sampleProgram.removeSlot(slotId)
  })

export const updateCompetitor = (actorId: string, id: string, input: { names: string[]; clubId: string; details?: CompetitorDetails }) =>
  settle<CompetitorRow>(() => {
    const competitor = found(competitors.find((c) => c.id === id), 'Competitor')
    const names = cleanNames(input.names)
    found(clubs.find((c) => c.id === input.clubId), 'Club')
    if ((names.length === 1) !== (competitor.names.length === 1) && entries.some((e) => e.competitorId === id)) {
      throw new Error('Remove their entries before changing between a solo dancer and a couple.')
    }
    competitor.names = names
    competitor.clubId = input.clubId
    if (input.details) competitor.details = input.details
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
  if (input.kind === EventKind.Closed && !input.province?.trim()) throw new Error('Enter the province this event is closed to.')
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

export const submitAdjudicatorMarks = (adjudicatorId: string, roundId: string, submissions: MarkSubmission[], _signature?: string) =>
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
      { path: '/data/backups', ok: true, lastBackupAt: new Date().toISOString(), error: null },
      { path: '/mnt/offsite', ok: true, lastBackupAt: new Date().toISOString(), error: null },
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
// TODO: the sample keeps no signatures; the real server stores them
export const getSignatures = (_roundId: string) => reply<RoundSignature[]>([])

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
// ---- Fees and payment details ----

const sampleMethods: PaymentMethod[] = [
  { name: 'GCash', accountName: 'BN IT Scrutineer', number: '0917 000 0000' },
  { name: 'Maya', accountName: 'BN IT Scrutineer', number: '0918 000 0000' },
  { name: 'Bank transfer', accountName: 'BN IT Scrutineer', number: '0000 0000 0000', note: 'BDO Savings, Sorsogon branch' },
]
let samplePaymentSettings: PaymentSettings = { fees: { solo: 500, couple: 800 }, methods: sampleMethods, schedule: DEFAULT_FEE_SCHEDULE }

export const getPaymentSettings = () => reply(samplePaymentSettings)
export const savePaymentSettings = (actorId: string, input: PaymentSettings) =>
  settle<PaymentSettings>(() => {
    samplePaymentSettings = { ...structuredClone(input), schedule: structuredClone(input.schedule ?? samplePaymentSettings.schedule ?? DEFAULT_FEE_SCHEDULE) }
    record(actorId, 'Changed fees and payment details', 'Payment settings')
    return samplePaymentSettings
  })

// ---- Athletes ----

interface SampleAthlete extends AthleteProfile {
  password: string
}
const sampleAthletes: SampleAthlete[] = []

const membershipYear = () => Number(competitions.find((c) => c.id === currentCompetitionId)?.date.slice(0, 4) ?? 2026)
const athleteOf = (id: string) => found(sampleAthletes.find((a) => a.id === id), 'Athlete')
const publicAthlete = ({ password: _password, ...profile }: SampleAthlete): AthleteProfile => profile

export const signUpAthlete = (name: string, email: string, password: string) =>
  settle<SessionUser>(() => {
    const address = email.trim().toLowerCase()
    if (!name.trim()) throw new Error('Enter your name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.')
    if (password.length < 8) throw new Error('Use a password of at least 8 characters.')
    if (sampleAthletes.some((a) => a.email === address)) throw new Error('An account with this email already exists. Sign in instead.')
    const athlete: SampleAthlete = {
      id: `athlete-${sampleAthletes.length + 1}`,
      email: address,
      name: name.trim(),
      birthDate: '',
      phone: '',
      address: '',
      province: '',
      clubId: null,
      coachId: null,
      memberYear: null,
      request: null,
      password,
    }
    sampleAthletes.push(athlete)
    return { id: athlete.id, name: athlete.name, role: Role.Athlete }
  })

export const signInAthlete = (email: string, password: string) =>
  settle<SessionUser>(() => {
    const athlete = sampleAthletes.find((a) => a.email === email.trim().toLowerCase())
    if (!athlete || athlete.password !== password) throw new Error('Wrong email or password.')
    return { id: athlete.id, name: athlete.name, role: Role.Athlete }
  })

export const getMyAthlete = (athleteId: string) =>
  reply<AthletePage>({
    profile: publicAthlete(athleteOf(athleteId)),
    year: membershipYear(),
    fee: (samplePaymentSettings.schedule ?? DEFAULT_FEE_SCHEDULE).athleteMembership,
    methods: samplePaymentSettings.methods,
  })

export const saveMyAthlete = (athleteId: string, input: AthleteInput) =>
  settle<AthleteProfile>(() => {
    const athlete = athleteOf(athleteId)
    if (!input.name.trim()) throw new Error('Enter your name.')
    if (input.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.birthDate)) throw new Error('Enter a valid date of birth.')
    if (input.clubId && !clubs.some((c) => c.id === input.clubId)) throw new Error('Choose a club from the list.')
    Object.assign(athlete, { ...input, name: input.name.trim() })
    return publicAthlete(athlete)
  })

export const requestMembership = (athleteId: string, input: { method: string; reference: string }) =>
  settle<AthleteProfile>(() => {
    const athlete = athleteOf(athleteId)
    const year = membershipYear()
    if (athlete.memberYear === year) throw new Error(`Your ${year} membership is already paid.`)
    if (athlete.request && !athlete.request.rejectedReason) throw new Error('You already sent a payment. Wait for the secretariat to confirm it.')
    if (!input.method.trim()) throw new Error('Say how you paid.')
    if (!input.reference.trim()) throw new Error('Enter the reference number of your payment.')
    athlete.request = { year, method: input.method.trim(), reference: input.reference.trim(), requestedAt: new Date().toISOString() }
    return publicAthlete(athlete)
  })

export const getAthletes = () =>
  reply<AthleteRow[]>(
    [...sampleAthletes]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        phone: a.phone,
        clubName: clubs.find((c) => c.id === a.clubId)?.name ?? '',
        coachName: coaches.find((c) => c.id === a.coachId)?.name ?? '',
        memberYear: a.memberYear,
        request: a.request,
      })),
  )

export const confirmMembership = (actorId: string, id: string) =>
  settle<void>(() => {
    const athlete = athleteOf(id)
    if (!athlete.request || athlete.request.rejectedReason) throw new Error('This athlete has no payment waiting.')
    athlete.memberYear = athlete.request.year
    athlete.request = null
    record(actorId, 'Confirmed membership', athlete.name)
  })

export const rejectMembership = (actorId: string, id: string, reason: string) =>
  settle<void>(() => {
    const athlete = athleteOf(id)
    if (!athlete.request) throw new Error('This athlete has no payment waiting.')
    if (!reason.trim()) throw new Error('Say why it could not be confirmed.')
    athlete.request = { ...athlete.request, rejectedReason: reason.trim() }
    record(actorId, 'Turned down a membership payment', athlete.name)
  })

export const resetAthletePassword = (actorId: string, id: string) =>
  settle<{ tempPassword: string }>(() => {
    const athlete = athleteOf(id)
    athlete.password = 'temp1234'
    record(actorId, 'Reset an athlete password', athlete.name)
    return { tempPassword: athlete.password }
  })

export const deleteAthlete = (actorId: string, id: string) =>
  settle<void>(() => {
    const athlete = athleteOf(id)
    sampleAthletes.splice(sampleAthletes.indexOf(athlete), 1)
    record(actorId, 'Deleted an athlete account', athlete.name)
  })

// ---- Clubs ----

export const saveClub = (actorId: string, input: ClubInput, id?: string) =>
  settle<Club>(() => {
    const name = input.name.trim()
    if (!name) throw new Error('Enter the club name.')
    if (clubs.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== id)) throw new Error('A club with this name already exists.')
    const values = { name, contactName: input.contactName.trim(), contactEmail: input.contactEmail.trim(), contactPhone: input.contactPhone.trim() }
    if (id) {
      const club = found(clubs.find((c) => c.id === id), 'Club')
      Object.assign(club, values)
      record(actorId, 'Edited club', name)
      return club
    }
    const club: Club = { id: `club-${clubs.length + 1}`, ...values }
    clubs.push(club)
    record(actorId, 'Added club', name)
    return club
  })

export const deleteClub = (actorId: string, id: string) =>
  settle<void>(() => {
    const club = found(clubs.find((c) => c.id === id), 'Club')
    if (competitors.some((c) => c.clubId === id)) throw new Error('This club has competitors. Move or delete them first.')
    clubs.splice(clubs.indexOf(club), 1)
    record(actorId, 'Deleted club', club.name)
  })
