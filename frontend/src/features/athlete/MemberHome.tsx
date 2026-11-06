import { membershipLabel, type MemberAccount, type MemberPaymentRow, type MemberRoster, type MemberRosterRow } from '@bis/shared'
import { Bell, ClipboardList, FilePlus2, KeyRound, Link2, ListChecks, Medal, Pencil, Receipt, Trophy, UserRound, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Outlet, useLocation, useOutletContext } from 'react-router'
import { Avatars } from '../../components/Avatars.tsx'
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge.tsx'
import { Button, ButtonLink, ErrorState, Input, SearchField, Select, Skeleton, SkeletonList, Table, toast } from '../../components/ui/index.ts'
import { useCancelClaim, useClaimRecord, useTeams, useCoaches, useMyMember, useMyRoster, useSaveMyMember, useSaveMyMemberPhoto } from '../../hooks/index.ts'
import { competitorName, formatDate, formatPeso } from '../../lib/format.ts'
import { HeaderStat, HeaderStats, PublicHeader } from '../public/PublicHeader.tsx'
import { AccountNav, type NavGroup } from './AccountNav.tsx'
import { AccountSection } from './AccountSection.tsx'
import { EntryRequestsList, RegisterPage } from './EntryRegistration.tsx'
import { Notifications, type Todo } from './Notifications.tsx'
import { PhotoField } from './PhotoField.tsx'
import { MyEntries } from './MyEntries.tsx'
import { MyRankings } from './MyRankings.tsx'
import { MyResults } from './MyResults.tsx'
import { SecurityPage } from './SecurityPage.tsx'

interface MemberData {
  account: MemberAccount
  roster: MemberRoster
}

const useMemberData = () => useOutletContext<MemberData>()

function groupsFor(role: 'coach' | 'team'): NavGroup[] {
  const base = `/${role}`
  return [
    {
      label: 'Profile',
      items: [
        { to: base, label: 'Account', icon: UserRound, end: true },
        { to: `${base}/link`, label: role === 'team' ? 'Link your team' : 'Link your coach', icon: Link2 },
        { to: `${base}/edit`, label: 'Edit account', icon: Pencil },
        { to: `${base}/notifications`, label: 'Notifications', icon: Bell },
      ],
    },
    {
      label: role === 'team' ? 'Team' : 'Bicol athletes',
      items: [
        { to: `${base}/dancers`, label: 'Dancers', icon: Users },
        { to: `${base}/results`, label: 'Results', icon: Trophy },
        { to: `${base}/rankings`, label: 'Standings', icon: Medal },
        { to: `${base}/entries`, label: 'Entries', icon: ListChecks },
      ],
    },
    ...(role === 'team'
      ? [
          {
            label: 'Register',
            items: [
              { to: `${base}/register`, label: 'Enter events', icon: FilePlus2 },
              { to: `${base}/requests`, label: 'My requests', icon: ClipboardList },
            ],
          },
        ]
      : []),
    ...(role === 'team' ? [{ label: 'Payments', items: [{ to: `${base}/payments`, label: 'Payments', icon: Receipt }] }] : []),
    { label: 'Security', items: [{ to: `${base}/password`, label: 'Password', icon: KeyRound }] },
  ]
}

// Until the secretariat links the account to a coach or team record there is nothing to show; the account asks here
function LinkRecord() {
  const { account } = useMemberData()
  const team = account.role === 'team'
  // A team picks a team and a coach picks their name; the server only lets coaches read the coach list
  const coaches = useCoaches(!team)
  const teams = useTeams()
  const claim = useClaimRecord()
  const cancel = useCancelClaim()
  const [target, setTarget] = useState('')
  const options = team ? (teams.data ?? []) : (coaches.data ?? [])

  if (account.linked) {
    return (
      <AccountSection title={team ? 'Link your team' : 'Link your coach'} note={`You are linked to ${account.linked.name}.`}>
        <p className="text-small text-neutral-600">{team ? 'Your dancers and payments are on your page.' : 'Your athletes are on your page.'}</p>
      </AccountSection>
    )
  }

  if (account.claim) {
    return (
      <AccountSection title="Waiting for the secretariat" note={`You asked to be linked to ${account.claim.name}. Your page fills in as soon as they confirm it.`}>
        <Button variant="secondary" size="sm" className="w-fit" disabled={cancel.isPending} onClick={() => cancel.mutate(undefined)}>
          Cancel the request
        </Button>
      </AccountSection>
    )
  }

  return (
    <AccountSection
      title={team ? 'Link your team' : 'Link your coach'}
      note={team ? 'Choose your team. The secretariat confirms it, then your dancers and payments appear here.' : 'Choose your name. The secretariat confirms it, then your athletes appear here.'}
    >
      <div className="flex max-w-md flex-col gap-5">
        <Select label={team ? 'Team' : 'Coach'} value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">{team ? 'Choose a team' : 'Choose your name'}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Button className="w-fit" disabled={!target || claim.isPending} onClick={() => claim.mutate(target, { onError: (e) => toast.error(e.message) })}>
          Send request
        </Button>
      </div>
    </AccountSection>
  )
}

const THIS_YEAR = new Date().getFullYear()
const paidFor = (year: number | null) => membershipLabel(year, THIS_YEAR)

// What is on file, read-only, and the link to the coach or team record
function AccountInfo() {
  const { account, roster } = useMemberData()
  const team = account.role === 'team'
  const rows = [
    { label: team ? 'Team name' : 'Full name', value: account.name },
    { label: 'Email', value: account.email },
    ...(team ? [] : [{ label: 'Date of birth', value: account.birthDate ? formatDate(account.birthDate) : undefined }]),
    { label: 'Contact no.', value: account.phone },
    { label: 'Province', value: account.province },
    { label: 'Address', value: account.address },
    { label: team ? 'Linked team' : 'Linked coach', value: account.linked?.name },
    ...(roster.membership ? [{ label: 'Membership', value: paidFor(roster.membership.memberYear) }, { label: 'Membership ID', value: roster.membership.membershipId ?? undefined }, { label: 'Coaches Summit', value: paidFor(roster.membership.summitYear) }, { label: 'Summits attended', value: roster.membership.summits?.length ? roster.membership.summits.map(formatDate).join(', ') : undefined }] : []),
  ]
  const missing = rows.some((r) => !r.value && !r.label.startsWith('Linked') && r.label !== 'Membership' && r.label !== 'Membership ID' && r.label !== 'Coaches Summit' && r.label !== 'Summits attended')

  return (
    <div className="flex flex-col gap-12">
      <AccountSection title="Account information" note="Only the secretariat sees these. They use them for your entry form.">
        <dl className="divide-y divide-neutral-200 border-y border-neutral-200">
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[8.5rem_1fr] gap-x-6 py-3.5 text-small sm:grid-cols-[11rem_1fr]">
              <dt className="text-neutral-600">{r.label}</dt>
              <dd className={r.value ? 'font-medium text-neutral-900' : 'text-neutral-400'}>{r.value || (r.label.startsWith('Linked') ? 'Not linked' : 'Not set')}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/${account.role}/edit`}>Edit account</ButtonLink>
        </div>
        {missing && <p className="text-small text-neutral-600">Some details are empty. Fill them in so the secretariat can reach you.</p>}
      </AccountSection>
    </div>
  )
}

// Shown instead of the content of a page that needs the account to be linked first
function NotLinked({ title, note }: { title: string; note?: string }) {
  const { account } = useMemberData()
  return (
    <AccountSection title={title} note={note}>
      <p className="text-small text-neutral-600">
        {account.claim ? 'Waiting for the secretariat to confirm your link. ' : `${account.role === 'team' ? 'Your dancers and payments' : 'Your athletes'} appear once the secretariat links your account. `}
        <Link to={`/${account.role}/link`} className="font-semibold text-neutral-900 underline decoration-gold-500 decoration-2 underline-offset-4">
          {account.claim ? 'See your request' : 'Link it here'}
        </Link>
        .
      </p>
    </AccountSection>
  )
}

function Dancers() {
  const { account, roster } = useMemberData()
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = roster.rows.filter((r) => !needle || `${competitorName(r.names)} ${r.teamName} ${r.backNumber ?? ''}`.toLowerCase().includes(needle))

  if (!account.linked) return <NotLinked title="Dancers" />

  return (
    <AccountSection title="Dancers" note={account.role === 'team' ? 'Everyone entered under your team.' : 'The dancers whose entry form names you as their coach.'}>
      {(
        <>
          <SearchField className="w-full sm:w-72" label="Search dancers" value={query} onChange={setQuery} />
          <Table<MemberRosterRow>
            rows={shown}
            rowKey={(r) => r.competitorId}
            empty={{ title: needle ? 'No dancers match' : 'No dancers yet', description: needle ? undefined : 'They appear here once the secretariat enters them.' }}
            paginationLabel="Dancers pagination"
            columns={[
              {
                key: 'name',
                header: 'Dancers',
                bold: true,
                cell: (r) => (
                  <Link to={`/competitors/${r.competitorId}`} className="hover:underline">
                    {competitorName(r.names)}
                  </Link>
                ),
              },
              { key: 'number', header: 'Back no.', mono: true, cell: (r) => (r.backNumber === null ? '–' : String(r.backNumber).padStart(3, '0')) },
              { key: 'team', header: 'Team', muted: true, hideBelow: 'sm', cell: (r) => r.teamName },
              { key: 'entries', header: 'Entries', align: 'right', mono: true, cell: (r) => r.entries },
            ]}
          />
        </>
      )}
    </AccountSection>
  )
}

function Payments() {
  const { account, roster } = useMemberData()
  if (!account.linked) return <NotLinked title="Payments" />

  return (
    <AccountSection title="Payments" note="What the secretariat works out as owed for each competition, and what has been paid.">
      {(
        <Table<MemberPaymentRow>
          rows={roster.payments}
          rowKey={(r) => r.id}
          empty={{ title: 'No payments yet', description: 'They appear here once the secretariat records what is owed.' }}
          paginationLabel="Payments pagination"
          columns={[
            { key: 'competition', header: 'Competition', bold: true, cell: (r) => r.competitionName },
            { key: 'date', header: 'Date', mono: true, muted: true, hideBelow: 'sm', cell: (r) => (r.date ? formatDate(r.date) : '–') },
            { key: 'due', header: 'Due', align: 'right', mono: true, cell: (r) => formatPeso(r.amountDue) },
            { key: 'paid', header: 'Paid', align: 'right', mono: true, hideBelow: 'sm', cell: (r) => (r.amountPaid === null ? '–' : formatPeso(r.amountPaid)) },
            { key: 'status', header: 'Status', align: 'right', cell: (r) => <PaymentStatusBadge status={r.status} /> },
          ]}
        />
      )}
    </AccountSection>
  )
}

function EditAccount() {
  const { account } = useMemberData()
  const save = useSaveMyMember()
  const team = account.role === 'team'
  const [name, setName] = useState(account.name)
  const [birthDate, setBirthDate] = useState(account.birthDate)
  const [phone, setPhone] = useState(account.phone)
  const [province, setProvince] = useState(account.province)
  const [address, setAddress] = useState(account.address)
  const [error, setError] = useState<string | undefined>()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError(team ? 'Enter the name of your team.' : 'Enter your name.')
    setError(undefined)
    save.mutate({ name, birthDate: team ? '' : birthDate, phone, province, address }, { onSuccess: (saved) => toast.success(saved.changeRequest && !saved.changeRequest.rejectedReason ? 'Saved. Your change is waiting for the secretariat.' : 'Saved'), onError: (e) => toast.error(e.message) })
  }

  return (
    <AccountSection title="Edit account" note="Only the secretariat sees these. They use them for your entry form.">
      <PhotoField profile={account} useSave={useSaveMyMemberPhoto} />
      <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input label={team ? 'Team name' : 'Full name'} required value={name} onChange={(e) => setName(e.target.value)} error={error} hint={team ? undefined : 'A new name is sent to the secretariat to approve.'} />
        <Input label="Email" value={account.email} disabled readOnly />
        {!team && <Input label="Date of birth" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} hint={account.birthDate ? 'A new date is sent to the secretariat to approve.' : undefined} />}
        <Input label="Contact no." inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input label="Province" value={province} onChange={(e) => setProvince(e.target.value)} />
        <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
        {account.changeRequest && (
          <p className="text-small text-neutral-600 sm:col-span-2">
            {account.changeRequest.rejectedReason
              ? `Your last change was turned down: ${account.changeRequest.rejectedReason}`
              : 'A change is waiting for the secretariat. Until they approve it, your current details stay.'}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </AccountSection>
  )
}

function MemberNotifications() {
  const { account } = useMemberData()
  const team = account.role === 'team'
  const todos: Todo[] = !account.linked && !account.claim ? [{ id: 'link', title: team ? 'Link your team' : 'Link your coach', detail: 'The secretariat confirms it, then your dancers appear.', to: `/${account.role}/link` }] : []
  return <Notifications todos={todos} />
}

const who = (role: 'coach' | 'team') => (role === 'team' ? 'your team' : 'your athletes')

function Results() {
  const { account } = useMemberData()
  if (!account.linked) return <NotLinked title="Results" />
  return (
    <MyResults
      title="Results"
      note={`The placings of ${who(account.role)} from approved results. Open a competition to see them.`}
      empty={{ title: 'No results yet', description: 'Placings appear here after a competition where your dancers danced is published.' }}
    />
  )
}

function Entries() {
  const { account } = useMemberData()
  if (!account.linked) return <NotLinked title="Entries" />
  return (
    <MyEntries
      title="Entries"
      note={`Every event ${who(account.role)} are entered in. Open a competition to see them.`}
      empty={{ title: 'No entries yet', description: 'Entries appear here once the secretariat enters your dancers in an event.' }}
    />
  )
}

function Rankings() {
  const { account } = useMemberData()
  if (!account.linked) return <NotLinked title="Standings" />
  return <MyRankings title="Standings" note={`Where ${who(account.role)} stand in each category, by points.`} />
}

function Register() {
  const { account } = useMemberData()
  if (!account.linked) return <NotLinked title="Enter events" />
  return <RegisterPage who="team" />
}

function Requests() {
  const { account } = useMemberData()
  if (!account.linked) return <NotLinked title="My requests" />
  return <EntryRequestsList />
}

export const MemberRegisterPage = Register
export const MemberRequestsPage = Requests
export const MemberLinkPage = LinkRecord
export const MemberEditPage = EditAccount
export const MemberNotificationsPage = MemberNotifications
export const MemberResultsPage = Results
export const MemberEntriesPage = Entries
export const MemberRankingsPage = Rankings
export const MemberPasswordPage = SecurityPage
export const MemberAccountPage = AccountInfo
export const MemberDancersPage = Dancers
export const MemberPaymentsPage = Payments

// A coach's or a team's account, laid out like the athlete's: a sidebar of sections beside the one that is open
export function MemberHome() {
  const member = useMyMember()
  const roster = useMyRoster()
  const { pathname } = useLocation()
  const account = member.data
  const onAccount = pathname.replace(/\/$/, '') === `/${account?.role ?? ''}`

  if (member.isError || roster.isError) return <ErrorState onRetry={() => void Promise.all([member.refetch(), roster.refetch()])} />

  const ready = account && roster.data
  return (
    <div className="flex flex-col gap-8 max-lg:pt-14 lg:pl-[15rem]">
      {onAccount && account && (
        <PublicHeader
          eyebrow={account.role === 'team' ? 'Team account' : 'Coach account'}
          title={account.name}
          description={
            <>
              <span className="block">{account.email}</span>
              <span className="block font-mono text-xs uppercase text-neutral-500">
                {account.linked ? `Linked to ${account.linked.name}` : account.claim ? `Waiting to be linked to ${account.claim.name}` : 'Not linked yet'}
              </span>
            </>
          }
          leading={<Avatars names={[account.name]} photo={account.photo} size="xxl" />}
          aside={
            roster.data && (
              <HeaderStats>
                <HeaderStat value={String(roster.data.rows.length)} label="Dancers" />
              </HeaderStats>
            )
          }
        />
      )}

      <div className="flex flex-col gap-8">
        {account && <AccountNav groups={groupsFor(account.role)} />}
        <div className="min-w-0">
          {ready ? (
            <Outlet context={{ account, roster: roster.data } satisfies MemberData} />
          ) : (
            <div className="flex max-w-2xl flex-col gap-5" aria-busy="true">
              <Skeleton className="h-5 w-40" />
              <SkeletonList rows={5} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
