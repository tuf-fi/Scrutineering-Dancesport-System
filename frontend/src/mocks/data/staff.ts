import { Role, samplePhoto, type AuditEntry, type StaffUser } from '@bis/shared'
import { at } from './rng.ts'

export const staffUsers: StaffUser[] = [
  { id: 'staff-admin', name: 'Amelia Rosales', username: 'admin@sample.example', role: Role.Admin, photo: samplePhoto('Amelia Rosales') },
  { id: 'staff-secretariat', name: 'Jonas Bellosillo', username: 'secretariat@sample.example', role: Role.Secretariat, photo: samplePhoto('Jonas Bellosillo') },
  { id: 'staff-scrutineer', name: 'Teresita Quimpo', username: 'scrutineer@sample.example', role: Role.Scrutineer, photo: samplePhoto('Teresita Quimpo') },
  { id: 'staff-chairperson', name: 'Gregorio Almazan', username: 'chairperson@sample.example', role: Role.Chairperson, photo: samplePhoto('Gregorio Almazan') },
  { id: 'staff-compere', name: 'Dante Ibarra', username: 'compere@sample.example', role: Role.Compere, photo: samplePhoto('Dante Ibarra') },
]

export const auditLog: AuditEntry[] = [
  { id: 'audit-1', actorId: 'staff-admin', action: 'Created competition', target: 'Sorsogon Dancesport Open 2026', at: at(-43_200) },
  { id: 'audit-2', actorId: 'staff-admin', action: 'Approved payment', target: 'Sorsogon DanceSport Team', at: at(-20_160) },
  { id: 'audit-3', actorId: 'staff-admin', action: 'Rejected payment', target: 'Naga Dance Academy', at: at(-19_800) },
  { id: 'audit-4', actorId: 'staff-secretariat', action: 'Assigned back numbers', target: 'All entries', at: at(-120) },
  { id: 'audit-5', actorId: 'staff-scrutineer', action: 'Published round', target: 'Round 1', at: at(90) },
]
