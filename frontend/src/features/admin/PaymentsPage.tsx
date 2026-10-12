import { PaymentStatus, type PaymentDetail } from '@bis/shared'
import { useSearchParams } from 'react-router'
import { useState } from 'react'
import { cn } from '../../lib/cn.ts'
import { Avatars } from '../../components/Avatars.tsx'
import { PaymentStatusBadge } from '../../components/PaymentStatusBadge.tsx'
import {
  ErrorState,
  PageHeader,
  SearchField,
  Select,
  Table,
  Toolbar,
} from '../../components/ui/index.ts'
import { usePaymentDetails } from '../../hooks/index.ts'
import { PAYMENT_STATUS_LABEL, formatPeso } from '../../lib/format.ts'
import { PaymentReview } from './PaymentReview.tsx'

type Filter = 'all' | PaymentStatus
const ORDER: PaymentStatus[] = [
  PaymentStatus.ForChecking,
  PaymentStatus.Unpaid,
  PaymentStatus.Approved,
  PaymentStatus.Rejected,
  PaymentStatus.PaidAtVenue,
]

export function PaymentsPage() {
  const payments = usePaymentDetails()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const filter = (params.get('status') as Filter | null) ?? PaymentStatus.ForChecking
  const selectedId = params.get('payment')

  const update = (next: Record<string, string | null>) =>
    setParams(
      (p) => {
        for (const [key, value] of Object.entries(next)) {
          if (value === null) p.delete(key)
          else p.set(key, value)
        }
        return p
      },
      { replace: true },
    )

  const all = payments.data ?? []
  const count = (s: Filter) => (s === 'all' ? all.length : all.filter((p) => p.status === s).length)
  const needle = query.trim().toLowerCase()
  const queue = all.filter(
    (p) =>
      (filter === 'all' || p.status === filter) && (!needle || p.clubName.toLowerCase().includes(needle)),
  )

  if (payments.isError) return <ErrorState onRetry={() => void payments.refetch()} />

  const selected = all.find((p) => p.id === selectedId)
  const filters = [
    ...ORDER.map((s) => ({ id: s as Filter, label: PAYMENT_STATUS_LABEL[s], count: count(s) })),
    { id: 'all' as Filter, label: 'All', count: count('all') },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payments" description="Check each club's proof of payment against the amount due." />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-neutral-200 bg-neutral-200 sm:grid-cols-3 lg:grid-cols-6">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={f.id === filter}
            onClick={() => update({ status: f.id, payment: null })}
            className={cn(
              'flex flex-col gap-1 px-5 py-4 text-left transition-colors',
              f.id === filter ? 'bg-neutral-50 shadow-[inset_0_-2px_0_var(--color-gold-600)]' : 'bg-white hover:bg-neutral-50',
            )}
          >
            <span className="text-xs text-neutral-500">{f.label}</span>
            <span className="font-mono text-display tabular-nums leading-none text-neutral-900">{f.count}</span>
          </button>
        ))}
      </div>

      <Toolbar>
        <SearchField className="w-full sm:w-72" label="Search clubs" value={query} onChange={setQuery} />
        <div className="w-full sm:w-60">
          <Select
            label="Status"
            value={filter}
            onChange={(e) => update({ status: e.target.value, payment: null })}
          >
            {filters.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </div>
      </Toolbar>

      <Table<PaymentDetail>
        loading={payments.isLoading}
        rows={queue}
        rowKey={(p) => p.id}
        minWidthClass="min-w-0"
        paginationLabel="Payments pagination"
        onRowClick={(p) => update({ payment: p.id })}
        empty={{
          title: needle ? `No clubs match "${query.trim()}"` : 'Nothing in this queue',
          description: needle
            ? 'Try a different club name.'
            : filter === PaymentStatus.ForChecking
              ? 'Payments waiting to be checked appear here.'
              : 'No payments have this status.',
        }}
        columns={[
          {
            key: 'club',
            header: 'Club',
            cell: (p) => (
              <div className="flex items-center gap-3">
                <Avatars names={[p.clubName]} />
                <button type="button" className="truncate text-left font-medium text-neutral-900">
                  {p.clubName}
                </button>
              </div>
            ),
          },
          {
            key: 'entries',
            header: 'Entries',
            cell: (p) => p.lines.length,
            mono: true,
            align: 'right',
            hideBelow: 'sm',
          },
          { key: 'due', header: 'Amount due', cell: (p) => formatPeso(p.amountDue), mono: true, align: 'right' },
          { key: 'status', header: 'Status', cell: (p) => <PaymentStatusBadge status={p.status} />, hideBelow: 'sm' },
        ]}
      />

      {selected && <PaymentReview key={selected.id} payment={selected} onClose={() => update({ payment: null })} />}
    </div>
  )
}
