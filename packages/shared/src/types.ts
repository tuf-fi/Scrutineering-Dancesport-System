import type {
  AgeGroup,
  Class,
  Dance,
  Discipline,
  PaymentStatus,
  Role,
  RoundStatus,
  RoundType,
  SubmissionStatus,
} from './enums.ts'

export type Id = string
// ISO 8601 string
export type Timestamp = string

export interface Competition {
  id: Id
  name: string
  date: string
  venue: string
  organizer: string
}

export interface Event {
  id: Id
  competitionId: Id
  // Event number, e.g. 47 for E47
  number: number
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  dances: Dance[]
  isSolo: boolean
}

export interface Club {
  id: Id
  name: string
  contactName: string
  contactEmail: string
  contactPhone: string
}

export interface Competitor {
  id: Id
  // A couple has two names; a solo dancer has one
  names: string[]
  backNumber: number | null
  clubId: Id
}

export interface Entry {
  id: Id
  eventId: Id
  competitorId: Id
  scratched: boolean
  paymentId: Id | null
}

export interface Payment {
  id: Id
  clubId: Id
  entryIds: Id[]
  amountDue: number
  amountPaid: number | null
  referenceNumber: string | null
  receiptUrl: string | null
  status: PaymentStatus
  rejectionReason: string | null
  checkedBy: Id | null
  checkedAt: Timestamp | null
}

export interface Adjudicator {
  id: Id
  name: string
  // A to J
  letter: string
}

export interface AdjudicatorPin {
  competitionId: Id
  adjudicatorId: Id
  pin: string
}

export interface Panel {
  id: Id
  eventId: Id
  adjudicatorIds: Id[]
}

export interface Round {
  id: Id
  eventId: Id
  type: RoundType
  // Number of competitors each adjudicator must mark X; null for the final
  recallNumber: number | null
  status: RoundStatus
}

export interface Heat {
  id: Id
  roundId: Id
  number: number
  competitorIds: Id[]
}

interface MarkBase {
  id: Id
  roundId: Id
  adjudicatorId: Id
  competitorId: Id
  dance: Dance
  submittedAt: Timestamp
}

// Every round before the final uses X marks; the final uses placings
export type Mark =
  | (MarkBase & { kind: 'x' })
  | (MarkBase & { kind: 'placing'; placing: number })

// One adjudicator's progress in a round; pushed live to the scrutineer board
export interface AdjudicatorSubmission {
  roundId: Id
  adjudicatorId: Id
  status: SubmissionStatus
  submittedAt: Timestamp | null
}

export interface Result {
  id: Id
  eventId: Id
  competitorId: Id
  // Shared places such as 13 for a 13th to 18th tie are stored as the lowest place number
  place: number
  approvedBy: Id
  approvedAt: Timestamp
}

export interface PointsRow {
  // 1 to 7 for placings, null for the semi-final row
  place: number | null
  label: string
  points: number
}

export interface RankingPoint {
  id: Id
  competitorId: Id
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  competitionId: Id
  points: number
}

export interface StaffUser {
  id: Id
  name: string
  username: string
  role: Role
}

// Who is signed in on this device
export interface SessionUser {
  id: Id
  name: string
  role: Role
  // Adjudicators only: their letter on the panel
  letter?: string
}

export interface AuditEntry {
  id: Id
  actorId: Id
  action: string
  target: string
  at: Timestamp
}
