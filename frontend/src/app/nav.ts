import { Role } from '@bis/shared'

export interface NavItem {
  to: string
  label: string
  // Matches only its own path, not nested ones (the section's landing screen)
  end?: boolean
}

export type StaffRole = typeof Role.Admin | typeof Role.Secretariat | typeof Role.Scrutineer | typeof Role.Chairperson

export const staffNav: Record<StaffRole, NavItem[]> = {
  admin: [
    { to: '/admin', label: 'Competitions', end: true },
    { to: '/admin/staff', label: 'Staff accounts' },
    { to: '/admin/adjudicators', label: 'Adjudicators and panels' },
    { to: '/admin/points', label: 'Points table' },
    { to: '/admin/payments', label: 'Payments' },
  ],
  secretariat: [
    { to: '/secretariat', label: 'Events', end: true },
    { to: '/secretariat/competitors', label: 'Competitors' },
    { to: '/secretariat/late-entries', label: 'Late entries' },
    { to: '/secretariat/schedule', label: 'Schedule' },
  ],
  scrutineer: [
    { to: '/scrutineer', label: 'Rounds', end: true },
    { to: '/scrutineer/heats', label: 'Heats' },
    { to: '/scrutineer/live', label: 'Live board' },
    { to: '/scrutineer/recall', label: 'Recall' },
    { to: '/scrutineer/results', label: 'Results' },
  ],
  // The chairperson sees the scrutineer's screens, read-only
  chairperson: [
    { to: '/scrutineer', label: 'Rounds', end: true },
    { to: '/scrutineer/heats', label: 'Heats' },
    { to: '/scrutineer/live', label: 'Live board' },
    { to: '/scrutineer/recall', label: 'Recall' },
    { to: '/scrutineer/results', label: 'Results' },
  ],
}

export const publicNav: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/competitions', label: 'Competitions' },
  { to: '/rankings', label: 'Rankings' },
]

export const clubNav: NavItem[] = [
  { to: '/club', label: 'Dancers', end: true },
  { to: '/club/events', label: 'Events' },
  { to: '/club/payments', label: 'Payments' },
]

export const isStaffRole = (role: Role): role is StaffRole => role in staffNav

// Where each role lands after signing in
export const roleHome: Record<Role, string> = {
  admin: '/admin',
  secretariat: '/secretariat',
  scrutineer: '/scrutineer',
  chairperson: '/scrutineer',
  adjudicator: '/adjudicator/waiting',
  mc: '/mc',
  club: '/club',
  public: '/',
}
