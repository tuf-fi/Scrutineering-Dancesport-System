import type { AthletePage as AthleteData } from '@bis/shared'
import { Badge } from '../../components/ui/index.ts'
import { formatPeso } from '../../lib/format.ts'
import { AccountSection } from './AccountSection.tsx'

// Where the athlete's membership stands. The team pays it, so there is nothing to send from here.
export function MembershipSection({ page }: { page: AthleteData }) {
  const { profile, year, fee } = page
  const request = profile.request
  const paid = profile.memberYear === year
  const waiting = request !== null && !request.rejectedReason

  return (
    <AccountSection title={`${year} membership`} note={`Paid once a year, by your team. It ends on December 31, ${year}, whenever it is paid.`}>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b border-neutral-200 pb-6">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-xs uppercase text-neutral-500">Fee</span>
          <p className="font-mono text-display font-semibold leading-none tabular-nums text-neutral-900">{formatPeso(fee)}</p>
        </div>
        <div className="flex items-center gap-4">
          {paid && profile.membershipId && <span className="font-mono text-xs uppercase text-neutral-500">ID {profile.membershipId}</span>}
          {paid && <span className="font-mono text-xs uppercase text-neutral-500">Valid until December 31, {year}</span>}
          {paid ? (
            <Badge tone="success">Paid</Badge>
          ) : waiting ? (
            <Badge tone="gold">Waiting for the secretariat</Badge>
          ) : request ? (
            <Badge tone="danger">Not confirmed</Badge>
          ) : (
            <Badge tone={profile.memberYear !== null ? 'danger' : 'neutral'}>{profile.memberYear !== null ? 'Membership expired' : 'Not paid'}</Badge>
          )}
        </div>
      </div>

      {paid ? (
        <p className="text-body text-neutral-700">Your membership is paid and lasts until December 31, {year}.</p>
      ) : waiting ? (
        <p className="text-body text-neutral-700">
          {request.paidBy ? `${request.paidBy} sent` : 'A team sent'} a screenshot of the {request.method} payment. The secretariat will confirm it once the money arrives.
        </p>
      ) : request?.rejectedReason ? (
        <p role="alert" className="text-body text-danger">
          The secretariat could not confirm the payment: {request.rejectedReason}. Ask your team to send it again.
        </p>
      ) : (
        <p className="text-body text-neutral-700">Your team pays the membership fee. Ask your team to include you.</p>
      )}
    </AccountSection>
  )
}
