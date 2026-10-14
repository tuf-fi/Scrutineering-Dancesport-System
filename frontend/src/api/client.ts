// The real API: every function the screens use, sent to the venue server.
// Names and arguments match the sample API in ../mocks/api.ts, so screens and hooks do not change.
// Writes still take the actor's id first, but the server ignores it and uses the signed-in session.
import type {
  Adjudicator,
  AdjudicatorPin,
  AdjudicatorState,
  AdjudicatorSubmission,
  Announcement,
  AgeGroup,
  AuditEntry,
  BackupStatus,
  Club,
  ClubDancer,
  ClubSignUp,
  Competition,
  CompetitionInput,
  Competitor,
  CompetitorHistoryLine,
  CompetitorRow,
  Entry,
  EntryOption,
  DemoRound,
  EntryRow,
  Event,
  EventInput,
  HeatAssignment,
  Heat,
  ImportResult,
  LateEntryRow,
  Mark,
  MarkingTask,
  MarkSubmission,
  Panel,
  Payment,
  PaymentDetail,
  PaymentMethod,
  PaymentStatus,
  PointsRow,
  RankingFilter,
  RankingPoint,
  RecallTable,
  Result,
  Role,
  SampleCredentials,
  Round,
  RoundRow,
  ScheduleItem,
  SessionUser,
  SkatingTable,
  StaffUser,
  TieDecision,
} from '@bis/shared'
import { auth, call, getSessionFromServer } from './http.ts'

export type { CompetitionInput, EventInput, RankingFilter } from '@bis/shared'
export { subscribeSubmissions, getSubmissionSnapshot } from './realtime.ts'

// ---- Reading ----

export const getCompetitions = () => call<Competition[]>('getCompetitions')
export const getCompetition = (id: string) => call<Competition>('getCompetition', id)
export const getEvents = (competitionId?: string) => call<Event[]>('getEvents', competitionId)
export const getEvent = (id: string) => call<Event>('getEvent', id)
export const getEntries = (eventId: string) => call<Entry[]>('getEntries', eventId)
export const getCompetitors = () => call<Competitor[]>('getCompetitors')
export const getClubs = () => call<Club[]>('getClubs')
export const getAdjudicators = () => call<Adjudicator[]>('getAdjudicators')
export const getAdjudicatorPins = (competitionId: string) => call<AdjudicatorPin[]>('getAdjudicatorPins', competitionId)
export const getPanel = (eventId: string) => call<Panel>('getPanel', eventId)
export const getPanels = (competitionId: string) => call<Panel[]>('getPanels', competitionId)
export const getRounds = (eventId: string) => call<Round[]>('getRounds', eventId)
export const getRound = (id: string) => call<Round>('getRound', id)
export const getHeats = (roundId: string) => call<Heat[]>('getHeats', roundId)
export const getMarks = (roundId: string) => call<Mark[]>('getMarks', roundId)
export const getResults = (eventId: string) => call<Result[]>('getResults', eventId)
export const getPayments = (status?: PaymentStatus) => call<Payment[]>('getPayments', status)
export const getPaymentDetails = () => call<PaymentDetail[]>('getPaymentDetails')
export const getPointsTable = () => call<PointsRow[]>('getPointsTable')
export const getRankingPoints = (filter: RankingFilter = {}) => call<RankingPoint[]>('getRankingPoints', filter)
export const getCompetitorHistory = (competitorId: string) => call<CompetitorHistoryLine[]>('getCompetitorHistory', competitorId)
export const getStaffUsers = () => call<StaffUser[]>('getStaffUsers')
export const getAuditLog = () => call<AuditEntry[]>('getAuditLog')
export const getResultEventIds = (competitionId: string) => call<string[]>('getResultEventIds', competitionId)

// ---- Admin ----

export const saveCompetition = (_actorId: string, input: CompetitionInput, id?: string) =>
  call<Competition>('saveCompetition', input, id)
export const deleteCompetition = (_actorId: string, id: string) => call<{ id: string }>('deleteCompetition', id)
export const createStaffUser = (_actorId: string, input: { name: string; username: string; role: Role }) =>
  call<{ user: StaffUser; tempPassword: string }>('createStaffUser', input)
export const updateStaffUser = (_actorId: string, id: string, input: { name: string; role: Role }) =>
  call<StaffUser>('updateStaffUser', id, input)
export const deleteStaffUser = (_actorId: string, id: string) => call<{ id: string }>('deleteStaffUser', id)
export const resetStaffPassword = (_actorId: string, id: string) => call<{ tempPassword: string }>('resetStaffPassword', id)
export const createAdjudicator = (_actorId: string, input: { name: string; letter: string }) =>
  call<Adjudicator>('createAdjudicator', input)
export const updateAdjudicator = (_actorId: string, id: string, input: { name: string }) =>
  call<Adjudicator>('updateAdjudicator', id, input)
export const deleteAdjudicator = (_actorId: string, id: string) => call<{ id: string }>('deleteAdjudicator', id)
export const generatePins = (_actorId: string, competitionId: string, adjudicatorId?: string) =>
  call<AdjudicatorPin[]>('generatePins', competitionId, adjudicatorId)
export const setPanel = (_actorId: string, eventId: string, adjudicatorIds: string[]) =>
  call<Panel>('setPanel', eventId, adjudicatorIds)
export const savePointsTable = (_actorId: string, rows: PointsRow[]) => call<PointsRow[]>('savePointsTable', rows)
export const approvePayment = (_adminId: string, id: string) => call<PaymentDetail>('approvePayment', id)
export const rejectPayment = (_adminId: string, id: string, reason: string) => call<PaymentDetail>('rejectPayment', id, reason)

// ---- Secretariat ----

export const getCompetitionEntries = (competitionId: string) => call<Entry[]>('getCompetitionEntries', competitionId)
export const getEntryRows = (eventId: string) => call<EntryRow[]>('getEntryRows', eventId)
export const setEntryScratched = (_actorId: string, entryId: string, scratched: boolean) =>
  call<EntryRow>('setEntryScratched', entryId, scratched)
export const getCompetitorRows = () => call<CompetitorRow[]>('getCompetitorRows')
export const createCompetitor = (_actorId: string, input: { names: string[]; clubId: string }) =>
  call<CompetitorRow>('createCompetitor', input)
export const setBackNumber = (_actorId: string, competitorId: string, backNumber: number | null) =>
  call<CompetitorRow>('setBackNumber', competitorId, backNumber)
export const assignBackNumbers = (_actorId: string) => call<number>('assignBackNumbers')
export const importCompetitors = (_actorId: string, rows: Array<{ names: string[]; clubName: string }>) =>
  call<ImportResult>('importCompetitors', rows)
// The server reads the file itself, so quoted fields with commas come through intact
export const importCompetitorsCsv = (_actorId: string, text: string) => call<ImportResult>('importCompetitorsCsv', text)
export const getLateEntries = (competitionId: string) => call<LateEntryRow[]>('getLateEntries', competitionId)
export const createLateEntry = (_actorId: string, input: { competitorId: string; eventId: string; paidInCash: boolean }) =>
  call<LateEntryRow>('createLateEntry', input)
export const markPaidAtVenue = (_actorId: string, paymentId: string) => call<PaymentDetail>('markPaidAtVenue', paymentId)
export const getSchedule = (competitionId: string) => call<ScheduleItem[]>('getSchedule', competitionId)
export const moveScheduledEvent = (_actorId: string, competitionId: string, eventId: string, direction: 'up' | 'down') =>
  call<ScheduleItem[]>('moveScheduledEvent', competitionId, eventId, direction)
export const updateCompetitor = (_actorId: string, id: string, input: { names: string[]; clubId: string }) =>
  call<CompetitorRow>('updateCompetitor', id, input)
export const deleteCompetitor = (_actorId: string, id: string) => call<void>('deleteCompetitor', id)
export const deleteLateEntry = (_actorId: string, entryId: string) => call<void>('deleteLateEntry', entryId)
export const updateLateEntry = (_actorId: string, entryId: string, input: { eventId: string; paidInCash: boolean }) =>
  call<LateEntryRow>('updateLateEntry', entryId, input)
export const saveEvent = (_actorId: string, competitionId: string, input: EventInput, id?: string) =>
  call<Event>('saveEvent', competitionId, input, id)
export const deleteEvent = (_actorId: string, id: string) => call<void>('deleteEvent', id)

// ---- Adjudicator ----

export const getAdjudicatorState = (_adjudicatorId: string) => call<AdjudicatorState>('getAdjudicatorState')
export const submitAdjudicatorMarks = (_adjudicatorId: string, roundId: string, submissions: MarkSubmission[]) =>
  call<void>('submitAdjudicatorMarks', roundId, submissions)

// ---- Scrutineer ----

export const getCurrentRoundId = () => call<string>('getCurrentRoundId')
export const getCompetitionRounds = (competitionId: string) => call<RoundRow[]>('getCompetitionRounds', competitionId)
export const planRounds = (_actorId: string, competitionId: string) => call<number>('planRounds', competitionId)
export const startRound = (_actorId: string, roundId: string) => call<void>('startRound', roundId)
export const clearFloor = (_actorId: string, competitionId?: string) => call<void>('clearFloor', competitionId)
export const getHeatAssignments = (roundId: string) => call<HeatAssignment[]>('getHeatAssignments', roundId)
export const saveHeats = (_actorId: string, roundId: string, assignments: HeatAssignment[]) =>
  call<void>('saveHeats', roundId, assignments)
export const getMarkingTask = (roundId: string) => call<MarkingTask>('getMarkingTask', roundId)
export const getSubmissions = (roundId: string) => call<AdjudicatorSubmission[]>('getSubmissions', roundId)
export const enterAdjudicatorMarks = (_actorId: string, adjudicatorId: string, roundId: string, submissions: MarkSubmission[]) =>
  call<void>('enterAdjudicatorMarks', adjudicatorId, roundId, submissions)
export const getRecallTable = (roundId: string) => call<RecallTable>('getRecallTable', roundId)
export const proposeTieDecision = (_actorId: string, roundId: string, choice: TieDecision['choice']) =>
  call<void>('proposeTieDecision', roundId, choice)
export const confirmTieDecision = (_actorId: string, roundId: string) => call<void>('confirmTieDecision', roundId)
export const getSkatingTable = (roundId: string) => call<SkatingTable>('getSkatingTable', roundId)
export const approveRound = (_actorId: string, roundId: string) => call<void>('approveRound', roundId)
export const publishRound = (_actorId: string, roundId: string) => call<void>('publishRound', roundId)
export const getBackupStatus = () => call<BackupStatus>('getBackupStatus')

// ---- MC ----

export const getAnnouncements = () => call<Announcement[]>('getAnnouncements')

// ---- Club portal ----

export const getClubDancers = (_clubId: string) => call<ClubDancer[]>('getClubDancers')
export const saveClubDancer = (_clubId: string, input: { names: string[]; ageGroup: AgeGroup }, id?: string) =>
  call<ClubDancer>('saveClubDancer', input, id)
export const deleteClubDancer = (_clubId: string, id: string) => call<void>('deleteClubDancer', id)
export const getEntryOptions = (_clubId: string, dancerId: string) => call<EntryOption[]>('getEntryOptions', dancerId)
export const registerClubEntries = (_clubId: string, dancerId: string, eventIds: string[]) =>
  call<void>('registerClubEntries', dancerId, eventIds)
export const getClubPayments = (_clubId: string) => call<PaymentDetail[]>('getClubPayments')
export const getPaymentMethods = () => call<PaymentMethod[]>('getPaymentMethods')
export const submitClubPayment = (_clubId: string, input: { amountPaid: number; referenceNumber: string; receiptUrl: string }) =>
  call<void>('submitClubPayment', input)

// ---- Signing in and out: separate routes, because they set or clear the cookie ----

export const signInStaff = (username: string, password: string) => auth<SessionUser>('staff', { username, password })
export const signInClub = (email: string, password: string) => auth<SessionUser>('club', { email, password })
export const signInAdjudicator = (pin: string) => auth<SessionUser>('adjudicator', { pin })
export const signUpNewClub = (input: ClubSignUp) => auth<SessionUser>('club-signup', input)
export const signOut = () => auth<null>('sign-out', {})
// Who the cookie belongs to, or null: used when the page loads
export const getSession = () => getSessionFromServer<SessionUser | null>()

// ---- Sample app only: the real server has no demo controls or sample sign-ins, and the screens hide them ----

export const getDemoRounds = async (): Promise<DemoRound[]> => []
export const startDemoRoundOnFloor = async (_roundId: string | null): Promise<void> => {}
export const getSampleCredentials = async (): Promise<SampleCredentials> => ({ password: '', usernames: [], clubEmail: '', pins: [] })
