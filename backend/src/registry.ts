import { Role } from '@bis/shared'
import { fail, type Ctx } from './core/context.ts'
import { admin } from './services/admin.ts'
import { club } from './services/club.ts'
import { reads } from './services/reads.ts'
import { rounds } from './services/rounds.ts'
import { scrutiny } from './services/scrutiny.ts'
import { secretariat } from './services/secretariat.ts'
import { syncFunctions } from './services/sync.ts'
import { accountFunctions } from './services/accounts.ts'
import { isStaff, toClub } from './services/shared.ts'
import * as t from './db/schema.ts'
import { asc } from 'drizzle-orm'

type Handler = (ctx: Ctx, ...args: never[]) => unknown

const STAFF: Role[] = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Mc]
const ADMIN: Role[] = [Role.Admin]
const ADMIN_OR_SECRETARIAT: Role[] = [Role.Admin, Role.Secretariat]
const SCRUTINEER: Role[] = [Role.Scrutineer]
const SCORING: Role[] = [Role.Scrutineer, Role.Chairperson, Role.Admin]

// 'public' needs no sign-in; 'signedIn' needs any account; a list needs one of those roles
export type Access = 'public' | 'signedIn' | Role[]

// Guests get club names for results pages, never contact details
const getClubs = (ctx: Ctx) =>
  ctx.db
    .select()
    .from(t.clubs)
    .orderBy(asc(t.clubs.name))
    .all()
    .map((c) => (isStaff(ctx) ? toClub(c) : { id: c.id, name: c.name, contactName: '', contactEmail: '', contactPhone: '' }))

const getBackupStatus = (ctx: Ctx) => ctx.backups.status()

const handlers: Record<string, Handler> = {
  ...reads,
  ...admin,
  ...secretariat,
  ...rounds,
  ...scrutiny,
  ...club,
  ...syncFunctions,
  ...accountFunctions,
  getClubs,
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
  getRankingPoints: 'public',
  getCompetitorHistory: 'public',
  getCompetitors: 'public',
  getClubs: 'public',
  getResultEventIds: 'public',
  getCompetitionRounds: 'public',
  // Public only once the round is published; staff see them as the round runs
  getRecallTable: 'public',
  getSkatingTable: 'public',
  getCurrentRoundId: 'signedIn',

  // Staff
  getEntries: STAFF,
  getHeats: STAFF,
  getAdjudicators: STAFF,
  getPanel: STAFF,
  getPanels: STAFF,
  getCompetitionEntries: STAFF,
  getEntryRows: STAFF,
  getCompetitorRows: STAFF,
  getLateEntries: STAFF,
  getSchedule: STAFF,
  getAnnouncements: STAFF,
  getSubmissions: STAFF,
  getHeatAssignments: STAFF,
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
  resetStaffPassword: ADMIN,
  createAdjudicator: ADMIN,
  updateAdjudicator: ADMIN,
  deleteAdjudicator: ADMIN,
  generatePins: ADMIN,
  setPanel: ADMIN,
  savePointsTable: ADMIN,
  approvePayment: ADMIN,
  rejectPayment: ADMIN,
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
  updateCompetitor: ADMIN_OR_SECRETARIAT,
  deleteCompetitor: ADMIN_OR_SECRETARIAT,
  deleteLateEntry: ADMIN_OR_SECRETARIAT,
  updateLateEntry: ADMIN_OR_SECRETARIAT,
  saveEvent: ADMIN_OR_SECRETARIAT,
  deleteEvent: ADMIN_OR_SECRETARIAT,

  // Scrutineer and chairperson
  planRounds: SCRUTINEER,
  saveHeats: SCRUTINEER,
  startRound: SCRUTINEER,
  clearFloor: SCRUTINEER,
  enterAdjudicatorMarks: SCRUTINEER,
  proposeTieDecision: SCRUTINEER,
  approveRound: SCRUTINEER,
  publishRound: SCRUTINEER,
  confirmTieDecision: [Role.Chairperson],

  // Adjudicators, each only for themselves
  getAdjudicatorState: [Role.Adjudicator],
  submitAdjudicatorMarks: [Role.Adjudicator],

  // Syncing the venue with the cloud
  getSyncStatus: [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson],
  getCloudCompetitions: ADMIN_OR_SECRETARIAT,
  pullCompetition: ADMIN_OR_SECRETARIAT,
  syncNow: [Role.Admin, Role.Secretariat, Role.Scrutineer],
  uploadCompetition: ADMIN,
  releaseCompetition: ADMIN,
  unlockCompetition: ADMIN,

  // Fees, payment details and club accounts
  getPaymentSettings: [Role.Admin, Role.Secretariat],
  savePaymentSettings: ADMIN,
  changeClubPassword: [Role.Club],
  resetClubPassword: ADMIN,
  eraseClubAccount: ADMIN,
  clearOldReceipts: ADMIN,
  getMessengerLink: [Role.Club],
  unlinkMessenger: [Role.Club],

  // Clubs, each only for their own club
  getClubDancers: [Role.Club],
  saveClubDancer: [Role.Club],
  deleteClubDancer: [Role.Club],
  getEntryOptions: [Role.Club],
  registerClubEntries: [Role.Club],
  getClubPayments: [Role.Club],
  getPaymentMethods: [Role.Club],
  submitClubPayment: [Role.Club],
}

// Anything that changes data runs in one transaction and tells the other screens afterwards
const reading = new Set(
  Object.keys(handlers).filter((name) => /^get/.test(name)),
)

// Things that only make sense at the venue: running rounds and marking, and syncing with the cloud
const VENUE_ONLY = new Set([
  'getAdjudicatorState',
  'submitAdjudicatorMarks',
  'enterAdjudicatorMarks',
  'getMarkingTask',
  'getCurrentRoundId',
  'getSubmissions',
  'getAnnouncements',
  'startRound',
  'clearFloor',
  'planRounds',
  'saveHeats',
  'getHeatAssignments',
  'proposeTieDecision',
  'confirmTieDecision',
  'approveRound',
  'publishRound',
  'getSyncStatus',
  'getCloudCompetitions',
  'pullCompetition',
  'syncNow',
  'uploadCompetition',
  'releaseCompetition',
])
// Things that only make sense online
const CLOUD_ONLY = new Set(['unlockCompetition', 'savePaymentSettings', 'changeClubPassword', 'resetClubPassword', 'eraseClubAccount', 'clearOldReceipts', 'getMessengerLink', 'unlinkMessenger'])
// These talk to the other server, so they wait for an answer and manage their own database work
const ASYNC = new Set(['getCloudCompetitions', 'pullCompetition', 'syncNow', 'uploadCompetition', 'releaseCompetition'])

export interface Endpoint {
  access: Access
  write: boolean
  async: boolean
  // Switched off in the other mode
  mode: 'both' | 'venue' | 'cloud'
  run: (ctx: Ctx, args: unknown[]) => unknown
}

export function endpoint(name: string): Endpoint | undefined {
  const handler = handlers[name]
  const rule = access[name]
  if (!handler || rule === undefined) return undefined
  return {
    access: rule,
    write: !reading.has(name),
    async: ASYNC.has(name),
    mode: VENUE_ONLY.has(name) ? 'venue' : CLOUD_ONLY.has(name) ? 'cloud' : 'both',
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
