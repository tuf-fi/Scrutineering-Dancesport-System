import { Role, type AuditEntry, type StaffUser } from '@bis/shared'
import { at } from './rng.ts'

export const staffUsers: StaffUser[] = [
  { id: 'staff-admin', name: 'Amelia Rosales', username: 'admin', role: Role.Admin },
  { id: 'staff-secretariat', name: 'Jonas Bellosillo', username: 'secretariat', role: Role.Secretariat },
  { id: 'staff-scrutineer', name: 'Teresita Quimpo', username: 'scrutineer', role: Role.Scrutineer },
  { id: 'staff-chairperson', name: 'Gregorio Almazan', username: 'chairperson', role: Role.Chairperson },
]

export const auditLog: AuditEntry[] = [
  { id: 'audit-1', actorId: 'staff-admin', action: 'Created competition', target: 'Sorsogon Dancesport Open 2026', at: at(-43_200) },
  { id: 'audit-2', actorId: 'staff-admin', action: 'Approved payment', target: 'Sorsogon DanceSport Team', at: at(-20_160) },
  { id: 'audit-3', actorId: 'staff-admin', action: 'Rejected payment', target: 'Naga Dance Academy', at: at(-19_800) },
  { id: 'audit-4', actorId: 'staff-secretariat', action: 'Assigned back numbers', target: 'All entries', at: at(-120) },
  { id: 'audit-5', actorId: 'staff-scrutineer', action: 'Published round', target: 'Round 1', at: at(90) },
]
