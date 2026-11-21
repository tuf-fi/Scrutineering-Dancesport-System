import { PaymentStatus, type MyEntry } from '@bis/shared'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge.tsx'
import { Button, Dialog, IconButton, Skeleton, toast } from '../../components/ui/index.ts'
import { useCompetitorActivity } from '../../hooks/useAthlete.ts'
import { useDeleteEntry, useMarkPaidAtVenue, useMarkUnpaid } from '../../hooks/useSecretariat.ts'
import { eventCode } from '../../lib/format.ts'

// Each event the athlete is entered in: whether it is paid (when a payment is needed), and a way to take them out of it
export function EntryEvents({ competitorId }: { competitorId: string }) {
  const activity = useCompetitorActivity(competitorId)
  const pay = useMarkPaidAtVenue()
  const unpay = useMarkUnpaid()
  const remove = useDeleteEntry()
  // One entry, or the ticked ones together
  const [removing, setRemoving] = useState<MyEntry[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  if (activity.isLoading) return <Skeleton className="h-10 w-full" />
  const rows = activity.data?.entries ?? []
  if (rows.length === 0) return null
  const chosen = rows.filter((e) => selected.has(e.entryId))
  const allChosen = chosen.length === rows.length
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const codes = (list: MyEntry[]) => list.map((e) => eventCode({ number: e.eventNumber })).join(', ')

  const update = (paymentId: string, paid: boolean) =>
    (paid ? pay : unpay).mutate(paymentId, {
      onSuccess: () => toast.success(paid ? 'Marked paid' : 'Marked unpaid'),
      onError: (e) => toast.error(e.message),
    })

  return (
    <>
      {rows.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="flex cursor-pointer items-center gap-3 text-small text-neutral-700">
            <input type="checkbox" checked={allChosen} onChange={() => setSelected(allChosen ? new Set() : new Set(rows.map((e) => e.entryId)))} className="size-4 accent-gold-500" />
            Select all
          </label>
          {chosen.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setRemoving(chosen)}>
              {`Remove ${chosen.length} selected`}
            </Button>
          )}
        </div>
      )}
      <ul aria-label="Events entered" className="mb-4 border-y border-neutral-200">
        {rows.map((e) => {
          const paid = e.paymentStatus === PaymentStatus.PaidAtVenue || e.paymentStatus === PaymentStatus.Approved
          const settleable = e.paymentStatus === PaymentStatus.Unpaid || e.paymentStatus === PaymentStatus.Rejected
          return (
            <li key={e.entryId} className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 py-2 first:border-t-0">
              <span className="flex items-center gap-3">
                <input type="checkbox" aria-label={`Select ${eventCode({ number: e.eventNumber })}`} checked={selected.has(e.entryId)} onChange={() => toggle(e.entryId)} className="size-4 accent-gold-500" />
                <span className="font-mono text-small tabular-nums text-neutral-600">{eventCode({ number: e.eventNumber })}</span>
                {e.scratched ? <span className="text-small text-neutral-500">Scratched</span> : e.paymentStatus && <PaymentStatusBadge status={e.paymentStatus} />}
              </span>
              <span className="flex items-center gap-1">
                {!e.scratched && paid && e.paymentId && (
                  <Button variant="ghost" size="sm" disabled={unpay.isPending} onClick={() => update(e.paymentId!, false)}>
                    Mark unpaid
                  </Button>
                )}
                {!e.scratched && settleable && e.paymentId && (
                  <Button variant="secondary" size="sm" disabled={pay.isPending} onClick={() => update(e.paymentId!, true)}>
                    Mark paid
                  </Button>
                )}
                <IconButton icon={Trash2} tone="danger" label={`Remove from ${eventCode({ number: e.eventNumber })}`} onClick={() => setRemoving([e])} />
              </span>
            </li>
          )
        })}
      </ul>

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove from ${codes(removing)}?` : ''}
        description="The athlete is taken out of these events only. Their other events stay. An unpaid payment for them is removed; a paid one stays for you to settle."
        actions={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => {
                if (!removing) return
                const list = removing
                // One at a time, so a payment shared by several entries is only removed after its last one
                list
                  .reduce((done, e) => done.then(() => remove.mutateAsync(e.entryId)), Promise.resolve<unknown>(undefined))
                  .then(
                    () => toast.success(`Removed from ${codes(list)}`),
                    (e: Error) => toast.error(e.message),
                  )
                  .finally(() => {
                    setRemoving(null)
                    setSelected(new Set())
                  })
              }}
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </>
        }
      />
    </>
  )
}
