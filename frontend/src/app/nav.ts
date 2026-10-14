import { Role } from '@bis/shared'
import {
  Activity,
  Award,
  CalendarClock,
  CalendarDays,
  Cloud,
  Clock,
  ClipboardCheck,
  ClipboardPen,
  Layers,
  LayoutGrid,
  ListChecks,
  ListOrdered,
  Trophy,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  // Matches only its own path, not nested ones (the section's landing screen)
  end?: boolean
  // Shown in the staff sidebar
  icon?: LucideIcon
}

export type StaffRole = typeof Role.Admin | typeof Role.Secretariat | typeof Role.Scrutineer | typeof Role.Chairperson

const scrutineerNav: NavItem[] = [
  { to: '/scrutineer', label: 'Rounds', end: true, icon: Layers },
  { to: '/scrutineer/heats', label: 'Heats', icon: LayoutGrid },
  { to: '/scrutineer/live', label: 'Live board', icon: Activity },
  { to: '/scrutineer/recall', label: 'Recall', icon: ListChecks },
  { to: '/scrutineer/results', label: 'Results', icon: Award },
  { to: '/scrutineer/paper', label: 'Paper marks', icon: ClipboardPen },
]

export const staffNav: Record<StaffRole, NavItem[]> = {
  admin: [
    { to: '/admin/competitions', label: 'Competitions', icon: Trophy },
    { to: '/admin/staff', label: 'Staff accounts', icon: Users },
    { to: '/admin/adjudicators', label: 'Adjudicators and panels', icon: ClipboardCheck },
    { to: '/admin/points', label: 'Points table', icon: ListOrdered },
    { to: '/admin/payments', label: 'Payments', icon: Wallet },
    { to: '/admin/sync', label: 'Cloud sync', icon: Cloud },
  ],
  secretariat: [
    { to: '/secretariat', label: 'Events', end: true, icon: CalendarDays },
    { to: '/secretariat/competitors', label: 'Competitors', icon: UserRound },
    { to: '/secretariat/late-entries', label: 'Late entries', icon: Clock },
    { to: '/secretariat/schedule', label: 'Schedule', icon: CalendarClock },
    { to: '/secretariat/sync', label: 'Cloud sync', icon: Cloud },
  ],
  scrutineer: scrutineerNav,
  // The chairperson sees the scrutineer's screens, read-only, and cannot enter marks
  chairperson: scrutineerNav.filter((item) => item.to !== '/scrutineer/paper'),
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
