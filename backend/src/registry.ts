import { Role } from '@bis/shared'
import { fail, type Ctx } from './core/context.ts'
import { admin } from './services/admin.ts'
import { certificate } from './services/certificate.ts'
import { site } from './services/site.ts'
import { deleteImpact } from './services/cascade.ts'
import { offlineDay } from './services/offlineDay.ts'
import { redance } from './services/redance.ts'
import { advancement } from './services/advancement.ts'
import { roundSets } from './services/roundSets.ts'
import { signatures } from './services/signatures.ts'
import { program } from './services/program.ts'
import { reads } from './services/reads.ts'
import { rounds } from './services/rounds.ts'
import { scrutiny } from './services/scrutiny.ts'
import { registration } from './services/registration.ts'
import { secretariat } from './services/secretariat.ts'
import { security } from './services/security.ts'
import { accountFunctions } from './services/accounts.ts'
import { athletes } from './services/athletes.ts'
import { entryRequests } from './services/entryRequests.ts'
import { getTeamMembership, requestTeamMembership } from './services/teamMembership.ts'
import { resendVerification } from './services/emailLinks.ts'
import { cancelAthleteClaim, claimAthleteRecord, deleteAthleteRecord, findSimilarAccounts, getAthleteRecords, saveAthleteRecord } from './services/athleteRecords.ts'
import { approveMemberChange, approveMemberClaim, correctMember, getMemberChanges, rejectMemberChange, saveMyMember, saveMyMemberPhoto, cancelClaim, claimRecord, getMemberClaims, getMyMember, getMyRoster, rejectMemberClaim } from './services/members.ts'
import { isStaff, toTeam } from './services/shared.ts'
import * as t from './db/schema.ts'
import { asc } from 'drizzle-orm'

type Handler = (ctx: Ctx, ...args: never[]) => unknown

const STAFF: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Compere]
// Staff who work the competition; the compere only reads announcements
// Everyone with a staff account has an account page: a name, a password and two-step sign-in
const ACCOUNT_HOLDERS: Role[] = [...STAFF, Role.Barker]

const OFFICIALS: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson]
const ADMIN: Role[] = [Role.Admin]
const ADMIN_OR_SECRETARIAT: Role[] = [Role.Admin, Role.Secretariat]
// The running order is edited by the secretariat and the scrutineer, on the same copy
const PROGRAM_EDITORS: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson]
// Who marks each event is set by the secretariat, the scrutineer and the chairperson
const PANEL_EDITORS: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson]
// Heats are set by the secretariat, the scrutineer and the chairperson
const HEAT_EDITORS: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson]
// The chairperson can do everything the scrutineer can
const SCRUTINEER: Role[] = [Role.Scrutineer, Role.Chairperson]
const FLOOR_CONTROL: Role[] = [Role.Scrutineer, Role.Chairperson, Role.Compere]
const SCORING: Role[] = [Role.Scrutineer, Role.Chairperson]

// 'public' needs no sign-in; 'signedIn' needs any account; a list needs one of those roles
export type Access = 'public' | 'signedIn' | Role[]

// Guests get team names for results pages, never contact details
const getTeams = (ctx: Ctx) =>
  ctx.db
    .select()
    .from(t.teams)
    .orderBy(asc(t.teams.name))
    .all()
    .map((c) => (isStaff(ctx) ? toTeam(c) : { id: c.id, name: c.name, contactName: '', contactEmail: '', contactPhone: '' }))

const getBackupStatus = (ctx: Ctx) => ctx.backups.status()

const handlers: Record<string, Handler> = {
  ...reads,
  getDeleteImpact: deleteImpact,
  ...admin,
  ...site,
  ...certificate,
  ...secretariat,
  ...registration,
  ...program,
  ...security,
  ...offlineDay,
  ...signatures,
  ...redance,
  ...roundSets,
  ...advancement,
  ...rounds,
  ...scrutiny,
  ...accountFunctions,
  ...athletes,
  ...entryRequests,
  getMyMember,
  correctMember,
  getMemberChanges,
  approveMemberChange,
  rejectMemberChange,
  saveMyMember,
  saveMyMemberPhoto,
  resendVerification,
  getTeamMembership,
  requestTeamMembership,
  getAthleteRecords,
  findSimilarAccounts,
  saveAthleteRecord,
  deleteAthleteRecord,
  claimAthleteRecord,
  cancelAthleteClaim,
  claimRecord,
  cancelClaim,
  getMyRoster,
  getMemberClaims,
  approveMemberClaim,
  rejectMemberClaim,
  getTeams,
  getBackupStatus,
} as unknown as Record<string, Handler>

const access: Record<string, Access> = {
  // Reference data and published results
  getCompetitions: 'public',
  getCompetition: 'public',
  getEvents: 'public',
  getEvent: 'public',
  getRounds: 'public',
  getRound: 'public',
  getResults: 'public',
  getPointsTable: 'public',
  getCatalog: 'public',
  getSiteSettings: 'public',
  saveHeroImage: ADMIN,
  saveSignInImage: ADMIN,
  getCertificateLayout: STAFF,
  saveCertificateLayout: [Role.Admin, Role.Scrutineer, Role.Chairperson],
  getRankingPoints: 'public',
  getBicolAthleteIds: 'public',
  getCompetitorHistory: 'public',
  getCompetitors: 'public',
  getTeams: 'public',
  getResultEventIds: 'public',
  getCompetitionRounds: 'public',
  getProgram: 'public',
  getRoundSets: OFFICIALS,
  getAdvancementRules: OFFICIALS,
  setAdvancementRules: SCRUTINEER,
  getRoundSet: OFFICIALS,
  setRoundSet: PROGRAM_EDITORS,
  rotateRoundSets: PROGRAM_EDITORS,
  // The barker lines the competitors up; the officials can see the same board
  getBarkerBoard: [Role.Barker, ...OFFICIALS],
  getEntriesByBackNumber: 'public',
  getRoundHeats: 'public',
  // Public only once the round is published; staff see them as the round runs
  getRecallTable: 'public',
  getSkatingTable: 'public',
  getEventReport: 'public',
  getFinalTie: [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson],
  getCurrentRoundId: 'signedIn',

  // Staff
  getEntries: OFFICIALS,
  getHeats: OFFICIALS,
  getAdjudicators: OFFICIALS,
  getPanel: OFFICIALS,
  getPanels: OFFICIALS,
  getAdjudicatorAssignments: OFFICIALS,
  getCompetitionEntries: OFFICIALS,
  getEntryRows: OFFICIALS,
  getCompetitorRows: OFFICIALS,
  getLateEntries: OFFICIALS,
  getSchedule: OFFICIALS,
  // The compere's screen reads only this, besides the public program and results
  getAnnouncements: STAFF,
  getSignatures: OFFICIALS,
  getSubmissions: STAFF,
  getRedances: OFFICIALS,
  startRedance: SCRUTINEER,
  enterRedanceMarks: SCRUTINEER,
  submitRedanceMarks: [Role.Adjudicator],
  getHeatAssignments: OFFICIALS,
  getMarks: SCORING,
  getMarkingTask: SCORING,

  // Admin
  getAdjudicatorPins: ADMIN,
  getStaffUsers: ADMIN,
  getAuditLog: ADMIN,
  saveCompetition: ADMIN,
  deleteCompetition: ADMIN,
  createStaffUser: ADMIN,
  updateStaffUser: ADMIN,
  deleteStaffUser: ADMIN,
  revokeSessions: ADMIN,
  resetTotp: ADMIN,
  changeMyStaffPassword: ACCOUNT_HOLDERS,
  saveMyStaffName: ACCOUNT_HOLDERS,
  getMySignature: STAFF,
  saveMyStaffSignature: STAFF,
  getSheetSignatures: OFFICIALS,
  getTotpStatus: ACCOUNT_HOLDERS,
  startTotpSetup: ACCOUNT_HOLDERS,
  confirmTotpSetup: ACCOUNT_HOLDERS,
  disableTotp: ACCOUNT_HOLDERS,
  resetStaffPassword: ADMIN,
  createAdjudicator: ADMIN,
  updateAdjudicator: ADMIN,
  deleteAdjudicator: ADMIN,
  generatePins: ADMIN,
  getDeleteImpact: ADMIN_OR_SECRETARIAT,
  setPanel: PANEL_EDITORS,
  setPanels: PANEL_EDITORS,
  savePointsTable: ADMIN,
  saveEventKind: ADMIN,
  deleteEventKind: ADMIN,
  saveClass: ADMIN,
  deleteClass: ADMIN,
  saveAgeGroup: ADMIN,
  deleteAgeGroup: ADMIN,
  getOfflineDays: ADMIN,
  startOfflineDay: ADMIN,
  cancelOfflineDay: ADMIN,
  getBackupStatus: [Role.Admin, Role.Scrutineer, Role.Chairperson],

  // Secretariat (the admin can do all of it too)
  getPayments: ADMIN_OR_SECRETARIAT,
  getPaymentDetails: ADMIN_OR_SECRETARIAT,
  setEntryScratched: ADMIN_OR_SECRETARIAT,
  createCompetitor: ADMIN_OR_SECRETARIAT,
  findSimilarCompetitors: ADMIN_OR_SECRETARIAT,
  addAthlete: ADMIN_OR_SECRETARIAT,
  setBackNumber: ADMIN_OR_SECRETARIAT,
  assignBackNumbers: ADMIN_OR_SECRETARIAT,
  importCompetitors: ADMIN_OR_SECRETARIAT,
  importCompetitorsCsv: ADMIN_OR_SECRETARIAT,
  createLateEntry: ADMIN_OR_SECRETARIAT,
  markPaidAtVenue: ADMIN_OR_SECRETARIAT,
  markUnpaid: ADMIN_OR_SECRETARIAT,
  moveScheduledEvent: ADMIN_OR_SECRETARIAT,
  setProgramStart: PROGRAM_EDITORS,
  generateProgram: PROGRAM_EDITORS,
  addProgramBreak: PROGRAM_EDITORS,
  updateProgramSlot: PROGRAM_EDITORS,
  moveProgramSlot: PROGRAM_EDITORS,
  moveProgramSlotTo: PROGRAM_EDITORS,
  moveScheduledEventTo: ADMIN_OR_SECRETARIAT,
  setEventRounds: [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson],
  removeProgramSlot: PROGRAM_EDITORS,
  updateCompetitor: ADMIN_OR_SECRETARIAT,
  deleteCompetitor: ADMIN_OR_SECRETARIAT,
  deleteLateEntry: ADMIN_OR_SECRETARIAT,
  updateLateEntry: ADMIN_OR_SECRETARIAT,
  saveEvent: ADMIN_OR_SECRETARIAT,
  getCoaches: [...OFFICIALS, Role.Athlete, Role.Coach],
  saveTeam: ADMIN_OR_SECRETARIAT,
  deleteTeam: ADMIN_OR_SECRETARIAT,
  saveCoach: ADMIN_OR_SECRETARIAT,
  deleteCoach: ADMIN_OR_SECRETARIAT,
  quoteRegistration: ADMIN_OR_SECRETARIAT,
  registerCompetitor: ADMIN_OR_SECRETARIAT,
  deleteEvent: ADMIN_OR_SECRETARIAT,

  // Scrutineer and chairperson
  planRounds: SCRUTINEER,
  saveHeats: HEAT_EDITORS,
  // The compere can start a round too, so the show goes on if the scrutineer's screen has a problem
  startRound: FLOOR_CONTROL,
  clearFloor: FLOOR_CONTROL,
  enterAdjudicatorMarks: SCRUTINEER,
  proposeTieDecision: SCRUTINEER,
  proposeFinalTie: SCRUTINEER,
  approveRound: SCRUTINEER,
  publishRound: SCRUTINEER,
  getResultsRelease: [Role.Admin, Role.Scrutineer, Role.Chairperson, Role.Compere],
  // The compere can release the held results at the awarding, so it never waits on the scrutineer
  revealResults: [Role.Scrutineer, Role.Chairperson, Role.Compere],
  confirmTieDecision: [Role.Chairperson],
  confirmFinalTie: [Role.Chairperson],

  // Adjudicators, each only for themselves
  getAdjudicatorState: [Role.Adjudicator],
  submitAdjudicatorMarks: [Role.Adjudicator],

  // Fees, payment details and team accounts
  getPaymentSettings: [Role.Admin, Role.Secretariat],
  savePaymentSettings: ADMIN,

  // Athletes, each only for themselves; the secretariat checks their membership payments
  getMyAthlete: [Role.Athlete],
  getMyMember: [Role.Coach, Role.Team],
  saveMyMember: [Role.Coach, Role.Team],
  saveMyMemberPhoto: [Role.Coach, Role.Team],
  getMyEntrants: [Role.Team],
  getEntryPaymentMethods: [Role.Team],
  quoteMyEntries: [Role.Team],
  submitEntryRequest: [Role.Team],
  getMyEntryRequests: [Role.Team],
  cancelEntryRequest: [Role.Team],
  getEntryRequests: ADMIN_OR_SECRETARIAT,
  approveEntryRequest: ADMIN_OR_SECRETARIAT,
  rejectEntryRequest: ADMIN_OR_SECRETARIAT,
  findSimilarAccounts: 'public',
  getAthleteRecords: [...ADMIN_OR_SECRETARIAT, Role.Chairperson, Role.Athlete],
  saveAthleteRecord: ADMIN_OR_SECRETARIAT,
  deleteAthleteRecord: ADMIN_OR_SECRETARIAT,
  claimAthleteRecord: [Role.Athlete],
  cancelAthleteClaim: [Role.Athlete],
  claimRecord: [Role.Coach, Role.Team],
  cancelClaim: [Role.Coach, Role.Team],
  getMyRoster: [Role.Coach, Role.Team],
  getMemberClaims: ADMIN_OR_SECRETARIAT,
  approveMemberClaim: ADMIN_OR_SECRETARIAT,
  rejectMemberClaim: ADMIN_OR_SECRETARIAT,
  saveMyAthlete: [Role.Athlete],
  resendVerification: [Role.Athlete, Role.Coach, Role.Team],
  getTeamMembership: [Role.Team],
  requestTeamMembership: [Role.Team],
  changeMyPassword: [Role.Athlete, Role.Coach, Role.Team],
  signOutEverywhere: [Role.Athlete, Role.Coach, Role.Team],
  saveMyPhoto: [Role.Athlete],
  getMyActivity: [Role.Athlete, Role.Coach, Role.Team],
  getCompetitorActivity: OFFICIALS,
  getMyNotifications: [Role.Athlete, Role.Coach, Role.Team],
  markNotificationsRead: [Role.Athlete, Role.Coach, Role.Team],
  approveProfileChange: ADMIN_OR_SECRETARIAT,
  rejectProfileChange: ADMIN_OR_SECRETARIAT,
  getAthletes: [...ADMIN_OR_SECRETARIAT, Role.Chairperson],
  confirmMembership: ADMIN_OR_SECRETARIAT,
  setMembershipPaid: ADMIN_OR_SECRETARIAT,
  rejectMembership: ADMIN_OR_SECRETARIAT,
  deleteAthlete: ADMIN_OR_SECRETARIAT,
  correctAthlete: ADMIN_OR_SECRETARIAT,
  correctMember: ADMIN_OR_SECRETARIAT,
  getMemberChanges: ADMIN_OR_SECRETARIAT,
  approveMemberChange: ADMIN_OR_SECRETARIAT,
  rejectMemberChange: ADMIN_OR_SECRETARIAT,
}

// Anything that changes data runs in one transaction and tells the other screens afterwards
const reading = new Set(
  Object.keys(handlers).filter((name) => /^get/.test(name)),
)

export interface Endpoint {
  access: Access
  write: boolean
  run: (ctx: Ctx, args: unknown[]) => unknown
}

export function endpoint(name: string): Endpoint | undefined {
  const handler = handlers[name]
  const rule = access[name]
  if (!handler || rule === undefined) return undefined
  return {
    access: rule,
    write: !reading.has(name),
    run: (ctx, args) => (handler as (ctx: Ctx, ...a: unknown[]) => unknown)(ctx, ...args),
  }
}

export const endpointNames = () => Object.keys(handlers)
export const accessNames = () => Object.keys(access)

export function allowed(rule: Access, ctx: Ctx): void {
  if (rule === 'public') return
  if (!ctx.user) return fail('Sign in first.', 401)
  if (rule !== 'signedIn' && !rule.includes(ctx.user.role)) return fail('Your account cannot do this.', 403)
}
