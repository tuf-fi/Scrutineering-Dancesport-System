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
  // Online only: the venue that downloaded this competition and runs it. While set, entries and payments are closed online.
  heldBy?: string | null
  heldAt?: Timestamp | null
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
  // Added at the venue after entries closed
  late?: boolean
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

// One entry a payment covers, ready to show in the admin's checking view
export interface PaymentLine {
  entryId: Id
  eventId: Id
  eventNumber: number
  dances: Dance[]
  competitorNames: string[]
  fee: number
}

export interface PaymentDetail extends Payment {
  clubName: string
  lines: PaymentLine[]
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
  // Set when a phone that was marking has stopped sending heartbeats: when it was last heard from
  quietSince?: Timestamp | null
  // The phone has confirmed marks for this round saved on it that the server does not have yet
  holdingMarks?: boolean
}

export interface Result {
  id: Id
  eventId: Id
  competitorId: Id
  // Shared places such as 13 for a 13th to 18th tie are stored as the lowest place number
  place: number
  // The whole shared range, e.g. 13 to 18; equal to place when not shared. Absent in sample data.
  placeFrom?: number
  placeTo?: number
  approvedBy: Id
  approvedAt: Timestamp
}

// One result in a competitor's history, with the event and competition it came from
export interface CompetitorHistoryLine {
  resultId: Id
  competitionId: Id
  competitionName: string
  competitionDate: string
  eventNumber: number
  dances: Dance[]
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  place: number
  points: number
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

// One entry shown in the secretariat's event view
export interface EntryRow {
  entryId: Id
  competitorId: Id
  names: string[]
  backNumber: number | null
  clubName: string
  scratched: boolean
  late: boolean
  // null when no payment is linked (past competitions)
  paymentStatus: PaymentStatus | null
}

export interface CompetitorRow extends Competitor {
  clubName: string
  // Entries that are not scratched, across all competitions
  entryCount: number
}

// A late entry with its event and what the club owes for it
export interface LateEntryRow extends EntryRow {
  eventId: Id
  eventNumber: number
  dances: Dance[]
  fee: number
  paymentId: Id
}

export interface ScheduleItem {
  eventId: Id
  // 1 is first on the floor
  position: number
  eventNumber: number
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  dances: Dance[]
  isSolo: boolean
  rounds: Array<{ type: RoundType; status: RoundStatus }>
}

export interface ImportResult {
  created: number
  // Rows that could not be imported, by line number in the file
  skipped: Array<{ line: number; reason: string }>
}

// One competitor an adjudicator may mark in a round
export interface MarkingCompetitor {
  id: Id
  backNumber: number | null
  // null when the round has no heats yet
  heat: number | null
}

// What an adjudicator marks in the round that is on the floor
export interface MarkingTask {
  round: Round
  event: Event
  // Marks an X for exactly this many competitors per dance; null in the final, which is placed instead
  recallNumber: number | null
  dances: Dance[]
  competitors: MarkingCompetitor[]
}

export type AdjudicatorState =
  | { status: 'waiting' }
  | { status: 'marking'; task: MarkingTask }
  | { status: 'submitted'; task: MarkingTask }

// One dance's marks: the competitors given an X, or in a final everyone in order from 1st place down
export interface MarkSubmission {
  dance: Dance
  competitorIds: Id[]
}

export interface DemoRound {
  roundId: Id
  label: string
}

// A round in the scrutineer's dashboard, with its event
export interface RoundRow {
  roundId: Id
  eventId: Id
  eventNumber: number
  dances: Dance[]
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  type: RoundType
  recallNumber: number | null
  status: RoundStatus
  heatCount: number
  entryCount: number
}

export interface HeatAssignment {
  competitorId: Id
  heat: number
}

export interface RecallRow {
  competitorId: Id
  backNumber: number | null
  names: string[]
  xCount: number
  rank: number
  // tied: on the cutoff with the same X count as someone outside it, and not decided yet
  outcome: 'recalled' | 'tied' | 'out'
}

export interface TieDecision {
  // Recall everyone on the tie, or only those above it
  choice: 'more' | 'fewer'
  proposedBy: Id
  confirmedBy: Id | null
}

export interface RecallTable {
  roundId: Id
  recallNumber: number
  adjudicatorCount: number
  submittedCount: number
  rows: RecallRow[]
  // How many will be recalled under the current decision
  recalled: number
  tie: { xCount: number; count: number; decision: TieDecision | null } | null
}

export interface SkatingRow {
  competitorId: Id
  backNumber: number | null
  names: string[]
  // Each adjudicator's placing, or 1 or 0 for an X in earlier rounds; null when they have not marked yet
  marks: Record<Id, number | null>
  // Single-dance final: how many adjudicators placed this competitor at or above 1st, 2nd, 3rd...
  majority: number[]
  total: number
  // The place as the MC reads it; a shared place shows its best place, e.g. 2 for a tie for 2nd and 3rd
  place: number
  shared: boolean
  // Multi-dance final: the place in each dance, and the rule that decided the overall place
  dancePlaces: Array<{ dance: Dance; place: number }>
  decidedBy: 'total' | 'rule10' | 'rule11' | 'shared' | null
}

export interface SkatingTable {
  roundId: Id
  kind: 'x' | 'placing'
  // False until every adjudicator on the panel has submitted; places are provisional until then
  complete: boolean
  adjudicators: Array<{ id: Id; letter: string }>
  places: number
  rows: SkatingRow[]
}

// One thing for the MC to read out; the MC steps through them in order
export interface Announcement {
  id: Id
  kind: 'call' | 'recall' | 'finalists' | 'result'
  eventNumber: number
  dances: Dance[]
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  roundType: RoundType
  // call: the heat going to the floor
  heat: number | null
  // call, recall, finalists: the back numbers to read, lowest first
  numbers: number[]
  // result: one competitor and their place
  result: { place: number; backNumber: number | null; names: string[]; clubName: string } | null
}

// What a club may keep about a dancer: a name and an age group, nothing more (Data Privacy Act)
export interface ClubDancer {
  id: Id
  names: string[]
  ageGroup: AgeGroup | null
  // Entries that are not scratched, in the current competition
  entryCount: number
}

// An event a dancer could be entered in, from the club's point of view
export interface EntryOption {
  eventId: Id
  eventNumber: number
  dances: Dance[]
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  fee: number
  entered: boolean
  // Already paid or sent for checking, so it can no longer be withdrawn here
  locked: boolean
}

export interface PaymentMethod {
  name: string
  accountName: string
  number: string
  note?: string
}

export interface ClubSignUp {
  name: string
  contactName: string
  contactEmail: string
  contactPhone: string
  password: string
}

export type CompetitionInput = Omit<Competition, 'id'>

export type EventInput = Omit<Event, 'id' | 'competitionId'>

export interface RankingFilter {
  ageGroup?: AgeGroup
  class?: Class
  discipline?: Discipline
}

// What the venue server says about its database copies
export interface BackupStatus {
  targets: Array<{ path: string; ok: boolean; lastBackupAt: Timestamp | null; error: string | null }>
  lastBackupAt: Timestamp | null
}

// The sample app's sign-in hints; the real server never sends these
export interface SampleCredentials {
  password: string
  usernames: string[]
  clubEmail: string
  pins: Array<{ letter: string; pin: string }>
}

// ---- Syncing the venue with the cloud ----

export interface SyncStatus {
  // False when this server has no cloud address: it works on its own
  enabled: boolean
  venueId: string
  cloudUrl: string | null
  // Changes waiting to go to the cloud, and how many of them have already failed once
  pending: number
  failing: number
  lastUploadAt: Timestamp | null
  lastError: string | null
  // Whether the cloud answered the last time it was tried; null before the first try
  reachable: boolean | null
  // Competitions downloaded here, and so run from here
  held: Id[]
}

// A competition on the cloud, as the venue sees it when choosing one to download
export interface CloudCompetition {
  id: Id
  name: string
  date: string
  venue: string
  organizer: string
  // The venue that has downloaded it, if any
  heldBy: string | null
  heldAt: Timestamp | null
  entries: number
}

export interface PullSummary {
  competitionId: Id
  // How many rows of each kind were new here
  added: Record<string, number>
  // Entries not downloaded because they are not paid yet
  excludedEntries: number
}
