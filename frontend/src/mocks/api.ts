import {
  PaymentStatus,
  Role,
  RoundStatus,
  type Adjudicator,
  type AdjudicatorPin,
  type AgeGroup,
  type Class,
  type Competition,
  type CompetitorHistoryLine,
  type Discipline,
  type Panel,
  type PaymentDetail,
  type PointsRow,
  type SessionUser,
  type StaffUser,
} from '@bis/shared'
import { adjudicatorPins, adjudicators, panels } from './data/adjudicators.ts'
import { clubs } from './data/clubs.ts'
import { competitions, currentCompetitionId } from './data/competitions.ts'
import { competitors } from './data/competitors.ts'
import { entries } from './data/entries.ts'
import { events } from './data/events.ts'
import { paymentDetail, payments } from './data/payments.ts'
import { heats, rounds } from './data/progress.ts'
import { pointsTable, rankingPoints, results } from './data/results.ts'
import { auditLog, staffUsers } from './data/staff.ts'
import { isLiveRound, liveRoundComplete, visibleMarks } from './realtime.ts'

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
  return isLiveRound(round.id) && liveRoundComplete()
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

export interface RankingFilter {
  ageGroup?: AgeGroup
  class?: Class
  discipline?: Discipline
}

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

export type CompetitionInput = Omit<Competition, 'id'>

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
    if (!club || password !== SAMPLE_PASSWORD) throw new Error('Wrong email or password.')
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
