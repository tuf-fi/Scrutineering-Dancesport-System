import type {
  AgeGroup,
  Class,
  Dance,
  Discipline,
  EventKind,
  PayMethod,
  PaymentStatus,
  ProgramKind,
  ProgramStatus,
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
  // Who runs the scoring and results, printed as the Executor on result sheets; empty means the organizer
  executor?: string
  // YYYY-MM-DD; after these the secretariat is warned that an entry is late or unpaid
  entryDeadline?: string | null
  feeDeadline?: string | null
  // The photo on its card on the home page: a JPEG, PNG or WebP picture as a data URL
  image?: string | null
  // Whether its results count towards the rankings; a competition without points awards none
  usesPoints: boolean
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
  // A missing kind is a standard event
  kind?: EventKind
  // The province a closed event is open to
  province?: string
  // What the adjudicators may use in this event, shown under their numbers; empty uses the standard text for the age group
  syllabus?: string
}

export interface Team {
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
  teamId: Id
  details?: CompetitorDetails
}

// What the entry form asks for about each dancer
export type Gender = 'female' | 'male'

export interface DancerDetails {
  // YYYY-MM-DD
  birthDate: string
  // Only the Bicol Athletes list uses it (solo junior female); empty when not asked
  gender?: Gender | ''
  address: string
  email: string
  phone: string
}

// The rest of the entry form: where the team is from, its coach, and the membership
export interface CompetitorDetails {
  province: string
  coachId: Id | null
  // One entry per name; a dancer without details has empty fields
  dancers: DancerDetails[]
  // A Bicol Grassroots Beginners athlete: no regional or national experience
  beginner: boolean
  // The year the athletes' membership was last paid for; it lasts until December
  memberYear: number | null
  memberMonth?: number | null
}

export interface Coach {
  id: Id
  name: string
  email: string
  phone: string
  // The years the coach's membership and Coaches Summit were last paid for
  memberYear: number | null
  summitYear: number | null
  // The month the membership was paid for (1 to 12), and what the Summit payment covers: a quarter or a competition name
  memberMonth?: number | null
  summitPeriod?: string | null
  // Given once, the first time the membership fee is paid: C-00001
  membershipId?: string | null
  // The dates the coach attended a Coaches Summit, newest first
  summits?: string[]
}

export type CoachInput = Omit<Coach, 'id' | 'membershipId'>

// What the secretariat charges, from the organizer's entry form. A tier has a price for the first entry of a
// dancer or couple and a lower one for each extra entry.
export interface FeeTier {
  first: number
  additional: number
}

export interface FeeSchedule {
  soloJuvenile: FeeTier
  soloOlder: FeeTier
  coupleJuvenile: FeeTier
  coupleOlder: FeeTier
  // Inter-collegiate and ranking events: one price each, never discounted
  fixed: number
  athleteMembership: number
  coachMembership: number
  coachesSummit: number
}

export interface FeeLine {
  label: string
  amount: number
}

export interface RegistrationQuote {
  lines: FeeLine[]
  total: number
  // The coach, when they have not paid this year; the secretariat may add their fees to this payment
  coach?: { name: string; membershipDue: boolean; summitDue: boolean }
  // Things the secretariat should look at; they do not stop the entry
  warnings: string[]
}

export interface RegistrationInput {
  competitorId: Id
  eventIds: Id[]
  method: PayMethod
  // A GCash or Maya reference number, or a bank slip number
  reference?: string
  // Also collect what the dancer's coach has not paid this year
  coachFees?: { membership: boolean; summit: boolean }
}

export interface RegistrationResult extends RegistrationQuote {
  paymentId: Id
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
  teamId: Id
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
  teamName: string
  lines: PaymentLine[]
}

export interface Adjudicator {
  id: Id
  name: string
  // A to J
  letter: string
  // A picture of the adjudicator; a new adjudicator always has one
  photo?: string | null
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
  eventId: Id
  competitorId: Id
  competitionId: Id
  competitionName: string
  competitionDate: string
  eventNumber: number
  dances: Dance[]
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  place: number
  // The whole shared range when a final ended in a tie, e.g. 3 to 4; equal to place when not shared
  placeFrom?: number
  placeTo?: number
  points: number
}

export interface PointsRow {
  // 1 to 7 for placings, null for a row given to everyone cut in a round
  place: number | null
  // Which round that row is for; a row without one is the semi-final
  round?: 'semi_final' | 'quarter_final'
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
  // Whether two-step sign-in is on for this account
  twoStep?: boolean
  // A picture of the person; a new account always has one
  photo?: string | null
}

// Who is signed in on this device
export interface SessionUser {
  id: Id
  name: string
  role: Role
  // Adjudicators only: their letter on the panel
  letter?: string
  // Sign-up only: a confirmation link was emailed to the new account
  confirmEmail?: boolean
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
  teamName: string
  scratched: boolean
  late: boolean
  // null when no payment is linked (past competitions)
  paymentStatus: PaymentStatus | null
}

export interface CompetitorRow extends Competitor {
  teamName: string
  // Entries that are not scratched, across all competitions
  entryCount: number
}

// A late entry with its event and what the team owes for it
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

// One line of the running order: a round, a break or the awarding
export interface ProgramRow {
  slotId: Id
  // 1 is first
  sequence: number
  kind: ProgramKind
  // "HH:MM" on the 24 hour clock; null until the secretariat sets the start time
  startTime: string | null
  minutes: number
  // Names a break or the awarding
  label: string | null
  // The rest is set for round slots only
  eventId: Id | null
  eventNumber: number | null
  ageGroup: AgeGroup | null
  class: Class | null
  discipline: Discipline | null
  isSolo: boolean | null
  dances: Dance[]
  roundType: RoundType | null
  // How many each adjudicator marks X; null for a final
  recallNumber: number | null
  // Dancing in this round, as far as it is known
  entryCount: number
  // Letters of the adjudicators on the event's panel
  panel: string[]
  status: ProgramStatus
}

export interface Program {
  // "HH:MM"; null until set
  start: string | null
  rows: ProgramRow[]
}

export interface ProgramSlotInput {
  minutes?: number
  label?: string
}

// Two-step sign-in for the signed-in staff member
export interface TotpStatus {
  enabled: boolean
  // Recovery codes not used yet
  recoveryLeft: number
}

// What an authenticator app needs to add the account: the secret to type, and the address a QR code carries
export interface TotpSetup {
  secret: string
  uri: string
}

// Whose sessions an admin can end
export type AccountKind = 'staff' | 'adjudicator' | 'athlete' | 'member'

// A coach's or a team's own account: a name and an email to sign in with, and the coach or team record it stands for
// A coach's request to change the name or birth date on file; the secretariat decides
export interface MemberChangeRequest {
  name?: string
  birthDate?: string
  requestedAt: string
  rejectedReason?: string
}

export interface MemberChangeRow {
  memberId: string
  role: 'coach' | 'team'
  name: string
  birthDate: string
  requestedName: string
  requestedBirthDate: string
  requestedAt: string
}

export interface MemberAccount {
  id: string
  role: 'coach' | 'team'
  name: string
  email: string
  phone: string
  birthDate: string
  province: string
  address: string
  photo: string | null
  // Set once the secretariat approves the claim
  linked: { id: string; name: string } | null
  claim: { id: string; name: string; requestedAt: string } | null
  emailVerified?: boolean
  changeRequest: MemberChangeRequest | null
}

// What a coach or team can change about their own account
export interface MemberInput {
  name: string
  phone: string
  birthDate: string
  province: string
  address: string
}

export interface MemberRosterRow {
  competitorId: string
  names: string[]
  // Which events the dancer may enter; null when the entry form did not say
  ageGroup?: AgeGroup | null
  backNumber: number | null
  teamName: string
  entries: number
}

export interface MemberPaymentRow {
  id: string
  competitionName: string
  // The competition's date, YYYY-MM-DD
  date: string
  amountDue: number
  amountPaid: number | null
  status: PaymentStatus
}

// What a linked coach or team sees: their dancers, and for a team its payments, for a coach the membership years
export interface MemberRoster {
  rows: MemberRosterRow[]
  payments: MemberPaymentRow[]
  membership: { memberYear: number | null; summitYear: number | null; membershipId?: string | null; summits?: string[] } | null
}

// A coach, team or athlete account waiting to be linked to a record, as the secretariat sees it
export interface MemberClaimRow {
  memberId: string
  role: 'coach' | 'team' | 'athlete'
  name: string
  email: string
  targetId: string
  targetName: string
  requestedAt: string
}

// A membership payment the athlete reported, waiting for the secretariat to confirm it
export interface MembershipRequest {
  year: number
  // How it was paid, e.g. GCash
  method: string
  // The screenshot of the payment as a data URL. Older requests carry a reference number instead.
  receipt?: string
  reference?: string
  requestedAt: Timestamp
  // The team that paid for the athlete
  paidBy?: string
  // Set when the secretariat could not confirm it; the team can send it again
  rejectedReason?: string
}

// What a team sends when it pays the membership fee for some of its athletes
export interface TeamMembershipInput {
  athleteIds: Id[]
  method: string
  receipt: string
}

export interface TeamMembershipRow {
  id: Id
  name: string
  membershipId: string | null
  status: 'paid' | 'waiting' | 'rejected' | 'unpaid'
  reason: string | null
}

// The team's membership page: its athletes, the fee and where to pay
export interface TeamMembershipPage {
  year: number
  fee: number
  methods: PaymentMethod[]
  athletes: TeamMembershipRow[]
}

// The signed-in athlete's own page
// One step in an athlete's membership payments, newest last
export interface MembershipEvent {
  at: Timestamp
  kind: 'sent' | 'confirmed' | 'rejected'
  year: number
  method?: string
  reference?: string
  reason?: string
}

// A change of team or coach the athlete asked for; the secretariat approves or turns it down
export interface ProfileChangeRequest {
  teamId: Id | null
  coachId: Id | null
  // A new name or birth date they ask for
  name?: string
  birthDate?: string
  requestedAt: Timestamp
  rejectedReason?: string
}

export interface AthleteProfile {
  id: Id
  email: string
  name: string
  // YYYY-MM-DD, or empty until filled in
  birthDate: string
  phone: string
  address: string
  province: string
  teamId: Id | null
  coachId: Id | null
  // The year the membership was last paid for; it lasts until December
  memberYear: number | null
  // The month it was paid, when known
  memberMonth?: number | null
  // Given once, the first time the membership fee is paid: A-00001
  membershipId?: string | null
  request: MembershipRequest | null
  // A small picture as a data URL, or null for the initials
  photo: string | null
  history: MembershipEvent[]
  changeRequest: ProfileChangeRequest | null
  // False until they open the link in the confirmation email
  emailVerified?: boolean
  // The record they asked to be linked to, until the secretariat decides
  claim?: { id: Id; name: string; requestedAt: Timestamp } | null
}

// An athlete the secretariat added before they made an account
export interface AthleteRecord {
  id: Id
  name: string
  birthDate: string
  phone: string
  address: string
  province: string
  teamId: Id | null
  coachId: Id | null
  memberYear: number | null
  memberMonth?: number | null
  membershipId?: string | null
}

export type AthleteRecordInput = Omit<AthleteRecord, 'id' | 'membershipId'>

export type AthleteInput = Pick<AthleteProfile, 'name' | 'birthDate' | 'phone' | 'address' | 'province' | 'teamId' | 'coachId'>

export interface AthletePage {
  profile: AthleteProfile
  // The year a membership paid now would cover, its price, and where to pay
  year: number
  fee: number
  methods: PaymentMethod[]
}

// One athlete in the secretariat's list
export interface AthleteRow {
  id: Id
  name: string
  birthDate: string
  email: string
  phone: string
  teamName: string
  coachName: string
  memberYear: number | null
  memberMonth?: number | null
  membershipId?: string | null
  request: MembershipRequest | null
  changeRequest: ProfileChangeRequest | null
  // What they asked for: a new name or birth date, and the team and coach in words
  requestedName: string
  requestedBirthDate: string
  requestedTeamName: string
  requestedCoachName: string
}

// Something the system tells an athlete: a payment decided on, a change approved or turned down
export interface AthleteNotification {
  id: Id
  kind: 'membership_confirmed' | 'membership_rejected' | 'change_approved' | 'change_rejected' | 'link_approved' | 'link_rejected' | 'entry_approved' | 'entry_rejected'
  title: string
  detail: string
  // Where in the athlete's account it leads
  link: string | null
  createdAt: Timestamp
  // Null until the athlete has seen it
  readAt: Timestamp | null
}

// An event an adjudicator was on the panel of, and how many of its rounds they marked
export interface AdjudicatorAssignment {
  competitionId: Id
  competitionName: string
  competitionDate: string
  eventId: Id
  eventNumber: number
  dances: Dance[]
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  roundsMarked: number
}

// An entry of the competitors that carry an athlete's name
export interface MyEntry {
  entryId: Id
  eventId: Id
  competitionId: Id
  competitionName: string
  competitionDate: string
  eventNumber: number
  dances: Dance[]
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  scratched: boolean
  // Who is entered: the athlete's name, with a partner if there is one
  names: string[]
}

// What the database holds about the competitors that carry an athlete's name. Nothing is confirmed by hand.
export interface MyActivity {
  competitorIds: Id[]
  results: CompetitorHistoryLine[]
  entries: MyEntry[]
}

export interface AthleteSignUp {
  name: string
  email: string
  password: string
  // Every account has a picture: a JPEG, PNG or WebP as a data URL
  photo: string
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

// An adjudicator's drawn signature on a round, as a PNG data URL, printed on the scores sheet
export interface RoundSignature {
  adjudicatorId: Id
  signature: string
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
  // Who confirmed it, so screens need not read the staff list
  confirmedByName?: string | null
}

// A tie in a final that the Skating System leaves as a shared place
export interface FinalTieDecision {
  mode: 'keep' | 'order'
  // For 'order': the tied competitors, best first
  order: Id[]
  proposedBy: Id
  confirmedBy: Id | null
  confirmedByName?: string | null
}

export interface FinalTie {
  roundId: Id
  // Each shared place and the competitors who share it; empty when the final has no tie
  groups: Array<{ place: number; competitors: Array<{ competitorId: Id; backNumber: number | null; names: string[] }> }>
  decision: FinalTieDecision | null
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
  // The place as the compere reads it; a shared place shows its best place, e.g. 2 for a tie for 2nd and 3rd
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

// What the barker needs: who is on the floor, and who comes next, so they can line the competitors up
export interface BarkerCompetitor {
  backNumber: number | null
  names: string[]
}

export interface BarkerHeat {
  // Null when the round has no heats (a final)
  heat: number | null
  competitors: BarkerCompetitor[]
}

export interface BarkerEvent {
  eventId: Id
  eventNumber: number
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  dances: Dance[]
  isSolo: boolean
  roundType: RoundType
  heats: BarkerHeat[]
}

export interface BarkerBoard {
  competitionName: string | null
  // The rounds on the floor now
  ongoing: BarkerEvent[]
  next: BarkerEvent | null
}

// One thing for the compere to read out; the compere steps through them in order
export interface Announcement {
  id: Id
  // results: the slide that says it is time for the results, before the first place is read
  kind: 'call' | 'recall' | 'finalists' | 'results' | 'result'
  eventNumber: number
  dances: Dance[]
  ageGroup: AgeGroup
  class: Class
  discipline: Discipline
  roundType: RoundType
  // call: the heat going to the floor
  heat: number | null
  // How many couples each adjudicator selects in this round (its recall number); null in a final
  select: number | null
  // call, recall, finalists: the back numbers to read, lowest first
  numbers: number[]
  // result: one competitor and their place
  result: { place: number; backNumber: number | null; names: string[]; teamName: string } | null
}

export interface PaymentMethod {
  name: string
  accountName: string
  number: string
  note?: string
}

// What the secretariat keeps about a team
export type TeamInput = Omit<Team, 'id'>

// Leaving usesPoints out keeps what is saved, or turns points on for a new competition
export type CompetitionInput = Omit<Competition, 'id' | 'usesPoints'> & { usesPoints?: boolean }

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
  athleteEmail?: string
  coachEmail?: string
  teamEmail?: string
  pins: Array<{ letter: string; pin: string }>
}

// What teams pay and where to send it, set by the organizer. No flat fees means late entries are closed until they are set.
export interface PaymentSettings {
  fees: { solo: number; couple: number } | null
  methods: PaymentMethod[]
  // The secretariat's fee schedule; the organizer's 2026 form is used until one is saved
  schedule?: FeeSchedule
}

// ---- Entering a competition online ----

export type EntryRequestStatus = 'waiting' | 'approved' | 'rejected'

// What a team (or an athlete, for themselves) sends: who, which events, and the payment already made
export interface EntryRequestInput {
  competitorId: Id
  eventIds: Id[]
  // GCash, Maya or bank; cash and unpaid are for the venue
  method: PayMethod
  reference: string
  // A screenshot of the payment as a data URL
  receipt: string
}

export interface EntryRequest {
  id: Id
  competitorId: Id
  names: string[]
  competitionId: Id
  competitionName: string
  eventNumbers: number[]
  total: number
  warnings: string[]
  method: PayMethod
  reference: string
  status: EntryRequestStatus
  rejectedReason: string | null
  createdAt: Timestamp
  decidedAt: Timestamp | null
  // Who sent it: a team's account or an athlete
  requesterRole: 'team' | 'athlete'
  requesterName: string
  // Only the secretariat gets the screenshot back
  receipt?: string
}

// A pop-up pushed to the screens of some roles the moment something needs their attention. Nothing is stored; it is only
// shown to whoever has a screen open at that moment.
export interface AlertNote {
  title: string
  detail: string
  // Where in the app it leads
  link: string | null
}

// What a delete would take with it, so a screen can show it before the person confirms
export type DeleteKind = 'event' | 'competition' | 'ageGroup' | 'eventKind' | 'team' | 'coach' | 'competitor' | 'adjudicator' | 'staff' | 'athlete'

export interface DeleteImpactItem {
  label: string
  count: number
  // One line for each record, so the person can see exactly what the count is made of; empty for plain counts such as marks
  lines: string[]
  // 'delete' rows go; 'change' rows stay (people, adjudicators) and only lose a link to what is being deleted
  effect: 'delete' | 'change'
}

export interface DeleteImpact {
  kind: DeleteKind
  id: string
  name: string
  // Set when it cannot be deleted yet, such as a team that still has dancers
  blocked: string | null
  items: DeleteImpactItem[]
}

// What the admin sets for the public home page
export interface SiteSettings {
  // A data URL, or null for the built-in picture
  heroImage: string | null
}
