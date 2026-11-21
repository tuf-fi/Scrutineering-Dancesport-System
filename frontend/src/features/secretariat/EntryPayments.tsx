import { PaymentStatus } from '@bis/shared'
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge.tsx'
import { Button, Skeleton, toast } from '../../components/ui/index.ts'
import { useCompetitorActivity } from '../../hooks/useAthlete.ts'
import { useMarkPaidAtVenue, useMarkUnpaid } from '../../hooks/useSecretariat.ts'

// Whether each entry is paid. Entries with no payment (none required) are left out.
export function EntryPayments({ competitorId }: { competitorId: string }) {
  const activity = useCompetitorActivity(competitorId)
  const pay = useMarkPaidAtVenue()
  const unpay = useMarkUnpaid()
  if (activity.isLoading) return <Skeleton className="h-10 w-full" />
  const rows = (activity.data?.entries ?? []).filter((e) => !e.scratched && e.paymentId && e.paymentStatus)
  if (rows.length === 0) return null

  const update = (paymentId: string, paid: boolean) =>
    (paid ? pay : unpay).mutate(paymentId, {
      onSuccess: () => toast.success(paid ? 'Marked paid' : 'Marked unpaid'),
      onError: (e) => toast.error(e.message),
    })

  return (
    <ul aria-label="Entry payments" className="mb-4 border-y border-neutral-200">
      {rows.map((e) => {
        const paid = e.paymentStatus === PaymentStatus.PaidAtVenue || e.paymentStatus === PaymentStatus.Approved
        const settleable = e.paymentStatus === PaymentStatus.Unpaid || e.paymentStatus === PaymentStatus.Rejected
        return (
          <li key={e.entryId} className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 py-2 first:border-t-0">
            <span className="flex items-center gap-3">
              <span className="font-mono text-small tabular-nums text-neutral-600">E{e.eventNumber}</span>
              <PaymentStatusBadge status={e.paymentStatus!} />
            </span>
            {paid && (
              <Button variant="ghost" size="sm" disabled={unpay.isPending} onClick={() => update(e.paymentId!, false)}>
                Mark unpaid
              </Button>
            )}
            {settleable && (
              <Button variant="secondary" size="sm" disabled={pay.isPending} onClick={() => update(e.paymentId!, true)}>
                Mark paid
              </Button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
