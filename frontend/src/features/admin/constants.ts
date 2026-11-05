import { Role } from '@bis/shared'

// Accounts that sign in with an email and password
export const STAFF_ROLES = [Role.Admin, Role.Secretariat, Role.Scrutineer, Role.Chairperson, Role.Compere]

// Adjudicator letters, A to J
export const LETTERS = 'ABCDEFGHIJ'.split('')
