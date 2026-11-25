import type { FeeItem } from '@bis/shared'
import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, Dialog, ErrorState, IconButton, Select, EmptyState, SkeletonList, Table, Toolbar, ToolbarActions, toast } from '../../components/ui/index.ts'
import { useCompetitionFees, useDeleteFee, useEvents } from '../../hooks/index.ts'
import { useCompetitionChoice } from '../../hooks/useCompetitionChoice.ts'
import { useCompetitions } from '../../hooks/queries.ts'
import { eventCode, formatPeso } from '../../lib/format.ts'
import { FeeDialog } from './FeeDialog.tsx'
import { SectionHead } from './SectionHead.tsx'

const SHOWN = 8

// The prices of one competition: each fee has a name, its prices and the events it applies to
export function EventFees() {
  const [chosen, setChosen] = useState<string | null>(null)
  const { list, competitionId } = useCompetitionChoice(chosen)
  const competitions = useCompetitions()
  const fees = useCompetitionFees(competitionId)
  const events = useEvents(competitionId)
  const remove = useDeleteFee()
  // The fee being edited, or 'new' while adding one
  const [editing, setEditing] = useState<FeeItem | 'new' | null>(null)
  const [toRemove, setToRemove] = useState<FeeItem | null>(null)

  const head = <SectionHead title="Event fees" note="Each competition has its own. Add the prices it charges and choose the events for each." />

  if (competitions.isSuccess && list.length === 0) {
    return (
      <section className="flex flex-col gap-6">
        {head}
        <EmptyState title="No competitions yet" description="Create a competition, then set its fees here." />
      </section>
    )
  }

  const competition = list.find((c) => c.id === competitionId)
  const sorted = [...(events.data ?? [])].sort((a, b) => a.number - b.number)
  const unpriced = fees.data ? sorted.filter((e) => !fees.data.some((f) => f.id === e.feeId)) : []
  const free = competition?.paymentRequired === false
  const eventsOf = (fee: FeeItem) => sorted.filter((e) => e.feeId === fee.id)

  return (
    <section className="flex flex-col gap-6">
      {head}
      <Toolbar>
        <Select label="Competition" value={competitionId ?? ''} onChange={(e) => setChosen(e.target.value)}>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <ToolbarActions>
          <Button disabled={!competitionId || !fees.data} onClick={() => setEditing('new')}>
            Add fee
          </Button>
        </ToolbarActions>
      </Toolbar>

      {free ? (
        <p className="text-small text-neutral-600">This competition is free to enter, so none of these prices are charged.</p>
      ) : (
        unpriced.length > 0 && (
          <p role="status" className="border-y border-neutral-200 py-3 text-small text-neutral-900">
            <span className="font-semibold text-danger">
              {unpriced.length === 1 ? '1 event has no fee' : `${unpriced.length} events have no fee`}
            </span>{' '}
            and cannot be entered: <span className="font-mono tabular-nums">{unpriced.map(eventCode).join(', ')}</span>
          </p>
        )
      )}

      {fees.isError || events.isError ? (
        <ErrorState onRetry={() => void Promise.all([fees.refetch(), events.refetch()])} />
      ) : !fees.data || !events.data ? (
        <SkeletonList />
      ) : (
        <Table<FeeItem>
          rows={fees.data}
          rowKey={(f) => f.id}
          minWidthClass="min-w-0"
          paginationLabel="Fees pagination"
          detailTitle={(f) => f.name}
          detailExtra={(f) => (
            <section aria-label="Events" className="flex flex-col gap-2">
              <h3 className="font-mono text-xs uppercase text-neutral-500">Events ({eventsOf(f).length})</h3>
              <p className="font-mono text-small tabular-nums text-neutral-900">{eventsOf(f).map(eventCode).join(', ') || 'None'}</p>
            </section>
          )}
          empty={{ title: 'No fees yet', description: 'Add the first price this competition charges.' }}
          columns={[
            { key: 'name', header: 'Fee', wrap: true, cell: (f) => <span className="inline-block font-medium text-neutral-900 sm:min-w-40">{f.name}</span> },
            { key: 'amount', header: 'Price', mono: true, align: 'right', cell: (f) => formatPeso(f.amount) },
            { key: 'extra', header: 'Extra entry', mono: true, align: 'right', muted: true, hideBelow: 'md', cell: (f) => (f.extra === null ? '–' : formatPeso(f.extra)) },
            { key: 'late', header: 'Late entry', mono: true, align: 'right', muted: true, hideBelow: 'md', cell: (f) => (f.late === null ? '–' : formatPeso(f.late)) },
            {
              key: 'events',
              header: 'Events',
              wrap: true,
              hideBelow: 'sm',
              detail: false,
              cell: (f) => {
                const own = eventsOf(f)
                if (own.length === 0) return <span className="text-neutral-500">None</span>
                const more = own.length - SHOWN
                return (
                  <span className="font-mono tabular-nums">
                    {own.slice(0, SHOWN).map(eventCode).join(', ')}
                    {more > 0 && <span className="whitespace-nowrap text-neutral-500"> +{more} more</span>}
                  </span>
                )
              },
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              widthClass: 'w-24',
              cell: (f) => (
                <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                  <IconButton icon={Pencil} label={`Edit ${f.name}`} onClick={() => setEditing(f)} />
                  <IconButton icon={Trash2} tone="danger" label={`Remove ${f.name}`} onClick={() => setToRemove(f)} />
                </div>
              ),
            },
          ]}
        />
      )}

      <FeeDialog
        open={editing !== null}
        competitionId={competitionId ?? ''}
        fee={editing === 'new' ? null : editing}
        fees={fees.data ?? []}
        events={sorted}
        onClose={() => setEditing(null)}
      />
      <Dialog
        open={toRemove !== null}
        onClose={() => setToRemove(null)}
        title={`Remove ${toRemove?.name ?? 'this fee'}?`}
        description={
          toRemove && eventsOf(toRemove).length > 0
            ? `${eventsOf(toRemove).map(eventCode).join(', ')} will have no fee and cannot be entered until you choose another. Payments already made stay as they are.`
            : 'No event uses it. Payments already made stay as they are.'
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => setToRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => {
                if (!toRemove) return
                remove.mutate(toRemove.id, { onSuccess: () => toast.success('Fee removed'), onError: (e) => toast.error(e.message) })
                setToRemove(null)
              }}
            >
              Remove
            </Button>
          </>
        }
      />
    </section>
  )
}
