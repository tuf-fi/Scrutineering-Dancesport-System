import {
  Role,
  RoundStatus,
  type AgeGroup,
  type Class,
  type Discipline,
  type PaymentStatus,
  type SessionUser,
} from '@bis/shared'
import { adjudicatorPins, adjudicators, panels } from './data/adjudicators.ts'
import { clubs } from './data/clubs.ts'
import { competitions, currentCompetitionId } from './data/competitions.ts'
import { competitors } from './data/competitors.ts'
import { entries } from './data/entries.ts'
import { events } from './data/events.ts'
import { payments } from './data/payments.ts'
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

export const getStaffUsers = () => reply(staffUsers)
export const getAuditLog = () => reply(auditLog)

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

export const signInStaff = (username: string, password: string) =>
  settle<SessionUser>(() => {
    const user = staffUsers.find((s) => s.username === username.trim().toLowerCase())
    if (!user || password !== SAMPLE_PASSWORD) throw new Error('Wrong username or password.')
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
