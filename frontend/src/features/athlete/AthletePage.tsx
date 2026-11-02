import type { AthletePage as AthleteData } from '@bis/shared'
import { Bell, ClipboardList, FilePlus2, KeyRound, ListChecks, Medal, Pencil, Receipt, Trophy, UserRound, WalletCards } from 'lucide-react'
import { Outlet, useLocation, useOutletContext } from 'react-router'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { useMyAthlete } from '../../hooks/index.ts'
import { Avatars } from '../../components/Avatars.tsx'
import { HeaderStat, HeaderStats, PublicHeader } from '../public/PublicHeader.tsx'
import { AccountInfo } from './AccountInfo.tsx'
import { EntryRequestsList, RegisterPage } from './EntryRegistration.tsx'
import { AccountNav, type NavGroup } from './AccountNav.tsx'
import { EditAccount } from './EditAccount.tsx'
import { MembershipSection } from './MembershipSection.tsx'
import { MyEntries } from './MyEntries.tsx'
import { MyRankings } from './MyRankings.tsx'
import { MyResults } from './MyResults.tsx'
import { Notifications, todosOf } from './Notifications.tsx'
import { PaymentHistory } from './PaymentHistory.tsx'
import { SecurityPage as Security } from './SecurityPage.tsx'

const GROUPS: NavGroup[] = [
  {
    label: 'Profile',
    items: [
      { to: '/athlete', label: 'Account', icon: UserRound, end: true },
      { to: '/athlete/edit', label: 'Edit account', icon: Pencil },
    ],
  },
  {
    label: 'Competitions',
    items: [
      { to: '/athlete/results', label: 'My results', icon: Trophy },
      { to: '/athlete/rankings', label: 'My rankings', icon: Medal },
      { to: '/athlete/entries', label: 'My entries', icon: ListChecks },
      { to: '/athlete/register', label: 'Enter events', icon: FilePlus2 },
      { to: '/athlete/requests', label: 'My requests', icon: ClipboardList },
    ],
  },
  {
    label: 'Payments',
    items: [
      { to: '/athlete/membership', label: 'Membership', icon: WalletCards },
      { to: '/athlete/payments', label: 'Payment history', icon: Receipt },
      { to: '/athlete/notifications', label: 'Notifications', icon: Bell },
    ],
  },
  { label: 'Security', items: [{ to: '/athlete/password', label: 'Password', icon: KeyRound }] },
]

const useAthleteData = () => useOutletContext<AthleteData>()

export const AccountPage = () => <AccountInfo page={useAthleteData()} />
export const EditAccountPage = () => <EditAccount page={useAthleteData()} />
export const MembershipPage = () => <MembershipSection page={useAthleteData()} />
export const PaymentsPage = () => <PaymentHistory page={useAthleteData()} />
export const PasswordPage = () => <Security />
export const ResultsPage = () => <MyResults />
export const RankingsPage = () => <MyRankings />
export const EntriesPage = () => <MyEntries />
export const RegisterEventsPage = () => <RegisterPage who="athlete" />
export const RequestsPage = () => <EntryRequestsList />
export const NotificationsPage = () => <Notifications todos={todosOf(useAthleteData())} />

// The signed-in athlete's account: a sidebar of sections beside the one that is open
export function AthletePage() {
  const athlete = useMyAthlete()
  // The name, picture and membership status open the account; the other pages go straight to their content
  const onAccount = useLocation().pathname.replace(/\/$/, '') === '/athlete'

  if (athlete.isError) return <ErrorState onRetry={() => void athlete.refetch()} />

  const page = athlete.data
  const paid = page ? page.profile.memberYear === page.year : false

  return (
    <div className="flex flex-col gap-8 lg:pl-[15rem]">
      {onAccount && (
        <PublicHeader
          eyebrow="Athlete account"
          title={page?.profile.name ?? 'Your account'}
          description={page?.profile.email}
          leading={page && <Avatars names={[page.profile.name]} photo={page.profile.photo} size="xxl" />}
          aside={
            page && (
              <HeaderStats>
                <HeaderStat value={paid ? 'Paid' : 'Not paid'} label={`${page.year} membership`} />
              </HeaderStats>
            )
          }
        />
      )}

      <div className="flex flex-col gap-8">
        <AccountNav groups={GROUPS} />

        <div className="min-w-0">
          {page ? (
            <Outlet context={page} />
          ) : (
            <div className="flex max-w-2xl flex-col gap-5" aria-busy="true">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-64 w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
