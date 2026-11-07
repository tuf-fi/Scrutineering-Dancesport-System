import { ApiError } from '../api/http.ts'
import {
  DEFAULT_FEE_SCHEDULE,
  type DeleteImpact,
  type DeleteImpactItem,
  type DeleteKind,
  DISCIPLINE_DANCES,
  PIN_LENGTH,
  PayMethod,
  checkAgeGroup,
  checkEventKind,
  freshId,
  isFixedFee,
  kindOf,
  registrationFee,
  registrationWarnings,
  sameProvince,
  type AccountKind,
  type AgeGroupDef,
  type AgeGroupInput,
  type EventKindDef,
  type EventKindInput,
  type TotpSetup,
  type TotpStatus,
  parseCompetitorCsv,
  PaymentStatus,
  Role,
  RoundStatus,
  type Adjudicator,
  type AthleteInput,
  type AthletePage,
  type AlertNote,
  type EntryRequest,
  type EntryRequestInput,
  type MemberAccount,
  type MemberRosterRow,
  listedInBicolAthletes,
  type BarkerBoard,
  type MemberChangeRequest,
  type MemberChangeRow,
  type MemberClaimRow,
  type MemberInput,
  type MemberRoster,
  type AthleteProfile,
  type AdjudicatorAssignment,
  type AthleteNotification,
  type AthleteRow,
  type MyActivity,
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
  type Team,
  type TeamInput,
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
import { teams } from './data/teams.ts'
import { competitions, currentCompetitionId } from './data/competitions.ts'
import { ageGroupOf, competitors } from './data/competitors.ts'
import { entries } from './data/entries.ts'
import { events } from './data/events.ts'
import { ageGroups, eventKinds } from './data/catalog.ts'
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
import { heats, marks, rounds } from './data/progress.ts'
import { pointsTable, rankingPoints, results } from './data/results.ts'
import { auditLog, staffUsers } from './data/staff.ts'
import { isLiveRound, liveRoundComplete, visibleMarks } from './realtime.ts'
import * as sampleProgram from './program.ts'

export type { AgeGroupInput, CompetitionInput, EventInput, EventKindInput, RankingFilter } from '@bis/shared'
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
export const getTeams = () => reply(teams)

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

// The kinds in the admin's order and the age groups from the youngest to the oldest
const catalog = () => ({ kinds: eventKinds, ageGroups: [...ageGroups].sort((a, b) => (a.oldestAge ?? Infinity) - (b.oldestAge ?? Infinity)) })
export const getCatalog = () => reply(catalog())

// TODO: the sample has no barker account, so its board is empty
export const getBarkerBoard = () => reply<BarkerBoard>({ competitionName: null, ongoing: [], next: null })

// The sample dancers carry no gender, so a sample junior solo counts as female here
export const getBicolAthleteIds = () =>
  reply(
    [
      ...new Set(
        rankingPoints
          .filter((p) => {
            const solo = competitors.find((c) => c.id === p.competitorId)?.names.length === 1
            return listedInBicolAthletes(p.ageGroup, solo, solo ? 'female' : undefined)
          })
          .map((p) => p.competitorId),
      ),
    ],
  )

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
            eventId: event.id,
            competitorId: r.competitorId,
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
export const getAdjudicatorAssignments = (adjudicatorId: string) =>
  reply<AdjudicatorAssignment[]>(
    panels
      .filter((p) => p.adjudicatorIds.includes(adjudicatorId))
      .flatMap((p) => {
        const event = events.find((e) => e.id === p.eventId)
        const competition = competitions.find((c) => c.id === event?.competitionId)
        if (!event || !competition) return []
        const roundIds = rounds.filter((r) => r.eventId === event.id).map((r) => r.id)
        return [
          {
            competitionId: competition.id,
            competitionName: competition.name,
            competitionDate: competition.date,
            eventId: event.id,
            eventNumber: event.number,
            dances: event.dances,
            ageGroup: event.ageGroup,
            class: event.class,
            discipline: event.discipline,
            roundsMarked: new Set(marks.filter((m) => m.adjudicatorId === adjudicatorId && roundIds.includes(m.roundId)).map((m) => m.roundId)).size,
          },
        ]
      })
      .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate) || a.eventNumber - b.eventNumber),
  )

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
      executor: input.executor?.trim() || undefined,
      entryDeadline: input.entryDeadline || null,
      feeDeadline: input.feeDeadline || null,
      ...(input.image === undefined ? {} : { image: input.image || null }),
      ...(input.usesPoints === undefined ? {} : { usesPoints: input.usesPoints }),
    }
    if (!values.name || !values.date || !values.venue || !values.organizer) {
      throw new Error('Fill in every field.')
    }
    const past = 'A competition cannot be dated before today. A finished competition cannot be added.'
    if (values.date < new Date().toISOString().slice(0, 10) && values.date !== competitions.find((c) => c.id === id)?.date) throw new Error(past)
    if (id) {
      const competition = found(competitions.find((c) => c.id === id), 'Competition')
      if (!(input.image === undefined ? competition.image : input.image)) throw new Error('Add the photo for its card.')
      Object.assign(competition, values)
      record(actorId, 'Edited competition', values.name)
      return competition
    }
    if (!input.image) throw new Error('Add the photo for its card.')
    const created: Competition = {
      id: `comp-${competitions.length + 1}-${Date.now().toString(36)}`,
      ...values,
      usesPoints: input.usesPoints ?? true,
    }
    competitions.push(created)
    record(actorId, 'Created competition', values.name)
    return created
  })

export const deleteCompetition = (actorId: string, id: string, cascade?: boolean) =>
  settle<{ id: string }>(() => {
    const index = competitions.findIndex((c) => c.id === id)
    const competition = found(competitions[index], 'Competition')
    confirmCascade('competition', id, cascade)
    dropEvents(eventsOf('competition', id))
    competitions.splice(index, 1)
    record(actorId, 'Deleted competition', competition.name)
    return { id }
  })

export const createStaffUser = (
  actorId: string,
  input: { name: string; username: string; role: Role; photo: string },
) =>
  settle(() => {
    const username = input.username.trim().toLowerCase()
    const name = input.name.trim()
    if (!name || !username) throw new Error('Enter a name and an email.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username)) throw new Error('Enter a valid email address.')
    if (!input.photo) throw new Error('Add a photo.')
    if (staffUsers.some((s) => s.username === username)) throw new Error('That email is already used by another account.')
    const user: StaffUser = { id: `staff-${username}`, name, username, role: input.role, photo: input.photo }
    const password = tempPassword()
    passwords.set(username, password)
    staffUsers.push(user)
    record(actorId, 'Added staff account', name)
    return { user, tempPassword: password }
  })

const adminCount = () => staffUsers.filter((s) => s.role === Role.Admin).length

export const updateStaffUser = (actorId: string, id: string, input: { name: string; role: Role; photo?: string }) =>
  settle<StaffUser>(() => {
    const user = found(staffUsers.find((s) => s.id === id), 'Staff account')
    const name = input.name.trim()
    if (!name) throw new Error('Enter a name.')
    if (user.role === Role.Admin && input.role !== Role.Admin && adminCount() === 1) {
      throw new Error('There must be at least one admin.')
    }
    const photo = input.photo === undefined ? user.photo : input.photo
    if (!photo) throw new Error('Add a photo.')
    user.name = name
    user.role = input.role
    user.photo = photo
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

export const updateAdjudicator = (actorId: string, id: string, input: { name: string; photo?: string }) =>
  settle<Adjudicator>(() => {
    const adjudicator = found(adjudicators.find((a) => a.id === id), 'Adjudicator')
    const name = input.name.trim()
    if (!name) throw new Error('Enter a name.')
    const photo = input.photo === undefined ? adjudicator.photo : input.photo
    if (!photo) throw new Error('Add a photo.')
    adjudicator.name = name
    adjudicator.photo = photo
    record(actorId, 'Edited adjudicator', `${adjudicator.letter} ${name}`)
    return adjudicator
  })

export const deleteAdjudicator = (actorId: string, id: string, cascade?: boolean) =>
  settle<{ id: string }>(() => {
    const index = adjudicators.findIndex((a) => a.id === id)
    const adjudicator = found(adjudicators[index], 'Adjudicator')
    confirmCascade('adjudicator', id, cascade)
    for (const panel of panels) panel.adjudicatorIds = panel.adjudicatorIds.filter((a) => a !== id)
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

export const createAdjudicator = (actorId: string, input: { name: string; letter: string; photo: string }) =>
  settle<Adjudicator>(() => {
    const letter = input.letter.toUpperCase()
    const name = input.name.trim()
    if (!name) throw new Error('Enter a name.')
    if (!/^[A-J]$/.test(letter)) throw new Error('Pick a letter from A to J.')
    if (!input.photo) throw new Error('Add a photo.')
    if (adjudicators.some((a) => a.letter === letter)) throw new Error(`Letter ${letter} is already taken.`)
    const adjudicator: Adjudicator = { id: `adj-${letter.toLowerCase()}`, name, letter, photo: input.photo }
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
export const saveEventKind = (actorId: string, input: EventKindInput, id?: string) =>
  settle<EventKindDef>(() => {
    const checked = checkEventKind(input, eventKinds.filter((k) => k.id !== id))
    if ('error' in checked) throw new Error(checked.error)
    if (id) {
      const kind = found(eventKinds.find((k) => k.id === id), 'Kind')
      Object.assign(kind, checked.values)
      record(actorId, 'Edited event kind', kind.name)
      return kind
    }
    const created = { id: freshId(checked.values.name, eventKinds.map((k) => k.id)), ...checked.values }
    eventKinds.push(created)
    record(actorId, 'Created event kind', created.name)
    return created
  })

export const deleteEventKind = (actorId: string, id: string, cascade?: boolean) =>
  settle<{ id: string }>(() => {
    const kind = found(eventKinds.find((k) => k.id === id), 'Kind')
    confirmCascade('eventKind', id, cascade)
    dropEvents(eventsOf('eventKind', id))
    eventKinds.splice(eventKinds.indexOf(kind), 1)
    record(actorId, 'Deleted event kind', kind.name)
    return { id }
  })

export const saveAgeGroup = (actorId: string, input: AgeGroupInput, id?: string) =>
  settle<AgeGroupDef>(() => {
    const checked = checkAgeGroup(input, ageGroups.filter((g) => g.id !== id))
    if ('error' in checked) throw new Error(checked.error)
    if (id) {
      const group = found(ageGroups.find((g) => g.id === id), 'Age group')
      Object.assign(group, checked.values)
      record(actorId, 'Edited age group', group.name)
      return group
    }
    const created = { id: freshId(checked.values.name, ageGroups.map((g) => g.id)), ...checked.values }
    ageGroups.push(created)
    record(actorId, 'Created age group', created.name)
    return created
  })

export const deleteAgeGroup = (actorId: string, id: string, cascade?: boolean) =>
  settle<{ id: string }>(() => {
    const group = found(ageGroups.find((g) => g.id === id), 'Age group')
    confirmCascade('ageGroup', id, cascade)
    dropEvents(eventsOf('ageGroup', id))
    ageGroups.splice(ageGroups.indexOf(group), 1)
    record(actorId, 'Deleted age group', group.name)
    return { id }
  })

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

export const changeMyStaffPassword = (actorId: string, current: string, next: string) =>
  settle<void>(() => {
    const user = found(staffUsers.find((s) => s.id === actorId), 'Account')
    if (current !== (passwords.get(user.username) ?? SAMPLE_PASSWORD)) throw new Error('Your current password is not right.')
    if (next.length < 8) throw new Error('Use a password of at least 8 characters.')
    passwords.set(user.username, next)
  })

export const saveMyStaffName = (actorId: string, name: string) =>
  settle<StaffUser>(() => {
    const user = found(staffUsers.find((s) => s.id === actorId), 'Account')
    const clean = name.replace(/\s+/g, ' ').trim()
    if (!clean) throw new Error('Enter your name.')
    user.name = clean
    return { ...user }
  })

export const signInStaff = (username: string, password: string, code?: string) =>
  settle<SessionUser>(() => {
    const user = staffUsers.find((s) => s.username === username.trim().toLowerCase())
    if (!user || password !== (passwords.get(user.username) ?? SAMPLE_PASSWORD)) {
      throw new Error('Wrong email or password.')
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
    athleteEmail: SAMPLE_ATHLETE_EMAIL,
    coachEmail: SAMPLE_COACH_EMAIL,
    teamEmail: SAMPLE_TEAM_EMAIL,
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

const teamName = (teamId: string) => teams.find((c) => c.id === teamId)?.name ?? 'Unknown team'

function entryRow(entry: Entry): EntryRow {
  const competitor = found(competitors.find((c) => c.id === entry.competitorId), 'Competitor')
  const payment = payments.find((p) => p.id === entry.paymentId)
  return {
    entryId: entry.id,
    competitorId: competitor.id,
    names: competitor.names,
    backNumber: competitor.backNumber,
    teamName: teamName(competitor.teamId),
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
  teamName: teamName(c.teamId),
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

export const createCompetitor = (actorId: string, input: { names: string[]; teamId: string; details?: CompetitorDetails }) =>
  settle<CompetitorRow>(() => {
    const names = cleanNames(input.names)
    found(teams.find((c) => c.id === input.teamId), 'Team')
    const competitor: Competitor = {
      id: `c-${String(competitors.length + 1).padStart(3, '0')}`,
      names,
      backNumber: null,
      teamId: input.teamId,
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
      const team = teams.find((c) => c.name.toLowerCase() === row.teamName.trim().toLowerCase())
      if (!team) return void result.skipped.push({ line, reason: `Unknown team "${row.teamName}".` })
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
        teamId: team.id,
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
function checkEligible(competitorId: string, event: { number: number; isSolo: boolean; ageGroup: AgeGroup; kind?: string; province?: string }) {
  const competitor = found(competitors.find((c) => c.id === competitorId), 'Competitor')
  if ((competitor.names.length === 1) !== event.isSolo) {
    throw new Error(event.isSolo ? 'This is a solo event.' : 'This is a couple event.')
  }
  const age = ageGroupOf.get(competitorId)
  if (age && age !== event.ageGroup) throw new Error('This competitor is in a different age group.')
  if (kindOf(eventKinds, event.kind)?.closedToProvince && !sameProvince(competitor.details?.province, event.province)) {
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
      teamId: competitor.teamId,
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
    const values = { ...input, name, summits: [...new Set(input.summits ?? [])].sort().reverse() }
    const giveId = (coach: Coach) => {
      if (coach.memberYear !== null && !coach.membershipId) coach.membershipId = `C-${String(coaches.filter((c) => c.membershipId).length + 1).padStart(5, '0')}`
    }
    if (id) {
      const coach = found(coaches.find((c) => c.id === id), 'Coach')
      Object.assign(coach, values)
      giveId(coach)
      record(actorId, 'Edited coach', name)
      return coach
    }
    const coach: Coach = { id: `coach-${coaches.length + 1}`, ...values }
    giveId(coach)
    coaches.push(coach)
    record(actorId, 'Added coach', name)
    return coach
  })

export const deleteCoach = (actorId: string, id: string, cascade?: boolean) =>
  settle<void>(() => {
    const coach = found(coaches.find((c) => c.id === id), 'Coach')
    confirmCascade('coach', id, cascade)
    for (const c of competitors) if (c.details?.coachId === id) c.details = { ...c.details, coachId: null }
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
  const catalogNow = catalog()
  const prior = entries.filter((e) => {
    const event = events.find((x) => x.id === e.eventId)
    return e.competitorId === competitorId && !e.scratched && event?.competitionId === competition.id && !isFixedFee(catalogNow, event.kind)
  }).length
  const coachRow = coaches.find((c) => c.id === competitor.details?.coachId)
  const coach = coachRow
    ? { name: coachRow.name, membershipDue: coachRow.memberYear !== year, summitDue: coachRow.summitYear !== year }
    : undefined
  const collect = { membership: Boolean(coach?.membershipDue && coachFees.membership), summit: Boolean(coach?.summitDue && coachFees.summit) }
  const { lines, total } = registrationFee(DEFAULT_FEE_SCHEDULE, chosen, members, prior, collect, catalogNow)
  return {
    competitor,
    chosen,
    year,
    members,
    collect,
    coachRow,
    quote: { lines, total, warnings: registrationWarnings(competitor.details, competitor.names.length, chosen, year, catalogNow, members), ...(coach ? { coach } : {}) },
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
      teamId: competitor.teamId,
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
    record(actorId, 'Recorded cash payment', detail.teamName)
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

export const updateCompetitor = (actorId: string, id: string, input: { names: string[]; teamId: string; details?: CompetitorDetails }) =>
  settle<CompetitorRow>(() => {
    const competitor = found(competitors.find((c) => c.id === id), 'Competitor')
    const names = cleanNames(input.names)
    found(teams.find((c) => c.id === input.teamId), 'Team')
    if ((names.length === 1) !== (competitor.names.length === 1) && entries.some((e) => e.competitorId === id)) {
      throw new Error('Remove their entries before changing between a solo dancer and a couple.')
    }
    competitor.names = names
    competitor.teamId = input.teamId
    if (input.details) competitor.details = input.details
    record(actorId, 'Edited competitor', names.join(' & '))
    return competitorRow(competitor)
  })

export const deleteCompetitor = (actorId: string, id: string, cascade?: boolean) =>
  settle<void>(() => {
    if (!competitors.some((c) => c.id === id)) throw new Error('Competitor not found')
    confirmCascade('competitor', id, cascade)
    dropCompetitors([id])
    record(actorId, 'Deleted competitor', 'Competitor')
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
  const kind = kindOf(eventKinds, input.kind)
  if (!kind) throw new Error('Choose a kind.')
  if (!ageGroups.some((g) => g.id === input.ageGroup)) throw new Error('Choose an age group.')
  if (kind.closedToProvince && !input.province?.trim()) throw new Error('Enter the province this event is closed to.')
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

export const deleteEvent = (actorId: string, id: string, cascade?: boolean) =>
  settle<void>(() => {
    const event = found(events.find((e) => e.id === id), 'Event')
    confirmCascade('event', id, cascade)
    dropEvents([id])
    record(actorId, 'Deleted event', `Event ${event.number}`)
  })

// ---- Adjudicator ----

export const getAdjudicatorState = (adjudicatorId: string) => reply(adjudicatorState(adjudicatorId))

export const submitAdjudicatorMarks = (adjudicatorId: string, roundId: string, submissions: MarkSubmission[], _signature?: string) =>
  settle<void>(() => {
    submitMarks(adjudicatorId, roundId, submissions)
    // The scrutineer's and the chairperson's screens are told, as the real server does
    const letter = adjudicators.find((a) => a.id === adjudicatorId)?.letter ?? ''
    emitAlert([Role.Scrutineer, Role.Chairperson], { title: `Adjudicator ${letter} submitted`.replace('  ', ' '), detail: 'Marks are in for the round on the floor', link: '/scrutineer/live' })
  })

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

// ---- Compere ----

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
  { name: 'GCash', accountName: 'BIS', number: '0917 000 0000' },
  { name: 'Maya', accountName: 'BIS', number: '0918 000 0000' },
  { name: 'Bank transfer', accountName: 'BIS', number: '0000 0000 0000', note: 'BDO Savings, Sorsogon branch' },
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
const SAMPLE_ATHLETE_EMAIL = 'athlete@sample.example'
const sampleAthletes: SampleAthlete[] = [
  {
    id: 'athlete-sample',
    email: SAMPLE_ATHLETE_EMAIL,
    name: 'Ana Cruz',
    birthDate: '',
    phone: '',
    address: '',
    province: '',
    teamId: teams[0]?.id ?? null,
    coachId: null,
    memberYear: null,
    request: null,
    photo: null,
    history: [],
    changeRequest: null,
    password: SAMPLE_PASSWORD,
  },
]

const sampleNotifications = new Map<string, AthleteNotification[]>()
const notificationListeners = new Set<() => void>()
export const subscribeNotifications = (listener: () => void) => {
  notificationListeners.add(listener)
  return () => void notificationListeners.delete(listener)
}

const alertListeners = new Set<(note: AlertNote & { roles: Role[] }) => void>()
export const subscribeAlerts = (listener: (note: AlertNote & { roles: Role[] }) => void) => {
  alertListeners.add(listener)
  return () => void alertListeners.delete(listener)
}

// A pop-up for the screens of some roles; the sample has no server to pick them, so the note says who it is for
export function emitAlert(roles: Role[], note: AlertNote) {
  alertListeners.forEach((listener) => listener({ ...note, roles }))
}

// Tells an athlete something; the open screens hear it straight away, as they would over the socket
export function notifyAthlete(athleteId: string, note: Pick<AthleteNotification, 'kind' | 'title' | 'detail' | 'link'>) {
  const list = sampleNotifications.get(athleteId) ?? []
  list.unshift({ id: `note-${athleteId}-${list.length + 1}-${Date.now()}`, ...note, createdAt: new Date().toISOString(), readAt: null })
  sampleNotifications.set(athleteId, list)
  notificationListeners.forEach((listener) => listener())
}

export const getMyNotifications = (athleteId: string) => reply<AthleteNotification[]>([...(sampleNotifications.get(athleteId) ?? [])])

export const markNotificationsRead = (athleteId: string, ids?: string[]) =>
  settle<void>(() => {
    const at = new Date().toISOString()
    const list = sampleNotifications.get(athleteId) ?? []
    sampleNotifications.set(
      athleteId,
      list.map((n) => (n.readAt === null && (!ids || ids.length === 0 || ids.includes(n.id)) ? { ...n, readAt: at } : n)),
    )
  })

const membershipYear = () => new Date().getFullYear()
const athleteOf = (id: string) => found(sampleAthletes.find((a) => a.id === id), 'Athlete')
const publicAthlete = ({ password: _password, ...profile }: SampleAthlete): AthleteProfile => profile

export const signUpAthlete = (name: string, email: string, password: string, photo: string) =>
  settle<SessionUser>(() => {
    if (!photo) throw new Error('Add a photo.')
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
      teamId: null,
      coachId: null,
      memberYear: null,
      request: null,
      photo: null,
      history: [],
      changeRequest: null,
      password,
    }
    sampleAthletes.push(athlete)
    return { id: athlete.id, name: athlete.name, role: Role.Athlete }
  })

export const signInAthlete = (email: string, password: string) =>
  settle<SessionUser>(() => {
    const who = email.trim().toLowerCase()
    const athlete = sampleAthletes.find((a) => a.email === who || (a.membershipId ?? '').toLowerCase() === who)
    if (!athlete || athlete.password !== password) throw new Error('Wrong email or password.')
    return { id: athlete.id, name: athlete.name, role: Role.Athlete }
  })

const SAMPLE_COACH_EMAIL = 'coach@sample.example'
const SAMPLE_TEAM_EMAIL = 'team@sample.example'
interface SampleMember {
  id: string
  role: 'coach' | 'team'
  name: string
  email: string
  password: string
  phone: string
  birthDate: string
  province: string
  address: string
  photo: string | null
  linkedId: string | null
  claimId: string | null
  claimedAt: string | null
  changeRequest?: MemberChangeRequest | null
}

// The sample coach and team start out linked, so their pages show something
const sampleMembers: SampleMember[] = [
  { id: 'member-sample-coach', role: 'coach', name: 'Rico Bautista', email: SAMPLE_COACH_EMAIL, password: SAMPLE_PASSWORD, phone: '', birthDate: '', province: '', address: '', photo: null, linkedId: 'coach-1', claimId: null, claimedAt: null },
  { id: 'member-sample-team', role: 'team', name: 'Sample Dance Team', email: SAMPLE_TEAM_EMAIL, password: SAMPLE_PASSWORD, phone: '', birthDate: '', province: '', address: '', photo: null, linkedId: teams[0]?.id ?? null, claimId: null, claimedAt: null },
]

const memberOf = (id: string) => found(sampleMembers.find((m) => m.id === id), 'Account')
const recordName = (role: 'coach' | 'team', id: string) => (role === 'coach' ? coaches.find((c) => c.id === id)?.name : teams.find((c) => c.id === id)?.name) ?? null

function memberAccount(m: SampleMember): MemberAccount {
  const linked = m.linkedId ? recordName(m.role, m.linkedId) : null
  const claim = m.claimId ? recordName(m.role, m.claimId) : null
  return {
    id: m.id,
    role: m.role,
    name: m.name,
    email: m.email,
    phone: m.phone,
    birthDate: m.birthDate,
    province: m.province,
    address: m.address,
    photo: m.photo,
    linked: m.linkedId && linked !== null ? { id: m.linkedId, name: linked } : null,
    claim: m.claimId && claim !== null ? { id: m.claimId, name: claim, requestedAt: m.claimedAt ?? '' } : null,
    changeRequest: m.changeRequest ?? null,
  }
}

const claimRow = (m: SampleMember): MemberClaimRow => ({
  memberId: m.id,
  role: m.role,
  name: m.name,
  email: m.email,
  targetId: m.claimId ?? '',
  targetName: recordName(m.role, m.claimId ?? '') ?? '',
  requestedAt: m.claimedAt ?? '',
})

export const signUpMember = (role: 'coach' | 'team', name: string, email: string, password: string, photo: string) =>
  settle<SessionUser>(() => {
    if (!photo) throw new Error('Add a photo.')
    const address = email.trim().toLowerCase()
    if (!name.trim()) throw new Error(role === 'team' ? 'Enter the name of your team.' : 'Enter your name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.')
    if (password.length < 8) throw new Error('Use a password of at least 8 characters.')
    if (sampleMembers.some((m) => m.email === address)) throw new Error('An account with this email already exists. Sign in instead.')
    const member: SampleMember = { id: `member-${sampleMembers.length + 1}`, role, name: name.trim(), email: address, password, phone: '', birthDate: '', province: '', address: '', photo, linkedId: null, claimId: null, claimedAt: null }
    sampleMembers.push(member)
    return { id: member.id, name: member.name, role: role === 'team' ? Role.Team : Role.Coach }
  })

export const signInMember = (role: 'coach' | 'team', email: string, password: string) =>
  settle<SessionUser>(() => {
    const who = email.trim().toLowerCase()
    const coach = role === 'coach' ? coaches.find((c) => (c.membershipId ?? '').toLowerCase() === who) : undefined
    const member = sampleMembers.find((m) => (coach ? m.linkedId === coach.id : m.email === who) && m.role === role)
    if (!member || member.password !== password) throw new Error('Wrong email or password.')
    return { id: member.id, name: member.name, role: member.role === 'team' ? Role.Team : Role.Coach }
  })

// The sample competitors have no entry form, so the sample coach is given the first dancers that have results
const dancersOf = (m: SampleMember) =>
  !m.linkedId
    ? []
    : m.id === 'member-sample-coach'
      ? competitors.filter((c) => results.some((r) => r.competitorId === c.id)).slice(0, 12)
      : competitors.filter((c) => (m.role === 'team' ? c.teamId === m.linkedId : c.details?.coachId === m.linkedId))

export const saveMyMember = (memberId: string, input: MemberInput) =>
  settle<MemberAccount>(() => {
    const member = memberOf(memberId)
    if (!input.name.trim()) throw new Error(member.role === 'team' ? 'Enter the name of your team.' : 'Enter your name.')
    const name = input.name.trim()
    const coach = member.role === 'coach'
    const nameAsk = coach && name !== member.name
    const birthAsk = coach && Boolean(member.birthDate) && Boolean(input.birthDate) && input.birthDate !== member.birthDate
    if (nameAsk || birthAsk) {
      const pending = member.changeRequest && !member.changeRequest.rejectedReason ? member.changeRequest : null
      member.changeRequest = {
        ...(nameAsk ? { name } : pending?.name ? { name: pending.name } : {}),
        ...(birthAsk ? { birthDate: input.birthDate } : pending?.birthDate ? { birthDate: pending.birthDate } : {}),
        requestedAt: new Date().toISOString(),
      }
      emitAlert([Role.Secretariat, Role.Admin], { title: 'Profile change', detail: `${member.name} asks to change ${[nameAsk && 'name', birthAsk && 'date of birth'].filter(Boolean).join(' and ')}`, link: '/secretariat/profile-changes' })
    }
    if (!coach) member.name = name
    member.phone = input.phone.trim()
    member.birthDate = coach ? member.birthDate || input.birthDate : input.birthDate
    member.province = input.province.trim()
    member.address = input.address.trim()
    return memberAccount(member)
  })

export const saveMyMemberPhoto = (memberId: string, photo: string | null) =>
  settle<MemberAccount>(() => {
    const member = memberOf(memberId)
    if (photo !== null && !/^data:image\/(jpeg|png|webp);base64,/.test(photo)) throw new Error('Choose a JPEG, PNG or WebP picture.')
    member.photo = photo
    return memberAccount(member)
  })

export const getMyMember = (memberId: string) => settle<MemberAccount>(() => memberAccount(memberOf(memberId)))

export const claimRecord = (memberId: string, targetId: string) =>
  settle<MemberAccount>(() => {
    const member = memberOf(memberId)
    if (member.linkedId) throw new Error('Your account is already linked.')
    if (recordName(member.role, targetId) === null) throw new Error(member.role === 'team' ? 'Choose your team from the list.' : 'Choose your name from the list of coaches.')
    member.claimId = targetId
    member.claimedAt = new Date().toISOString()
    emitAlert([Role.Secretariat, Role.Admin], { title: 'Account link request', detail: `${member.name} wants to be linked to ${recordName(member.role, targetId) ?? ''}`, link: '/secretariat/account-links' })
    return memberAccount(member)
  })

export const cancelClaim = (memberId: string) =>
  settle<MemberAccount>(() => {
    const member = memberOf(memberId)
    member.claimId = null
    member.claimedAt = null
    return memberAccount(member)
  })

export const getMyRoster = (memberId: string) =>
  settle<MemberRoster>(() => {
    const member = memberOf(memberId)
    const linkedId = member.linkedId
    if (!linkedId) return { rows: [], payments: [], membership: null }
    const own = dancersOf(member)
    const rows = own
      .map((c) => ({
        competitorId: c.id,
        names: c.names,
        backNumber: c.backNumber,
        teamName: teams.find((k) => k.id === c.teamId)?.name ?? '',
        entries: entries.filter((e) => e.competitorId === c.id && !e.scratched).length,
      }))
      .sort((a, b) => (a.names[0] ?? '').localeCompare(b.names[0] ?? ''))
    if (member.role === 'coach') {
      const coach = coaches.find((c) => c.id === linkedId)
      return { rows, payments: [], membership: coach ? { memberYear: coach.memberYear, summitYear: coach.summitYear, membershipId: coach.membershipId ?? null, summits: coach.summits ?? [] } : null }
    }
    const current = competitions.find((c) => c.id === currentCompetitionId)
    const competitionName = current?.name ?? ''
    const paid = payments.filter((p) => p.teamId === linkedId).map((p) => ({ id: p.id, competitionName, date: current?.date ?? '', amountDue: p.amountDue, amountPaid: p.amountPaid, status: p.status }))
    return { rows, payments: paid, membership: null }
  })

export const getMemberClaims = () => settle<MemberClaimRow[]>(() => sampleMembers.filter((m) => m.claimId && recordName(m.role, m.claimId) !== null).map(claimRow))

export const approveMemberClaim = (actorId: string, memberId: string) =>
  settle<MemberClaimRow[]>(() => {
    const member = memberOf(memberId)
    if (!member.claimId) throw new Error('This account has no request waiting.')
    if (sampleMembers.some((m) => m.id !== member.id && m.role === member.role && m.linkedId === member.claimId)) throw new Error('That record is already linked to another account.')
    member.linkedId = member.claimId
    member.claimId = null
    member.claimedAt = null
    record(actorId, 'Linked an account to a record', member.name)
    notifyAthlete(member.id, { kind: 'link_approved', title: `You are linked to ${recordName(member.role, member.linkedId) ?? ''}`, detail: member.role === 'team' ? 'Your dancers and payments are on your page now.' : 'Your athletes are on your page now.', link: `/${member.role}/dancers` })
    return sampleMembers.filter((m) => m.claimId).map(claimRow)
  })

export const rejectMemberClaim = (actorId: string, memberId: string) =>
  settle<MemberClaimRow[]>(() => {
    const member = memberOf(memberId)
    if (!member.claimId) throw new Error('This account has no request waiting.')
    member.claimId = null
    member.claimedAt = null
    record(actorId, 'Turned down a request to link an account', member.name)
    notifyAthlete(member.id, { kind: 'link_rejected', title: 'Your request to be linked was turned down', detail: 'Check that you chose the right record and ask again.', link: `/${member.role}` })
    return sampleMembers.filter((m) => m.claimId).map(claimRow)
  })

// ---- Entering a competition online ----

type SampleRequest = EntryRequest & { receipt: string; eventIds: string[]; requesterId: string }
const sampleRequests: SampleRequest[] = []
const ONLINE_METHODS: string[] = [PayMethod.GCash, PayMethod.Maya, PayMethod.Bank]

// Who is asking: a team's account (its team's dancers) or an athlete (the dancers that carry their name)
function entrantsFor(requesterId: string) {
  const member = sampleMembers.find((m) => m.id === requesterId)
  if (member) {
    if (member.role !== 'team') throw new Error('Only a team or an athlete can send an entry request.')
    return { role: 'team' as const, name: member.name, dancers: member.linkedId ? competitors.filter((c) => c.teamId === member.linkedId) : [] }
  }
  const athlete = athleteOf(requesterId)
  const me = normalName(athlete.name)
  return { role: 'athlete' as const, name: athlete.name, dancers: competitors.filter((c) => c.names.some((n) => normalName(n) === me)) }
}

const entrantRow = (c: (typeof competitors)[number]): MemberRosterRow => ({
  competitorId: c.id,
  names: c.names,
  ageGroup: ageGroupOf.get(c.id) ?? null,
  backNumber: c.backNumber,
  teamName: teams.find((k) => k.id === c.teamId)?.name ?? '',
  entries: entries.filter((e) => e.competitorId === c.id && !e.scratched).length,
})

const ownDancer = (requesterId: string, competitorId: string) => {
  const who = entrantsFor(requesterId)
  if (!who.dancers.some((c) => c.id === competitorId)) throw new Error('You can only enter your own dancers.')
  return who
}

// Requests already sent, so the secretariat's list and the team's My requests have something in them
function seedRequests() {
  const teamRecord = teams[0]
  if (!teamRecord) return
  const team = sampleMembers.find((m) => m.id === 'member-sample-team')
  const soloDancers = competitors.filter((c) => c.teamId === teamRecord.id && c.names.length === 1)
  const open = events.filter((e) => e.competitionId === 'comp-legazpi-2026' && e.isSolo)
  const states = ['waiting', 'rejected', 'approved'] as const
  soloDancers.slice(0, 3).forEach((dancer, i) => {
    const mine = open.filter((e) => e.ageGroup === ageGroupOf.get(dancer.id)).slice(0, 2)
    if (mine.length === 0 || !team) return
    const status = states[i]!
    const { total } = priceRegistration(dancer.id, mine.map((e) => e.id)).quote
    sampleRequests.push({
      id: `entry-request-seed-${i + 1}`,
      competitorId: dancer.id,
      names: dancer.names,
      competitionId: 'comp-legazpi-2026',
      competitionName: competitions.find((c) => c.id === 'comp-legazpi-2026')?.name ?? '',
      eventNumbers: mine.map((e) => e.number).sort((a, b) => a - b),
      total,
      warnings: [],
      method: [PayMethod.GCash, PayMethod.Maya, PayMethod.Bank][i]!,
      reference: `REF${7040012 + i}`,
      status,
      rejectedReason: status === 'rejected' ? 'The screenshot is cut off. Send the whole payment.' : null,
      createdAt: new Date(Date.now() - (i + 1) * 20 * 3_600_000).toISOString(),
      decidedAt: status === 'waiting' ? null : new Date(Date.now() - i * 20 * 3_600_000).toISOString(),
      requesterRole: 'team',
      requesterName: team.name,
      receipt: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAoQ7cyAAAAABJRU5ErkJggg==',
      eventIds: mine.map((e) => e.id),
      requesterId: team.id,
    })
  })
}
seedRequests()

export const getEntryPaymentMethods = (_requesterId: string) => reply(samplePaymentSettings.methods)

export const getMyEntrants = (requesterId: string) =>
  settle<MemberRosterRow[]>(() => entrantsFor(requesterId).dancers.map(entrantRow).sort((a, b) => (a.names[0] ?? '').localeCompare(b.names[0] ?? '')))

export const quoteMyEntries = (requesterId: string, competitorId: string, eventIds: string[]) =>
  settle<RegistrationQuote>(() => {
    ownDancer(requesterId, competitorId)
    return priceRegistration(competitorId, eventIds).quote
  })

export const submitEntryRequest = (requesterId: string, input: EntryRequestInput) =>
  settle<EntryRequest>(() => {
    const who = ownDancer(requesterId, input.competitorId)
    if (!ONLINE_METHODS.includes(input.method)) throw new Error('Choose GCash, Maya or bank. Cash is paid at the venue.')
    if (!input.receipt) throw new Error('Send a screenshot of your payment.')
    const { competitor, chosen, quote } = priceRegistration(input.competitorId, input.eventIds)
    for (const event of chosen) {
      checkEligible(competitor.id, event)
      if (entries.some((e) => e.eventId === event.id && e.competitorId === competitor.id)) throw new Error(`Already entered in E${event.number}.`)
    }
    if (sampleRequests.some((r) => r.status === 'waiting' && r.competitorId === competitor.id && r.eventIds.some((id) => input.eventIds.includes(id)))) {
      throw new Error('An entry request for one of these events is already waiting.')
    }
    const competition = found(competitions.find((c) => c.id === chosen[0]!.competitionId), 'Competition')
    const row: SampleRequest = {
      id: `entry-request-${sampleRequests.length + 1}`,
      competitorId: competitor.id,
      names: competitor.names,
      competitionId: competition.id,
      competitionName: competition.name,
      eventNumbers: chosen.map((e) => e.number).sort((a, b) => a - b),
      total: quote.total,
      warnings: quote.warnings,
      method: input.method,
      reference: input.reference.trim(),
      status: 'waiting' as const,
      rejectedReason: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
      requesterRole: who.role,
      requesterName: who.name,
      receipt: input.receipt,
      requesterId,
      eventIds: [...new Set(input.eventIds)],
    }
    sampleRequests.push(row)
    emitAlert([Role.Secretariat, Role.Admin], { title: 'New entry request', detail: `${competitor.names.join(' & ')} · ${who.name}`, link: '/secretariat/entry-requests' })
    const { receipt: _receipt, eventIds: _eventIds, requesterId: _requesterId, ...shown } = row
    return shown
  })

export const getMyEntryRequests = (requesterId: string) =>
  settle<EntryRequest[]>(() =>
    sampleRequests
      .filter((r) => r.requesterId === requesterId)
      .map(({ receipt: _receipt, eventIds: _eventIds, requesterId: _requesterId, ...r }) => r)
      .reverse(),
  )

export const cancelEntryRequest = (requesterId: string, id: string) =>
  settle<void>(() => {
    const i = sampleRequests.findIndex((r) => r.id === id && r.requesterId === requesterId)
    if (i < 0) throw new Error('Entry request not found.')
    if (sampleRequests[i]!.status !== 'waiting') throw new Error('This request was already decided.')
    sampleRequests.splice(i, 1)
  })

const allRequests = (): EntryRequest[] =>
  [...sampleRequests]
    .map(({ eventIds: _eventIds, requesterId: _requesterId, ...r }) => r)
    .reverse()
    .sort((a, b) => Number(b.status === 'waiting') - Number(a.status === 'waiting'))

export const getEntryRequests = () => reply<EntryRequest[]>(allRequests())

const tellRequester = (r: SampleRequest, note: Parameters<typeof notifyAthlete>[1]) => notifyAthlete(r.requesterId, note)

export const approveEntryRequest = async (actorId: string, id: string): Promise<EntryRequest[]> => {
  const row = found(sampleRequests.find((r) => r.id === id), 'Entry request')
  if (row.status !== 'waiting') throw new Error('This request was already decided.')
  await registerCompetitor(actorId, { competitorId: row.competitorId, eventIds: row.eventIds, method: row.method, reference: row.reference })
  row.status = 'approved'
  row.decidedAt = new Date().toISOString()
  record(actorId, 'Approved an entry request', row.requesterName)
  tellRequester(row, { kind: 'entry_approved', title: 'Your entry was approved', detail: `${row.eventIds.length} ${row.eventIds.length === 1 ? 'event' : 'events'} entered. Your payment was received.`, link: `/${row.requesterRole}/entries` })
  return allRequests()
}

export const rejectEntryRequest = (actorId: string, id: string, reason: string) =>
  settle<EntryRequest[]>(() => {
    const row = found(sampleRequests.find((r) => r.id === id), 'Entry request')
    if (row.status !== 'waiting') throw new Error('This request was already decided.')
    if (!reason.trim()) throw new Error('Say why it is turned down, so they can fix it.')
    row.status = 'rejected'
    row.rejectedReason = reason.trim()
    row.decidedAt = new Date().toISOString()
    record(actorId, 'Turned down an entry request', row.requesterName)
    tellRequester(row, { kind: 'entry_rejected', title: 'Your entry was not approved', detail: row.rejectedReason, link: `/${row.requesterRole}/register` })
    return allRequests()
  })

// The sample coach and team start with a notification each, so their bell and page have something to show
notifyAthlete('member-sample-coach', { kind: 'link_approved', title: 'You are linked to Ramon Villanueva', detail: 'Your athletes are on your page now.', link: '/coach/dancers' })
notifyAthlete('member-sample-team', { kind: 'link_approved', title: `You are linked to ${teams[0]?.name ?? 'your team'}`, detail: 'Your dancers and payments are on your page now.', link: '/team/dancers' })

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
    if (input.teamId && !teams.some((c) => c.id === input.teamId)) throw new Error('Choose a team from the list.')
    const teamId = input.teamId || null
    const coachId = input.coachId || null
    const nextTeam = athlete.teamId === null ? teamId : athlete.teamId
    const nextCoach = athlete.coachId === null ? coachId : athlete.coachId
    const name = input.name.trim()
    const teamAsk = teamId !== nextTeam || coachId !== nextCoach
    const nameAsk = name !== athlete.name
    const birthAsk = Boolean(athlete.birthDate) && Boolean(input.birthDate) && input.birthDate !== athlete.birthDate
    const birthDate = athlete.birthDate || input.birthDate
    Object.assign(athlete, { ...input, name: athlete.name, birthDate, teamId: nextTeam, coachId: nextCoach })
    if (teamAsk || nameAsk || birthAsk) {
      const pending = athlete.changeRequest && !athlete.changeRequest.rejectedReason ? athlete.changeRequest : null
      athlete.changeRequest = {
        teamId: teamAsk ? teamId : (pending?.teamId ?? nextTeam),
        coachId: teamAsk ? coachId : (pending?.coachId ?? nextCoach),
        ...(nameAsk ? { name } : pending?.name ? { name: pending.name } : {}),
        ...(birthAsk ? { birthDate: input.birthDate } : pending?.birthDate ? { birthDate: pending.birthDate } : {}),
        requestedAt: new Date().toISOString(),
      }
      const what = [teamAsk && 'team or coach', nameAsk && 'name', birthAsk && 'date of birth'].filter(Boolean).join(', ')
      emitAlert([Role.Secretariat, Role.Admin], { title: 'Profile change', detail: `${athlete.name} asks to change ${what}`, link: '/secretariat/profile-changes' })
    }
    return publicAthlete(athlete)
  })

export const requestMembership = (athleteId: string, input: { method: string; receipt: string }) =>
  settle<AthleteProfile>(() => {
    const athlete = athleteOf(athleteId)
    const year = membershipYear()
    if (athlete.memberYear === year) throw new Error(`Your ${year} membership is already paid.`)
    if (athlete.request && !athlete.request.rejectedReason) throw new Error('You already sent a payment. Wait for the secretariat to confirm it.')
    if (!input.method.trim()) throw new Error('Say how you paid.')
    if (!input.receipt) throw new Error('Send a screenshot of your payment.')
    athlete.request = { year, method: input.method.trim(), receipt: input.receipt, requestedAt: new Date().toISOString() }
    athlete.history.push({ at: athlete.request.requestedAt, kind: 'sent', year, method: athlete.request.method })
    emitAlert([Role.Secretariat, Role.Admin], { title: 'Membership payment sent', detail: `${athlete.name} · ${year} membership by ${athlete.request.method}`, link: '/secretariat/athletes' })
    return publicAthlete(athlete)
  })

export const changeMyPassword = (athleteId: string, current: string, next: string) =>
  settle<void>(() => {
    const athlete = sampleMembers.find((m) => m.id === athleteId) ?? athleteOf(athleteId)
    if (athlete.password !== current) throw new Error('Your current password is not right.')
    if (next.length < 8) throw new Error('Use a password of at least 8 characters.')
    athlete.password = next
  })

export const getAthletes = () =>
  reply<AthleteRow[]>(
    [...sampleAthletes]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({
        id: a.id,
        name: a.name,
        birthDate: a.birthDate,
        email: a.email,
        phone: a.phone,
        teamName: teams.find((c) => c.id === a.teamId)?.name ?? '',
        coachName: coaches.find((c) => c.id === a.coachId)?.name ?? '',
        memberYear: a.memberYear,
        membershipId: a.membershipId ?? null,
        request: a.request,
        changeRequest: a.changeRequest,
        requestedName: a.changeRequest?.name ?? '',
        requestedBirthDate: a.changeRequest?.birthDate ?? '',
        requestedTeamName: teams.find((c) => c.id === a.changeRequest?.teamId)?.name ?? '',
        requestedCoachName: coaches.find((c) => c.id === a.changeRequest?.coachId)?.name ?? '',
      })),
  )

export const approveProfileChange = (actorId: string, id: string) =>
  settle<void>(() => {
    const athlete = athleteOf(id)
    const change = athlete.changeRequest
    if (!change || change.rejectedReason) throw new Error('This athlete has no change waiting.')
    athlete.teamId = change.teamId
    athlete.coachId = change.coachId
    if (change.name) athlete.name = change.name
    if (change.birthDate) athlete.birthDate = change.birthDate
    athlete.changeRequest = null
    record(actorId, 'Approved a profile change', athlete.name)
    notifyAthlete(id, { kind: 'change_approved', title: 'Your change was approved', detail: '', link: '/athlete' })
  })

export const rejectProfileChange = (actorId: string, id: string, reason: string) =>
  settle<void>(() => {
    const athlete = athleteOf(id)
    if (!athlete.changeRequest || athlete.changeRequest.rejectedReason) throw new Error('This athlete has no change waiting.')
    if (!reason.trim()) throw new Error('Say why it was turned down.')
    athlete.changeRequest = { ...athlete.changeRequest, rejectedReason: reason.trim() }
    record(actorId, 'Turned down a profile change', athlete.name)
    notifyAthlete(id, { kind: 'change_rejected', title: 'Your change was turned down', detail: reason.trim(), link: '/athlete/edit' })
  })

export const saveMyPhoto = (athleteId: string, photo: string | null) =>
  settle<AthleteProfile>(() => {
    const athlete = athleteOf(athleteId)
    if (photo !== null && !/^data:image\/(jpeg|png|webp);base64,/.test(photo)) throw new Error('Choose a JPEG, PNG or WebP picture.')
    athlete.photo = photo
    return publicAthlete(athlete)
  })

// There is no real session to end in the sample, so this only checks the account exists
export const signOutEverywhere = (athleteId: string) =>
  settle<void>(() => {
    if (!sampleMembers.some((m) => m.id === athleteId)) athleteOf(athleteId)
  })

const normalName = (name: string) => name.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()

async function activityOf(mine: typeof competitors): Promise<MyActivity> {
  const ids = mine.map((c) => c.id)
  const history = await Promise.all(ids.map((id) => getCompetitorHistory(id)))
  const entryLines = entries
    .filter((e) => ids.includes(e.competitorId))
    .flatMap((e) => {
      const event = events.find((v) => v.id === e.eventId)
      const competition = competitions.find((c) => c.id === event?.competitionId)
      if (!event || !competition) return []
      return [
        {
          entryId: e.id,
          eventId: e.eventId,
          competitionId: competition.id,
          competitionName: competition.name,
          competitionDate: competition.date,
          eventNumber: event.number,
          dances: event.dances,
          ageGroup: event.ageGroup,
          class: event.class,
          discipline: event.discipline,
          scratched: e.scratched,
          names: mine.find((c) => c.id === e.competitorId)?.names ?? [],
        },
      ]
    })
    .sort((a, b) => b.competitionDate.localeCompare(a.competitionDate) || a.eventNumber - b.eventNumber)
  return { competitorIds: ids, results: history.flat(), entries: entryLines }
}

export const getMyActivity = (athleteId: string) => {
  const member = sampleMembers.find((m) => m.id === athleteId)
  if (member) return activityOf(dancersOf(member))
  const me = normalName(athleteOf(athleteId).name)
  return activityOf(competitors.filter((c) => c.names.some((n) => normalName(n) === me)))
}

export const getCompetitorActivity = (competitorId: string) => activityOf(competitors.filter((c) => c.id === competitorId))

export const confirmMembership = (actorId: string, id: string) =>
  settle<void>(() => {
    const athlete = athleteOf(id)
    if (!athlete.request || athlete.request.rejectedReason) throw new Error('This athlete has no payment waiting.')
    athlete.history.push({ at: new Date().toISOString(), kind: 'confirmed', year: athlete.request.year, method: athlete.request.method })
    const confirmed = athlete.request
    athlete.memberYear = confirmed.year
    athlete.membershipId ??= `A-${String(sampleAthletes.filter((a) => a.membershipId).length + 1).padStart(5, '0')}`
    athlete.request = null
    record(actorId, 'Confirmed membership', athlete.name)
    notifyAthlete(id, { kind: 'membership_confirmed', title: `Your ${confirmed.year} membership was confirmed`, detail: `Your ${confirmed.method} payment was received. You are a member until December ${confirmed.year}.`, link: '/athlete/membership' })
  })

export const rejectMembership = (actorId: string, id: string, reason: string) =>
  settle<void>(() => {
    const athlete = athleteOf(id)
    if (!athlete.request) throw new Error('This athlete has no payment waiting.')
    if (!reason.trim()) throw new Error('Say why it could not be confirmed.')
    athlete.history.push({ at: new Date().toISOString(), kind: 'rejected', year: athlete.request.year, method: athlete.request.method, reason: reason.trim() })
    athlete.request = { ...athlete.request, rejectedReason: reason.trim() }
    record(actorId, 'Turned down a membership payment', athlete.name)
    notifyAthlete(id, { kind: 'membership_rejected', title: 'Your membership payment was not confirmed', detail: reason.trim(), link: '/athlete/membership' })
  })

export const resetAthletePassword = (actorId: string, id: string) =>
  settle<{ tempPassword: string }>(() => {
    const athlete = athleteOf(id)
    athlete.password = 'temp1234'
    record(actorId, 'Reset an athlete password', athlete.name)
    return { tempPassword: athlete.password }
  })

export const correctAthlete = (actorId: string, id: string, input: { name: string; birthDate: string }) =>
  settle<void>(() => {
    const athlete = athleteOf(id)
    const name = input.name.trim()
    if (!name) throw new Error('Enter the name.')
    record(actorId, 'Corrected an athlete', name)
    athlete.name = name
    athlete.birthDate = input.birthDate
  })

const waitingChange = (m: SampleMember) => Boolean(m.changeRequest) && !m.changeRequest?.rejectedReason

export const getMemberChanges = () =>
  settle<MemberChangeRow[]>(() =>
    sampleMembers.filter(waitingChange).map((m) => ({
      memberId: m.id,
      role: m.role,
      name: m.name,
      birthDate: m.birthDate,
      requestedName: m.changeRequest?.name ?? '',
      requestedBirthDate: m.changeRequest?.birthDate ?? '',
      requestedAt: m.changeRequest?.requestedAt ?? '',
    })),
  )

export const approveMemberChange = (actorId: string, memberId: string) =>
  settle<MemberChangeRow[]>(() => {
    const member = memberOf(memberId)
    const change = member.changeRequest
    if (!change || change.rejectedReason) throw new Error('This account has no change waiting.')
    if (change.name) member.name = change.name
    if (change.birthDate) member.birthDate = change.birthDate
    member.changeRequest = null
    record(actorId, 'Approved a profile change', member.name)
    return sampleMembers.filter(waitingChange).map((m) => ({ memberId: m.id, role: m.role, name: m.name, birthDate: m.birthDate, requestedName: m.changeRequest?.name ?? '', requestedBirthDate: m.changeRequest?.birthDate ?? '', requestedAt: m.changeRequest?.requestedAt ?? '' }))
  })

export const rejectMemberChange = (actorId: string, memberId: string, reason: string) =>
  settle<MemberChangeRow[]>(() => {
    const member = memberOf(memberId)
    if (!member.changeRequest || member.changeRequest.rejectedReason) throw new Error('This account has no change waiting.')
    if (!reason.trim()) throw new Error('Say why it was turned down.')
    member.changeRequest = { ...member.changeRequest, rejectedReason: reason.trim() }
    record(actorId, 'Turned down a profile change', member.name)
    return sampleMembers.filter(waitingChange).map((m) => ({ memberId: m.id, role: m.role, name: m.name, birthDate: m.birthDate, requestedName: m.changeRequest?.name ?? '', requestedBirthDate: m.changeRequest?.birthDate ?? '', requestedAt: m.changeRequest?.requestedAt ?? '' }))
  })

export const correctMember = (actorId: string, id: string, input: { name: string; birthDate: string }) =>
  settle<void>(() => {
    const member = found(sampleMembers.find((m) => m.id === id), 'Account')
    const name = input.name.trim()
    if (!name) throw new Error('Enter the name.')
    record(actorId, 'Corrected an account', name)
    member.name = name
    member.birthDate = input.birthDate
  })

export const deleteAthlete = (actorId: string, id: string) =>
  settle<void>(() => {
    const athlete = athleteOf(id)
    sampleAthletes.splice(sampleAthletes.indexOf(athlete), 1)
    record(actorId, 'Deleted an athlete account', athlete.name)
  })

// ---- Teams ----

export const saveTeam = (actorId: string, input: TeamInput, id?: string) =>
  settle<Team>(() => {
    const name = input.name.trim()
    if (!name) throw new Error('Enter the team name.')
    if (teams.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== id)) throw new Error('A team with this name already exists.')
    const values = { name, contactName: input.contactName.trim(), contactEmail: input.contactEmail.trim(), contactPhone: input.contactPhone.trim() }
    if (id) {
      const team = found(teams.find((c) => c.id === id), 'Team')
      Object.assign(team, values)
      record(actorId, 'Edited team', name)
      return team
    }
    const team: Team = { id: `team-${teams.length + 1}`, ...values }
    teams.push(team)
    record(actorId, 'Added team', name)
    return team
  })

export const deleteTeam = (actorId: string, id: string, cascade?: boolean) =>
  settle<void>(() => {
    const team = found(teams.find((c) => c.id === id), 'Team')
    confirmCascade('team', id, cascade)
    dropCompetitors(competitors.filter((c) => c.teamId === id).map((c) => c.id))
    teams.splice(teams.indexOf(team), 1)
    record(actorId, 'Deleted team', team.name)
  })

// ---- What a delete would take with it (the sample data's version of the server's preview)

function eventsOf(kind: DeleteKind, id: string): string[] {
  const match = (e: (typeof events)[number]) =>
    kind === 'event' ? e.id === id : kind === 'competition' ? e.competitionId === id : kind === 'ageGroup' ? e.ageGroup === id : (e.kind ?? 'standard') === id
  return events.filter(match).map((e) => e.id)
}

function dropEvents(ids: string[]) {
  for (const id of ids) {
    const event = events.find((e) => e.id === id)
    if (!event) continue
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i].eventId === id) entries.splice(i, 1)
    for (let i = rounds.length - 1; i >= 0; i--) if (rounds[i].eventId === id) rounds.splice(i, 1)
    const order = orderFor(event.competitionId)
    if (order.includes(id)) order.splice(order.indexOf(id), 1)
    const panel = panels.findIndex((p) => p.eventId === id)
    if (panel >= 0) panels.splice(panel, 1)
    events.splice(events.indexOf(event), 1)
  }
}

function dropCompetitors(ids: string[]) {
  for (const id of ids) {
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i].competitorId === id) entries.splice(i, 1)
    const index = competitors.findIndex((c) => c.id === id)
    if (index >= 0) competitors.splice(index, 1)
  }
}

function impactItems(label: string, n: number, effect: 'delete' | 'change' = 'delete'): DeleteImpactItem[] {
  return n > 0 ? [{ label, count: n, examples: [], effect }] : []
}

function underEvents(ids: string[]): DeleteImpactItem[] {
  const mine = entries.filter((e) => ids.includes(e.eventId))
  const scratched = mine.filter((e) => e.scratched).length
  return [
    ...impactItems(scratched > 0 ? `Entries (${scratched} scratched)` : 'Entries', mine.length),
    ...impactItems('Rounds', rounds.filter((r) => ids.includes(r.eventId)).length),
  ]
}

export const getDeleteImpact = (kind: DeleteKind, id: string) =>
  settle<DeleteImpact>(() => deleteImpactOf(kind, id))

function deleteImpactOf(kind: DeleteKind, id: string): DeleteImpact {
  const base = { kind, id }
  if (kind === 'event') {
    const event = found(events.find((e) => e.id === id), 'Event')
    return { ...base, name: `E${event.number}`, items: underEvents([id]) }
  }
  if (kind === 'competition' || kind === 'ageGroup' || kind === 'eventKind') {
    const name =
      kind === 'competition'
        ? found(competitions.find((c) => c.id === id), 'Competition').name
        : kind === 'ageGroup'
          ? found(ageGroups.find((g) => g.id === id), 'Age group').name
          : found(eventKinds.find((k) => k.id === id), 'Kind').name
    const ids = eventsOf(kind, id)
    return { ...base, name, items: [...impactItems('Events', ids.length), ...underEvents(ids)] }
  }
  if (kind === 'team') {
    const team = found(teams.find((c) => c.id === id), 'Team')
    const dancers = competitors.filter((c) => c.teamId === id).map((c) => c.id)
    return { ...base, name: team.name, items: [...impactItems('Dancers and couples', dancers.length), ...impactItems('Entries', entries.filter((e) => dancers.includes(e.competitorId)).length)] }
  }
  if (kind === 'coach') {
    const coach = found(coaches.find((c) => c.id === id), 'Coach')
    return { ...base, name: coach.name, items: impactItems('Dancers left without a coach', competitors.filter((c) => c.details?.coachId === id).length, 'change') }
  }
  if (kind === 'competitor') {
    const competitor = found(competitors.find((c) => c.id === id), 'Competitor')
    return { ...base, name: competitor.names.join(' & '), items: impactItems('Entries', entries.filter((e) => e.competitorId === id).length) }
  }
  const adjudicator = found(adjudicators.find((a) => a.id === id), 'Adjudicator')
  return { ...base, name: adjudicator.name, items: impactItems('Panel places', panels.filter((p) => p.adjudicatorIds.includes(id)).length) }
}

function confirmCascade(kind: DeleteKind, id: string, cascade: boolean | undefined) {
  const impact = deleteImpactOf(kind, id)
  if (impact.items.length > 0 && !cascade) throw new Error(`${impact.name} has related data. Confirm to delete it too.`)
}
