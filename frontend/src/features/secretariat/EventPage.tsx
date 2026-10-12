import type { EntryRow } from '@bis/shared'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge.tsx'
import { Button, ButtonLink, Dialog, ErrorState, PageHeader, Skeleton, Table, toast } from '../../components/ui/index.ts'
import { useEntryRows, useEvent, useScratchEntry } from '../../hooks/index.ts'
import { competitorName, eventCode, eventDances, eventGrade } from '../../lib/format.ts'

export function EventPage() {
  const { eventId = '' } = useParams()
  const event = useEvent(eventId)
  const entries = useEntryRows(eventId)
  const scratch = useScratchEntry()
  const [toScratch, setToScratch] = useState<EntryRow | null>(null)

  if (event.isError || entries.isError) {
    return <ErrorState onRetry={() => void Promise.all([event.refetch(), entries.refetch()])} />
  }
  if (!event.data) return <Skeleton className="h-24 w-full max-w-xl" />

  const rows = entries.data ?? []
  const active = rows.filter((r) => !r.scratched).length

  function setScratched(row: EntryRow, scratched: boolean) {
    scratch.mutate(
      { entryId: row.entryId, scratched },
      {
        onSuccess: () => {
          setToScratch(null)
          toast.success(`${scratched ? 'Scratched' : 'Restored'} ${competitorName(row.names)}`)
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Link to="/secretariat" className="w-fit text-small text-neutral-600 hover:text-neutral-900">
        All events
      </Link>
      <PageHeader
        title={`${eventCode(event.data)} ${eventDances(event.data)}`}
        description={`${eventGrade(event.data)} · ${event.data.isSolo ? 'Solo' : 'Couple'} · ${active} of ${rows.length} entries active`}
        actions={
          <>
            <ButtonLink variant="secondary" to={`/print/heats/${eventId}`} target="_blank">
              Heat list
            </ButtonLink>
            <ButtonLink variant="secondary" to={`/print/recall/${eventId}`} target="_blank">
              Recall list
            </ButtonLink>
          </>
        }
      />

      <Table<EntryRow>
        loading={entries.isLoading}
        rows={rows}
        rowKey={(r) => r.entryId}
        minWidthClass="min-w-0"
        paginationLabel="Entries pagination"
        detailTitle={(r) => competitorName(r.names)}
        rowClassName={(r) => (r.scratched ? 'text-neutral-400' : undefined)}
        empty={{ title: 'No entries yet', description: 'Entries appear here as clubs register and late entries are added.' }}
        columns={[
          { key: 'back', header: 'Back no.', cell: (r) => r.backNumber ?? '–', mono: true, widthClass: 'w-28' },
          {
            key: 'who',
            header: 'Competitor',
            cell: (r) => (
              <span className={r.scratched ? 'line-through' : undefined}>
                {competitorName(r.names)}
                {r.late && <span className="ml-2 text-xs text-neutral-500 no-underline">Late entry</span>}
              </span>
            ),
          },
          { key: 'club', header: 'Club', cell: (r) => r.clubName, muted: true, hideBelow: 'md' },
          {
            key: 'payment',
            header: 'Payment',
            cell: (r) => (r.paymentStatus ? <PaymentStatusBadge status={r.paymentStatus} /> : '–'),
            hideBelow: 'sm',
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-32',
            cell: (r) =>
              r.scratched ? (
                <Button variant="ghost" size="sm" aria-label={`Restore ${competitorName(r.names)}`} onClick={() => setScratched(r, false)}>
                  Restore
                </Button>
              ) : (
                <Button variant="ghost" size="sm" aria-label={`Scratch ${competitorName(r.names)}`} onClick={() => setToScratch(r)}>
                  Scratch
                </Button>
              ),
          },
        ]}
      />

      <Dialog
        open={toScratch !== null}
        onClose={() => setToScratch(null)}
        title={`Scratch ${toScratch ? competitorName(toScratch.names) : ''}?`}
        description="They are taken out of this event's heats. You can restore them later."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToScratch(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={scratch.isPending} onClick={() => toScratch && setScratched(toScratch, true)}>
              {scratch.isPending ? 'Scratching…' : 'Scratch'}
            </Button>
          </>
        }
      />
    </div>
  )
}
