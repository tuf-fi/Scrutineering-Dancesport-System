// The real API: every function the screens use, sent to the server.
// Names and arguments match the sample API in ../mocks/api.ts, so screens and hooks do not change.
// Writes still take the actor's id first, but the server ignores it and uses the signed-in session.
import type {
  AccountKind,
  SiteSettings,
  DeleteImpact,
  DeleteKind,
  TotpSetup,
  TotpStatus,
  Adjudicator,
  AdjudicatorPin,
  AdjudicatorState,
  AdjudicatorSubmission,
  AgeGroupDef,
  AgeGroupInput,
  AthleteInput,
  AthleteRecord,
  AthleteRecordInput,
  TeamMembershipInput,
  TeamMembershipPage,
  Catalog,
  EventKindDef,
  EventKindInput,
  AthletePage,
  EntryRequest,
  EntryRequestInput,
  MemberAccount,
  BarkerBoard,
  MemberChangeRow,
  MemberClaimRow,
  MemberInput,
  MemberRoster,
  PaymentMethod,
  MemberRosterRow,
  AthleteProfile,
  AdjudicatorAssignment,
  AthleteNotification,
  AthleteRow,
  MyActivity,
  Announcement,
  AuditEntry,
  BackupStatus,
  OfflineDayCounts,
  OfflineDayInfo,
  PaymentSettings,
  Team,
  Competition,
  CompetitionInput,
  Competitor,
  CompetitorHistoryLine,
  CompetitorRow,
  Entry,
  DemoRound,
  EntryRow,
  FinalTie,
  TeamInput,
  Coach,
  CoachInput,
  CompetitorDetails,
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
  Program,
  ProgramKind,
  ProgramSlotInput,
  Payment,
  PaymentDetail,
  PaymentStatus,
  PointsRow,
  RankingFilter,
  RankingPoint,
  RecallTable,
  Result,
  Role,
  SampleCredentials,
  Round,
  RegistrationInput,
  RegistrationQuote,
  RegistrationResult,
  RoundRow,
  RoundSignature,
  ScheduleItem,
  SessionUser,
  SkatingTable,
  StaffUser,
  TieDecision,
} from '@bis/shared'
import { auth, call, getSessionFromServer, upload } from './http.ts'

export type { AgeGroupInput, CompetitionInput, EventInput, EventKindInput, RankingFilter } from '@bis/shared'
export { subscribeSubmissions, getSubmissionSnapshot, subscribeNotifications, subscribeAlerts } from './realtime.ts'

// ---- Reading ----

export const getCompetitions = () => call<Competition[]>('getCompetitions')
export const getCompetition = (id: string) => call<Competition>('getCompetition', id)
export const getEvents = (competitionId?: string) => call<Event[]>('getEvents', competitionId)
export const getEvent = (id: string) => call<Event>('getEvent', id)
export const getEntries = (eventId: string) => call<Entry[]>('getEntries', eventId)
export const getCompetitors = () => call<Competitor[]>('getCompetitors')
export const getTeams = () => call<Team[]>('getTeams')
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
export const getCatalog = () => call<Catalog>('getCatalog')
export const getSiteSettings = () => call<SiteSettings>('getSiteSettings')
export const saveHeroImage = (_actorId: string, image: string | null) => call<SiteSettings>('saveHeroImage', image)
export const getBarkerBoard = () => call<BarkerBoard>('getBarkerBoard')
export const getBicolAthleteIds = () => call<string[]>('getBicolAthleteIds')
export const getRankingPoints = (filter: RankingFilter = {}) => call<RankingPoint[]>('getRankingPoints', filter)
export const getCompetitorHistory = (competitorId: string) => call<CompetitorHistoryLine[]>('getCompetitorHistory', competitorId)
export const getStaffUsers = () => call<StaffUser[]>('getStaffUsers')
export const getAuditLog = () => call<AuditEntry[]>('getAuditLog')
export const getResultEventIds = (competitionId: string) => call<string[]>('getResultEventIds', competitionId)

// ---- Admin ----

export const saveCompetition = (_actorId: string, input: CompetitionInput, id?: string) =>
  call<Competition>('saveCompetition', input, id)
export const getDeleteImpact = (kind: DeleteKind, id: string) => call<DeleteImpact>('getDeleteImpact', kind, id)
export const deleteCompetition = (_actorId: string, id: string, cascade?: boolean) => call<{ id: string }>('deleteCompetition', id, cascade)
export const saveEventKind = (_actorId: string, input: EventKindInput, id?: string) => call<EventKindDef>('saveEventKind', input, id)
export const deleteEventKind = (_actorId: string, id: string, cascade?: boolean) => call<{ id: string }>('deleteEventKind', id, cascade)
export const saveAgeGroup = (_actorId: string, input: AgeGroupInput, id?: string) => call<AgeGroupDef>('saveAgeGroup', input, id)
export const deleteAgeGroup = (_actorId: string, id: string, cascade?: boolean) => call<{ id: string }>('deleteAgeGroup', id, cascade)
export const createStaffUser = (_actorId: string, input: { name: string; username: string; role: Role; photo: string }) =>
  call<{ user: StaffUser; tempPassword: string }>('createStaffUser', input)
export const updateStaffUser = (_actorId: string, id: string, input: { name: string; role: Role; photo?: string }) =>
  call<StaffUser>('updateStaffUser', id, input)
export const deleteStaffUser = (_actorId: string, id: string, cascade?: boolean) => call<{ id: string }>('deleteStaffUser', id, cascade)
export const resetStaffPassword = (_actorId: string, id: string) => call<{ tempPassword: string }>('resetStaffPassword', id)
export const getTotpStatus = (_actorId: string) => call<TotpStatus>('getTotpStatus')
export const startTotpSetup = (_actorId: string) => call<TotpSetup>('startTotpSetup')
export const confirmTotpSetup = (_actorId: string, code: string) => call<{ recoveryCodes: string[] }>('confirmTotpSetup', code)
export const disableTotp = (_actorId: string, password: string, code: string) => call<void>('disableTotp', password, code)
export const resetTotp = (_actorId: string, id: string) => call<void>('resetTotp', id)
export const revokeSessions = (_actorId: string, kind: AccountKind, id: string) => call<void>('revokeSessions', kind, id)
export const createAdjudicator = (_actorId: string, input: { name: string; letter: string; photo: string }) =>
  call<Adjudicator>('createAdjudicator', input)
export const updateAdjudicator = (_actorId: string, id: string, input: { name: string; photo?: string }) =>
  call<Adjudicator>('updateAdjudicator', id, input)
export const deleteAdjudicator = (_actorId: string, id: string, cascade?: boolean) => call<{ id: string }>('deleteAdjudicator', id, cascade)
export const generatePins = (_actorId: string, competitionId: string, adjudicatorId?: string) =>
  call<AdjudicatorPin[]>('generatePins', competitionId, adjudicatorId)
export const setPanel = (_actorId: string, eventId: string, adjudicatorIds: string[]) =>
  call<Panel>('setPanel', eventId, adjudicatorIds)
export const savePointsTable = (_actorId: string, rows: PointsRow[]) => call<PointsRow[]>('savePointsTable', rows)

// ---- Secretariat ----

export const getCompetitionEntries = (competitionId: string) => call<Entry[]>('getCompetitionEntries', competitionId)
export const getEntryRows = (eventId: string) => call<EntryRow[]>('getEntryRows', eventId)
export const setEntryScratched = (_actorId: string, entryId: string, scratched: boolean) =>
  call<EntryRow>('setEntryScratched', entryId, scratched)
export const getCompetitorRows = () => call<CompetitorRow[]>('getCompetitorRows')
export const createCompetitor = (_actorId: string, input: { names: string[]; teamId: string; details?: CompetitorDetails }) =>
  call<CompetitorRow>('createCompetitor', input)
export const setBackNumber = (_actorId: string, competitorId: string, backNumber: number | null) =>
  call<CompetitorRow>('setBackNumber', competitorId, backNumber)
export const assignBackNumbers = (_actorId: string) => call<number>('assignBackNumbers')
export const importCompetitors = (_actorId: string, rows: Array<{ names: string[]; teamName: string }>) =>
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
export const getProgram = (competitionId: string) => call<Program>('getProgram', competitionId)
export const getEntriesByBackNumber = (competitionId: string, backNumber: number) =>
  call<string[]>('getEntriesByBackNumber', competitionId, backNumber)
export const setProgramStart = (_actorId: string, competitionId: string, start: string | null) =>
  call<Program>('setProgramStart', competitionId, start)
export const generateProgram = (_actorId: string, competitionId: string) => call<Program>('generateProgram', competitionId)
export const addProgramBreak = (
  _actorId: string,
  competitionId: string,
  input: { kind: ProgramKind; label: string; minutes: number; afterSequence?: number },
) => call<Program>('addProgramBreak', competitionId, input)
export const updateProgramSlot = (_actorId: string, slotId: string, input: ProgramSlotInput) =>
  call<Program>('updateProgramSlot', slotId, input)
export const moveProgramSlot = (_actorId: string, slotId: string, direction: 'up' | 'down') =>
  call<Program>('moveProgramSlot', slotId, direction)
export const removeProgramSlot = (_actorId: string, slotId: string) => call<Program>('removeProgramSlot', slotId)
export const updateCompetitor = (_actorId: string, id: string, input: { names: string[]; teamId: string; details?: CompetitorDetails }) =>
  call<CompetitorRow>('updateCompetitor', id, input)
export const deleteCompetitor = (_actorId: string, id: string, cascade?: boolean) => call<void>('deleteCompetitor', id, cascade)
export const saveTeam = (_actorId: string, input: TeamInput, id?: string) => call<Team>('saveTeam', input, ...(id ? [id] : []))
export const deleteTeam = (_actorId: string, id: string, cascade?: boolean) => call<void>('deleteTeam', id, cascade)
export const getCoaches = () => call<Coach[]>('getCoaches')
export const saveCoach = (_actorId: string, input: CoachInput, id?: string) => call<Coach>('saveCoach', input, id)
export const deleteCoach = (_actorId: string, id: string, cascade?: boolean) => call<void>('deleteCoach', id, cascade)
export const quoteRegistration = (competitorId: string, eventIds: string[], coachFees?: { membership: boolean; summit: boolean }) =>
  call<RegistrationQuote>('quoteRegistration', competitorId, eventIds, ...(coachFees ? [coachFees] : []))
export const registerCompetitor = (_actorId: string, input: RegistrationInput) => call<RegistrationResult>('registerCompetitor', input)
export const deleteLateEntry = (_actorId: string, entryId: string) => call<void>('deleteLateEntry', entryId)
export const updateLateEntry = (_actorId: string, entryId: string, input: { eventId: string; paidInCash: boolean }) =>
  call<LateEntryRow>('updateLateEntry', entryId, input)
export const saveEvent = (_actorId: string, competitionId: string, input: EventInput, id?: string) =>
  call<Event>('saveEvent', competitionId, input, id)
export const deleteEvent = (_actorId: string, id: string, cascade?: boolean) => call<void>('deleteEvent', id, cascade)

// ---- Adjudicator ----

export const getAdjudicatorState = (_adjudicatorId: string) => call<AdjudicatorState>('getAdjudicatorState')
export const submitAdjudicatorMarks = (_adjudicatorId: string, roundId: string, submissions: MarkSubmission[], signature?: string) =>
  call<void>('submitAdjudicatorMarks', roundId, submissions, ...(signature ? [signature] : []))

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
export const getSignatures = (roundId: string) => call<RoundSignature[]>('getSignatures', roundId)
export const enterAdjudicatorMarks = (_actorId: string, adjudicatorId: string, roundId: string, submissions: MarkSubmission[]) =>
  call<void>('enterAdjudicatorMarks', adjudicatorId, roundId, submissions)
export const getRecallTable = (roundId: string) => call<RecallTable>('getRecallTable', roundId)
export const proposeTieDecision = (_actorId: string, roundId: string, choice: TieDecision['choice']) =>
  call<void>('proposeTieDecision', roundId, choice)
export const confirmTieDecision = (_actorId: string, roundId: string) => call<void>('confirmTieDecision', roundId)
export const getFinalTie = (roundId: string) => call<FinalTie>('getFinalTie', roundId)
export const proposeFinalTie = (_actorId: string, roundId: string, mode: 'keep' | 'order', order: string[]) =>
  call<void>('proposeFinalTie', roundId, mode, order)
export const confirmFinalTie = (_actorId: string, roundId: string) => call<void>('confirmFinalTie', roundId)
export const getSkatingTable = (roundId: string) => call<SkatingTable>('getSkatingTable', roundId)
export const approveRound = (_actorId: string, roundId: string) => call<void>('approveRound', roundId)
export const publishRound = (_actorId: string, roundId: string) => call<void>('publishRound', roundId)
export const getBackupStatus = () => call<BackupStatus>('getBackupStatus')

// The offline day: a competition run on a venue laptop with no internet
export const getOfflineDays = () => call<OfflineDayInfo>('getOfflineDays')
export const startOfflineDay = (_actorId: string, competitionId: string) => call<void>('startOfflineDay', competitionId)
export const cancelOfflineDay = (_actorId: string, competitionId: string) => call<void>('cancelOfflineDay', competitionId)
// Not server calls: the files are too big for one. The downloads are plain links (see DATABASE_COPY_URL and dayFileUrl).
export const loadDayFile = (file: Blob, dryRun: boolean) => upload<OfflineDayCounts>(`/api/offline/day${dryRun ? '?dry=1' : ''}`, file)

// ---- Compere ----

export const getAnnouncements = () => call<Announcement[]>('getAnnouncements')

// ---- Signing in and out: separate routes, because they set or clear the cookie ----

export const signInStaff = (username: string, password: string, code?: string) =>
  auth<SessionUser>('staff', { username, password, ...(code ? { code } : {}) })
export const signInAdjudicator = (pin: string) => auth<SessionUser>('adjudicator', { pin })
export const signInAthlete = (email: string, password: string) => auth<SessionUser>('athlete', { email, password })
export const signUpAthlete = (name: string, email: string, password: string, photo: string) => auth<SessionUser>('athlete/sign-up', { name, email, password, photo })
// Forgot password and the links in emails: not calls to a named function, so they go to the sign-in routes
export const forgotPassword = (role: 'athlete' | 'coach' | 'team', email: string) => auth<null>('forgot', { role, email })
export const resetPassword = (token: string, password: string) => auth<{ role: 'athlete' | 'coach' | 'team' }>('reset', { token, password })
export const verifyEmail = (token: string) => auth<null>('verify', { token })
export const resendVerification = (_memberId: string) => call<void>('resendVerification')
export const signInMember = (role: 'coach' | 'team', email: string, password: string) => auth<SessionUser>(role, { email, password })
export const signUpMember = (role: 'coach' | 'team', name: string, email: string, password: string, photo: string) => auth<SessionUser>(`${role}/sign-up`, { name, email, password, photo })
export const getMyMember = (_memberId: string) => call<MemberAccount>('getMyMember')
export const saveMyMember = (_memberId: string, input: MemberInput) => call<MemberAccount>('saveMyMember', input)
export const saveMyMemberPhoto = (_memberId: string, photo: string | null) => call<MemberAccount>('saveMyMemberPhoto', photo)
export const getMyEntrants = (_requesterId: string) => call<MemberRosterRow[]>('getMyEntrants')
export const getEntryPaymentMethods = (_requesterId: string) => call<PaymentMethod[]>('getEntryPaymentMethods')
export const quoteMyEntries = (_requesterId: string, competitorId: string, eventIds: string[]) => call<RegistrationQuote>('quoteMyEntries', competitorId, eventIds)
export const submitEntryRequest = (_requesterId: string, input: EntryRequestInput) => call<EntryRequest>('submitEntryRequest', input)
export const getMyEntryRequests = (_requesterId: string) => call<EntryRequest[]>('getMyEntryRequests')
export const cancelEntryRequest = (_requesterId: string, id: string) => call<void>('cancelEntryRequest', id)
export const getEntryRequests = () => call<EntryRequest[]>('getEntryRequests')
export const approveEntryRequest = (_actorId: string, id: string) => call<EntryRequest[]>('approveEntryRequest', id)
export const rejectEntryRequest = (_actorId: string, id: string, reason: string) => call<EntryRequest[]>('rejectEntryRequest', id, reason)
export const claimRecord = (_memberId: string, targetId: string) => call<MemberAccount>('claimRecord', targetId)
export const cancelClaim = (_memberId: string) => call<MemberAccount>('cancelClaim')
export const getMyRoster = (_memberId: string) => call<MemberRoster>('getMyRoster')
export const getMemberClaims = () => call<MemberClaimRow[]>('getMemberClaims')
export const approveMemberClaim = (_actorId: string, memberId: string) => call<MemberClaimRow[]>('approveMemberClaim', memberId)
export const getMemberChanges = () => call<MemberChangeRow[]>('getMemberChanges')
export const approveMemberChange = (_actorId: string, memberId: string) => call<MemberChangeRow[]>('approveMemberChange', memberId)
export const rejectMemberChange = (_actorId: string, memberId: string, reason: string) => call<MemberChangeRow[]>('rejectMemberChange', memberId, reason)
export const rejectMemberClaim = (_actorId: string, memberId: string) => call<MemberClaimRow[]>('rejectMemberClaim', memberId)

// ---- Athletes ----

export const getMyAthlete = (_athleteId: string) => call<AthletePage>('getMyAthlete')
export const saveMyAthlete = (_athleteId: string, input: AthleteInput) => call<AthleteProfile>('saveMyAthlete', input)
export const getTeamMembership = (_memberId: string) => call<TeamMembershipPage>('getTeamMembership')
export const requestTeamMembership = (_memberId: string, input: TeamMembershipInput) => call<void>('requestTeamMembership', input)
export const changeMyPassword = (_athleteId: string, current: string, next: string) => call<void>('changeMyPassword', current, next)
export const signOutEverywhere = (_athleteId: string) => call<void>('signOutEverywhere')
export const saveMyPhoto = (_athleteId: string, photo: string | null) => call<AthleteProfile>('saveMyPhoto', photo)
export const getMyActivity = (_athleteId: string) => call<MyActivity>('getMyActivity')
export const approveProfileChange = (_actorId: string, id: string) => call<void>('approveProfileChange', id)
export const rejectProfileChange = (_actorId: string, id: string, reason: string) => call<void>('rejectProfileChange', id, reason)
export const getAdjudicatorAssignments = (adjudicatorId: string) => call<AdjudicatorAssignment[]>('getAdjudicatorAssignments', adjudicatorId)
export const getCompetitorActivity = (competitorId: string) => call<MyActivity>('getCompetitorActivity', competitorId)
export const changeMyStaffPassword = (_actorId: string, current: string, next: string) => call<void>('changeMyStaffPassword', current, next)
export const saveMyStaffName = (_actorId: string, name: string) => call<StaffUser>('saveMyStaffName', name)
export const getMyNotifications = (_athleteId: string) => call<AthleteNotification[]>('getMyNotifications')
export const markNotificationsRead = (_athleteId: string, ids?: string[]) => call<void>('markNotificationsRead', ids)
export const getAthletes = () => call<AthleteRow[]>('getAthletes')
export const getAthleteRecords = () => call<AthleteRecord[]>('getAthleteRecords')
export const saveAthleteRecord = (_actorId: string, input: AthleteRecordInput, id?: string) => call<AthleteRecord>('saveAthleteRecord', input, id)
export const deleteAthleteRecord = (_actorId: string, id: string) => call<void>('deleteAthleteRecord', id)
export const claimAthleteRecord = (_athleteId: string, targetId: string) => call<void>('claimAthleteRecord', targetId)
export const cancelAthleteClaim = (_athleteId: string) => call<void>('cancelAthleteClaim')
export const confirmMembership = (_actorId: string, id: string) => call<void>('confirmMembership', id)
export const rejectMembership = (_actorId: string, id: string, reason: string) => call<void>('rejectMembership', id, reason)
export const correctAthlete = (_actorId: string, id: string, input: { name: string; birthDate: string }) => call<void>('correctAthlete', id, input)
export const correctMember = (_actorId: string, id: string, input: { name: string; birthDate: string }) => call<void>('correctMember', id, input)
export const deleteAthlete = (_actorId: string, id: string, cascade?: boolean) => call<void>('deleteAthlete', id, cascade)
export const signOut = () => auth<null>('sign-out', {})
// Who the cookie belongs to, or null: used when the page loads
export const getSession = () => getSessionFromServer<SessionUser | null>()

// ---- Sample app only: the real server has no demo controls or sample sign-ins, and the screens hide them ----

export const getDemoRounds = async (): Promise<DemoRound[]> => []
export const startDemoRoundOnFloor = async (_roundId: string | null): Promise<void> => {}
export const getSampleCredentials = async (): Promise<SampleCredentials> => ({ password: '', usernames: [], pins: [] })

// ---- Syncing with the cloud ----


// ---- Fees and payment details ----

export const getPaymentSettings = () => call<PaymentSettings>('getPaymentSettings')
export const savePaymentSettings = (_adminId: string, input: PaymentSettings) => call<PaymentSettings>('savePaymentSettings', input)
