import { Role } from '@bis/shared'
import {
  Activity,
  ArrowLeftRight,
  Award,
  Banknote,
  Building2,
  CalendarClock,
  CalendarDays,
  Clock,
  ClipboardCheck,
  Image as ImageIcon,
  IdCard,
  Inbox,
  Layers,
  Link2,
  ShieldCheck,
  LayoutGrid,
  FileText,
  ListChecks,
  ListOrdered,
  Trophy,
  UserRound,
  Users,
  Megaphone,
  Wallet,
  WifiOff,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  // Matches only its own path, not nested ones (the section's landing screen)
  end?: boolean
  // Other paths that count as this item, like a profile under its list
  also?: string[]
  // Shown in the staff sidebar
  icon?: LucideIcon
  // The small heading this item sits under in the staff sidebar; items with the same one are shown together
  group?: string
}

export type StaffRole = typeof Role.Admin | typeof Role.Secretariat | typeof Role.Scrutineer | typeof Role.Chairperson

const scrutineerNav: NavItem[] = [
  { to: '/scrutineer', label: 'Rounds', end: true, icon: Layers },
  { to: '/scrutineer/heats', label: 'Heats', icon: LayoutGrid },
  { to: '/scrutineer/live', label: 'Live board', icon: Activity },
  { to: '/scrutineer/paper-marks', label: 'Paper marks', icon: FileText },
  { to: '/scrutineer/recall', label: 'Recall', icon: ListChecks },
  { to: '/scrutineer/results', label: 'Results', icon: Award },
  { to: '/scrutineer/security', label: 'Security', icon: ShieldCheck },
]

// The secretariat's work. The admin can do all of it too, so these screens sit in the admin's menu as well.
const entriesNav: NavItem[] = [
  { to: '/secretariat', label: 'Events', end: true, icon: CalendarDays, group: 'Entries' },
  { to: '/secretariat/competitors', label: 'Competitors', icon: UserRound, group: 'Entries' },
  { to: '/secretariat/teams', label: 'Teams', icon: Building2, group: 'Entries' },
  { to: '/secretariat/coaches', label: 'Coaches', icon: Users, group: 'Entries' },
  { to: '/secretariat/athletes', label: 'Athletes', icon: IdCard, group: 'Entries' },
  { to: '/secretariat/entry-requests', label: 'Entry requests', icon: Inbox, group: 'Entries' },
  { to: '/secretariat/account-links', label: 'Account links', icon: Link2, group: 'Entries' },
  { to: '/secretariat/profile-changes', label: 'Profile changes', icon: ArrowLeftRight, group: 'Entries' },
  { to: '/secretariat/late-entries', label: 'Late entries', icon: Clock, group: 'Entries' },
]
const dayNav: NavItem[] = [
  { to: '/secretariat/schedule', label: 'Schedule', icon: CalendarClock, group: 'The day' },
  { to: '/secretariat/program', label: 'Program', icon: ListOrdered, group: 'The day' },
]

export const staffNav: Record<StaffRole, NavItem[]> = {
  admin: [
    { to: '/admin/competitions', label: 'Competitions', icon: Trophy, group: 'Setup' },
    { to: '/admin/categories', label: 'Kinds and age groups', icon: Layers, group: 'Setup' },
    { to: '/admin/adjudicators', label: 'Adjudicators and panels', icon: ClipboardCheck, group: 'Setup' },
    ...entriesNav,
    ...dayNav,
    { to: '/admin/points', label: 'Points table', icon: ListOrdered, group: 'Scoring and fees' },
    { to: '/admin/payments', label: 'Payments', icon: Wallet, group: 'Scoring and fees' },
    { to: '/admin/fees', label: 'Fees and payment details', icon: Banknote, group: 'Scoring and fees' },
    { to: '/admin/offline-day', label: 'Offline day', icon: WifiOff, group: 'System' },
    { to: '/admin/site', label: 'Home page', icon: ImageIcon, group: 'System' },
    { to: '/admin/staff', label: 'Staff accounts', icon: Users, group: 'System' },
    { to: '/admin/security', label: 'Security', icon: ShieldCheck, group: 'System' },
  ],
  secretariat: [...entriesNav, ...dayNav, { to: '/secretariat/security', label: 'Security', icon: ShieldCheck, group: 'System' }],
  scrutineer: scrutineerNav,
  // The chairperson watches and confirms ties; starting rounds and setting heats are the scrutineer's
  chairperson: scrutineerNav.filter((item) => !['/scrutineer', '/scrutineer/heats', '/scrutineer/paper-marks'].includes(item.to)),
}

export const publicNav: NavItem[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/competitions', label: 'Competitions' },
  { to: '/athletes', label: 'Bicol Athletes', also: ['/competitors'] },
  { to: '/results', label: 'Results' },
  { to: '/standings', label: 'Standings' },
]

// The announcer has one screen; the account page's sidebar offers it so there is a way back
export const compereNav: NavItem[] = [{ to: '/compere', label: 'Announcer', icon: Megaphone }]

// The barker has one screen as well
export const barkerNav: NavItem[] = [{ to: '/barker', label: 'Barker', icon: Megaphone }]


// Staff and adjudicators sign in here; it is not linked from any public page
export const STAFF_SIGN_IN = '/staff-access'

// Where each role lands after signing in
export const roleHome: Record<Role, string> = {
  admin: '/admin',
  secretariat: '/secretariat',
  scrutineer: '/scrutineer',
  chairperson: '/scrutineer/live',
  adjudicator: '/adjudicator/waiting',
  athlete: '/athlete',
  coach: '/coach',
  team: '/team',
  compere: '/compere',
  barker: '/barker',
  public: '/',
}
