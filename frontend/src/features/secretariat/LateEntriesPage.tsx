import { PaymentStatus, type LateEntryRow, type PaymentDetail } from '@bis/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { CompetitionSelect } from '../../components/CompetitionSelect.tsx'
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge.tsx'
import {
  Button,
  Dialog,
  ErrorState,
  IconButton,
  PageHeader,
  SearchField,
  Table,
  Tabs,
  Toolbar,
  ToolbarActions,
  toast,
} from '../../components/ui/index.ts'
import { useDeleteLateEntry, useLateEntries, useMarkPaidAtVenue, usePaymentDetails } from '../../hooks/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { competitorName, eventCode, eventDances, formatPeso } from '../../lib/format.ts'
import { LateEntryDialog } from './LateEntryDialog.tsx'

const TABS = [
  { id: 'late', label: 'Late entries' },
  { id: 'cash', label: 'Cash payments' },
]

function LateEntriesTab({
  competitionId,
  competitions,
  onCompetitionChange,
}: {
  competitionId: string
  competitions: Array<{ id: string; name: string }>
  onCompetitionChange: (id: string) => void
}) {
  const late = useLateEntries(competitionId)
  const [query, setQuery] = useState('')
  // The late entry being edited, or 'new' while adding one
  const [editing, setEditing] = useState<LateEntryRow | 'new' | null>(null)
  const [toDelete, setToDelete] = useState<LateEntryRow | null>(null)
  const remove = useDeleteLateEntry()

  if (late.isError) return <ErrorState onRetry={() => void late.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (late.data ?? []).filter(
    (r) => !needle || `${competitorName(r.names)} ${r.clubName} ${eventCode({ number: r.eventNumber })}`.toLowerCase().includes(needle),
  )

  return (
    <div className="flex flex-col gap-6">
      <Toolbar>
        <SearchField className="w-full sm:w-72" label="Search late entries" value={query} onChange={setQuery} />
        <CompetitionSelect list={competitions} value={competitionId} onChange={onCompetitionChange} />
        <ToolbarActions>
          <Button onClick={() => setEditing('new')}>Add late entry</Button>
        </ToolbarActions>
      </Toolbar>

      <Table<LateEntryRow>
        loading={late.isLoading}
        rows={rows}
        rowKey={(r) => r.entryId}
        minWidthClass="min-w-0"
        paginationLabel="Late entries pagination"
        detailTitle={(r) => competitorName(r.names)}
        empty={
          needle
            ? { title: 'No late entries match' }
            : { title: 'No late entries yet', description: 'Entries added at the venue after the deadline appear here.' }
        }
        columns={[
          {
            key: 'event',
            header: 'Event',
            cell: (r) => (
              <div className="flex flex-col">
                <span className="font-mono tabular-nums">{eventCode({ number: r.eventNumber })}</span>
                <span className="text-xs text-neutral-500">{eventDances({ dances: r.dances })}</span>
              </div>
            ),
          },
          { key: 'who', header: 'Competitor', cell: (r) => <span className="font-medium">{competitorName(r.names)}</span> },
          { key: 'club', header: 'Club', cell: (r) => r.clubName, muted: true, hideBelow: 'md' },
          { key: 'fee', header: 'Fee', cell: (r) => formatPeso(r.fee), mono: true, align: 'right', hideBelow: 'sm' },
          {
            key: 'payment',
            header: 'Payment',
            cell: (r) => (r.paymentStatus ? <PaymentStatusBadge status={r.paymentStatus} /> : '–'),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-24',
            cell: (r) => (
              <div className="flex justify-end gap-0.5">
                <IconButton icon={Pencil} label={`Edit late entry for ${competitorName(r.names)}`} onClick={() => setEditing(r)} />
                <IconButton icon={Trash2} tone="danger" label={`Remove late entry for ${competitorName(r.names)}`} onClick={() => setToDelete(r)} />
              </div>
            ),
          },
        ]}
      />

      <LateEntryDialog
        open={editing !== null}
        competitionId={competitionId}
        entry={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)}
      />
      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={`Remove ${toDelete ? competitorName(toDelete.names) : ''}?`}
        description="The late entry and its payment record are deleted. Add it again if it was a mistake."
        actions={
          <>
            <Button variant="ghost" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() =>
                toDelete &&
                remove.mutate(toDelete.entryId, {
                  onSuccess: () => {
                    toast.success(`Removed late entry for ${competitorName(toDelete.names)}`)
                    setToDelete(null)
                  },
                  onError: (e) => {
                    setToDelete(null)
                    toast.error(e.message)
                  },
                })
              }
            >
              {remove.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </>
        }
      />
    </div>
  )
}

function CashTab() {
  const payments = usePaymentDetails()
  const markPaid = useMarkPaidAtVenue()
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<PaymentDetail | null>(null)

  if (payments.isError) return <ErrorState onRetry={() => void payments.refetch()} />

  const needle = query.trim().toLowerCase()
  const rows = (payments.data ?? []).filter(
    (p) =>
      (p.status === PaymentStatus.Unpaid || p.status === PaymentStatus.Rejected) &&
      (!needle || p.clubName.toLowerCase().includes(needle)),
  )

  function confirm() {
    if (!target) return
    markPaid.mutate(target.id, {
      onSuccess: () => {
        toast.success(`${target.clubName} marked as paid at the venue`)
        setTarget(null)
      },
      onError: (e) => {
        setTarget(null)
        toast.error(e.message)
      },
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Toolbar>
        <SearchField className="w-full sm:w-72" label="Search clubs" value={query} onChange={setQuery} />
      </Toolbar>

      <Table<PaymentDetail>
        loading={payments.isLoading}
        rows={rows}
        rowKey={(p) => p.id}
        minWidthClass="min-w-0"
        paginationLabel="Cash payments pagination"
        detailTitle={(p) => p.clubName}
        empty={
          needle
            ? { title: 'No clubs match' }
            : { title: 'Nothing to collect', description: 'Clubs that have not paid, or whose proof was rejected, appear here.' }
        }
        columns={[
          { key: 'club', header: 'Club', cell: (p) => <span className="font-medium">{p.clubName}</span> },
          { key: 'due', header: 'Amount due', cell: (p) => formatPeso(p.amountDue), mono: true, align: 'right' },
          { key: 'status', header: 'Status', cell: (p) => <PaymentStatusBadge status={p.status} />, hideBelow: 'sm' },
          {
            key: 'actions',
            header: '',
            align: 'right',
            widthClass: 'w-40',
            cell: (p) => (
              <Button variant="secondary" size="sm" aria-label={`Mark ${p.clubName} paid at venue`} onClick={() => setTarget(p)}>
                Paid at venue
              </Button>
            ),
          },
        ]}
      />

      <Dialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={`Record ${formatPeso(target?.amountDue ?? 0)} in cash?`}
        description={`${target?.clubName ?? ''} paid at the venue. This replaces any proof they uploaded.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button disabled={markPaid.isPending} onClick={confirm}>
              {markPaid.isPending ? 'Saving…' : 'Record payment'}
            </Button>
          </>
        }
      />
    </div>
  )
}

export function LateEntriesPage() {
  const [tab, setTab] = useState('late')
  const [chosen, setChosen] = useState<string | null>(null)
  const { list, competitionId } = useCompetitionChoice(chosen)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Late entries" description="Entries added at the venue, and clubs paying in cash." />
      <Tabs label="View" items={TABS} value={tab} onChange={setTab} />
      {tab === 'late' ? (
        competitionId && (
          <LateEntriesTab competitionId={competitionId} competitions={list} onCompetitionChange={setChosen} />
        )
      ) : (
        <CashTab />
      )}
    </div>
  )
}
