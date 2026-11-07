import { Role } from '@bis/shared'
import { fail, type Ctx } from './core/context.ts'
import { admin } from './services/admin.ts'
import { deleteImpact } from './services/cascade.ts'
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
import { approveMemberChange, approveMemberClaim, correctMember, getMemberChanges, rejectMemberChange, saveMyMember, saveMyMemberPhoto, cancelClaim, claimRecord, getMemberClaims, getMyMember, getMyRoster, rejectMemberClaim } from './services/members.ts'
import { isStaff, toTeam } from './services/shared.ts'
import * as t from './db/schema.ts'
import { asc } from 'drizzle-orm'

type Handler = (ctx: Ctx, ...args: never[]) => unknown

const STAFF: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Compere]
// Staff who work the competition; the compere only reads announcements
const OFFICIALS: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson]
const ADMIN: Role[] = [Role.Admin]
const ADMIN_OR_SECRETARIAT: Role[] = [Role.Admin, Role.Secretariat]
const SCRUTINEER: Role[] = [Role.Scrutineer]
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
  ...secretariat,
  ...registration,
  ...program,
  ...security,
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
  getRankingPoints: 'public',
  getBicolAthleteIds: 'public',
  getCompetitorHistory: 'public',
  getCompetitors: 'public',
  getTeams: 'public',
  getResultEventIds: 'public',
  getCompetitionRounds: 'public',
  getProgram: 'public',
  // The barker lines the competitors up; the officials can see the same board
  getBarkerBoard: [Role.Barker, ...OFFICIALS],
  getEntriesByBackNumber: 'public',
  // Public only once the round is published; staff see them as the round runs
  getRecallTable: 'public',
  getSkatingTable: 'public',
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
  getSubmissions: OFFICIALS,
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
  changeMyStaffPassword: STAFF,
  saveMyStaffName: STAFF,
  getTotpStatus: STAFF,
  startTotpSetup: STAFF,
  confirmTotpSetup: STAFF,
  disableTotp: STAFF,
  resetStaffPassword: ADMIN,
  createAdjudicator: ADMIN,
  updateAdjudicator: ADMIN,
  deleteAdjudicator: ADMIN,
  generatePins: ADMIN,
  getDeleteImpact: ADMIN_OR_SECRETARIAT,
  setPanel: ADMIN,
  savePointsTable: ADMIN,
  saveEventKind: ADMIN,
  deleteEventKind: ADMIN,
  saveAgeGroup: ADMIN,
  deleteAgeGroup: ADMIN,
  getBackupStatus: [Role.Admin, Role.Scrutineer],

  // Secretariat (the admin can do all of it too)
  getPayments: ADMIN_OR_SECRETARIAT,
  getPaymentDetails: ADMIN_OR_SECRETARIAT,
  setEntryScratched: ADMIN_OR_SECRETARIAT,
  createCompetitor: ADMIN_OR_SECRETARIAT,
  setBackNumber: ADMIN_OR_SECRETARIAT,
  assignBackNumbers: ADMIN_OR_SECRETARIAT,
  importCompetitors: ADMIN_OR_SECRETARIAT,
  importCompetitorsCsv: ADMIN_OR_SECRETARIAT,
  createLateEntry: ADMIN_OR_SECRETARIAT,
  markPaidAtVenue: ADMIN_OR_SECRETARIAT,
  moveScheduledEvent: ADMIN_OR_SECRETARIAT,
  setProgramStart: ADMIN_OR_SECRETARIAT,
  generateProgram: ADMIN_OR_SECRETARIAT,
  addProgramBreak: ADMIN_OR_SECRETARIAT,
  updateProgramSlot: ADMIN_OR_SECRETARIAT,
  moveProgramSlot: ADMIN_OR_SECRETARIAT,
  removeProgramSlot: ADMIN_OR_SECRETARIAT,
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
  saveHeats: SCRUTINEER,
  startRound: SCRUTINEER,
  clearFloor: SCRUTINEER,
  enterAdjudicatorMarks: SCRUTINEER,
  proposeTieDecision: SCRUTINEER,
  proposeFinalTie: SCRUTINEER,
  approveRound: SCRUTINEER,
  publishRound: SCRUTINEER,
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
  getMyEntrants: [Role.Team, Role.Athlete],
  getEntryPaymentMethods: [Role.Team, Role.Athlete],
  quoteMyEntries: [Role.Team, Role.Athlete],
  submitEntryRequest: [Role.Team, Role.Athlete],
  getMyEntryRequests: [Role.Team, Role.Athlete],
  cancelEntryRequest: [Role.Team, Role.Athlete],
  getEntryRequests: ADMIN_OR_SECRETARIAT,
  approveEntryRequest: ADMIN_OR_SECRETARIAT,
  rejectEntryRequest: ADMIN_OR_SECRETARIAT,
  claimRecord: [Role.Coach, Role.Team],
  cancelClaim: [Role.Coach, Role.Team],
  getMyRoster: [Role.Coach, Role.Team],
  getMemberClaims: ADMIN_OR_SECRETARIAT,
  approveMemberClaim: ADMIN_OR_SECRETARIAT,
  rejectMemberClaim: ADMIN_OR_SECRETARIAT,
  saveMyAthlete: [Role.Athlete],
  requestMembership: [Role.Athlete],
  changeMyPassword: [Role.Athlete, Role.Coach, Role.Team],
  signOutEverywhere: [Role.Athlete, Role.Coach, Role.Team],
  saveMyPhoto: [Role.Athlete],
  getMyActivity: [Role.Athlete, Role.Coach, Role.Team],
  getCompetitorActivity: OFFICIALS,
  getMyNotifications: [Role.Athlete, Role.Coach, Role.Team],
  markNotificationsRead: [Role.Athlete, Role.Coach, Role.Team],
  approveProfileChange: ADMIN_OR_SECRETARIAT,
  rejectProfileChange: ADMIN_OR_SECRETARIAT,
  getAthletes: ADMIN_OR_SECRETARIAT,
  confirmMembership: ADMIN_OR_SECRETARIAT,
  rejectMembership: ADMIN_OR_SECRETARIAT,
  resetAthletePassword: ADMIN_OR_SECRETARIAT,
  deleteAthlete: ADMIN_OR_SECRETARIAT,
  correctAthlete: ADMIN,
  correctMember: ADMIN,
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
