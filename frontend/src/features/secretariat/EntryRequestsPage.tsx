import type { EntryRequest } from '@bis/shared'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Dialog, ErrorState, IconButton, PageHeader, SearchField, Select, Table, Textarea, Toolbar, toast } from '../../components/ui/index.ts'
import { useApproveEntryRequest, useEntryRequests, useRejectEntryRequest } from '../../hooks/index.ts'
import { competitorName, formatDateTime, formatPeso } from '../../lib/format.ts'

type Filter = 'waiting' | 'all'
const TONE = { waiting: 'gold', approved: 'success', rejected: 'danger' } as const
const LABEL = { waiting: 'Waiting', approved: 'Approved', rejected: 'Not approved' } as const

// Entries sent by teams and athletes, with the payment screenshot. Approving makes the entries and records the payment.
export function EntryRequestsPage() {
  const requests = useEntryRequests()
  const approve = useApproveEntryRequest()
  const reject = useRejectEntryRequest()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('waiting')
  const [viewing, setViewing] = useState<EntryRequest | null>(null)
  const [rejecting, setRejecting] = useState<EntryRequest | null>(null)
  const [reason, setReason] = useState('')

  if (requests.isError) return <ErrorState onRetry={() => void requests.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (requests.data ?? []).filter(
    (r) => (filter === 'all' || r.status === 'waiting') && (!needle || `${competitorName(r.names)} ${r.requesterName} ${r.competitionName} ${r.reference}`.toLowerCase().includes(needle)),
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Entry requests" description="Entries sent by teams and athletes. Check the payment screenshot, then approve to enter them." />

      <Toolbar>
        <SearchField className="w-full sm:w-64" label="Search requests" value={query} onChange={setQuery} />
        <Select label="Show" hideLabel className="w-full sm:w-52" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="waiting">Waiting for you</option>
          <option value="all">All requests</option>
        </Select>
      </Toolbar>

      <Table<EntryRequest>
        loading={requests.isLoading}
        rows={rows}
        rowKey={(r) => r.id}
        minWidthClass="min-w-0"
        paginationLabel="Entry requests pagination"
        detailTitle={(r) => competitorName(r.names)}
        empty={needle || filter === 'all' ? { title: 'No requests match', description: 'Try a different name.' } : { title: 'Nothing waiting', description: 'Requests appear here when a team or an athlete sends an entry.' }}
        detailExtra={(r) => (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-xs uppercase text-neutral-500">Payment screenshot</span>
              {r.receipt ? (
                <button type="button" onClick={() => setViewing(r)} aria-label="View the payment screenshot" className="w-fit border border-neutral-200 bg-neutral-50 p-1.5 transition-colors hover:border-gold-400">
                  <img src={r.receipt} alt="Payment screenshot" className="h-20 w-auto max-w-40 object-contain" />
                </button>
              ) : (
                <span className="text-small text-neutral-500">None</span>
              )}
            </div>
            {r.rejectedReason && <p className="text-small text-danger">Turned down: {r.rejectedReason}</p>}
            {r.warnings.length > 0 && (
              <ul className="flex flex-col gap-1 text-small text-neutral-600">
                {r.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            {r.status === 'waiting' && (
              <div className="flex gap-2">
                <Button disabled={approve.isPending} onClick={() => approve.mutate(r.id, { onSuccess: () => toast.success('Entered'), onError: (e) => toast.error(e.message) })}>
                  Approve
                </Button>
                <Button variant="secondary" onClick={() => setRejecting(r)}>
                  Turn down
                </Button>
              </div>
            )}
          </div>
        )}
        columns={[
          { key: 'who', header: 'Dancers', bold: true, cell: (r) => competitorName(r.names) },
          { key: 'from', header: 'Sent by', muted: true, hideBelow: 'md', cell: (r) => `${r.requesterName} (${r.requesterRole === 'team' ? 'team' : 'athlete'})` },
          { key: 'events', header: 'Events', mono: true, cell: (r) => r.eventNumbers.map((n) => `E${n}`).join(', ') },
          { key: 'competition', header: 'Competition', detailOnly: true, cell: (r) => r.competitionName },
          { key: 'sent', header: 'Sent', detailOnly: true, cell: (r) => formatDateTime(r.createdAt) },
          { key: 'total', header: 'Total', align: 'right', mono: true, cell: (r) => formatPeso(r.total) },
          {
            key: 'payment',
            header: 'Payment',
            hideBelow: 'sm',
            cell: (r) => <span className="text-small text-neutral-700">{r.method}{r.reference ? ` ${r.reference}` : ''}</span>,
          },
          {
            key: 'status',
            header: 'Status',
            cell: (r) => (
              <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (r) =>
              r.status === 'waiting' ? (
                <div className="flex justify-end gap-0.5">
                  <IconButton
                    icon={Check}
                    label={`Approve the entry of ${competitorName(r.names)}`}
                    disabled={approve.isPending}
                    onClick={() => approve.mutate(r.id, { onSuccess: () => toast.success('Entered'), onError: (e) => toast.error(e.message) })}
                  />
                  <IconButton icon={X} tone="danger" label={`Turn down the entry of ${competitorName(r.names)}`} onClick={() => setRejecting(r)} />
                </div>
              ) : null,
          },
        ]}
      />

      <Dialog open={viewing !== null} onClose={() => setViewing(null)} title="Payment screenshot" description={viewing ? `${viewing.method} · ${formatPeso(viewing.total)}` : undefined} className="max-w-lg">
        {viewing?.receipt && <img src={viewing.receipt} alt="Payment screenshot, full size" className="max-h-[70dvh] w-full border border-neutral-200 object-contain" />}
      </Dialog>

      <Dialog
        open={rejecting !== null}
        onClose={() => {
          setRejecting(null)
          setReason('')
        }}
        title="Turn down this entry?"
        description="They see your reason and can send it again."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setRejecting(null)
                setReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={reject.isPending || !reason.trim()}
              onClick={() =>
                rejecting &&
                reject.mutate(
                  { id: rejecting.id, reason },
                  {
                    onSuccess: () => {
                      setRejecting(null)
                      setReason('')
                    },
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              Turn down
            </Button>
          </>
        }
      >
        <Textarea label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
      </Dialog>
    </div>
  )
}
