import type { AthletePage as AthleteData } from '@bis/shared'
import { EmptyState, Pagination } from '../../components/ui/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import { formatDate } from '../../lib/format.ts'
import { AccountSection } from './AccountSection.tsx'

const KIND = { sent: 'Sent', confirmed: 'Confirmed', rejected: 'Not confirmed' } as const

// Every membership payment the athlete sent, and what the secretariat decided, newest first
export function PaymentHistory({ page }: { page: AthleteData }) {
  const history = [...page.profile.history].reverse()
  const { page: current, setPage, pageSize, total, pageItems } = usePagination(history, 'payments')

  return (
    <AccountSection title="Payment history" note="Each payment you sent for your membership, and what the secretariat decided.">
      {history.length === 0 ? (
        <EmptyState title="No payments yet" description="Payments you send for your membership appear here." />
      ) : (
        <ol aria-label="Payment history" className="border-b border-neutral-200">
          {pageItems.map((h, i) => (
            <li key={`${h.at}-${i}`} className="grid grid-cols-[6.5rem_1fr_auto] items-baseline gap-x-4 border-t border-neutral-200 py-3.5 text-small sm:px-3">
              <span className="font-mono text-xs uppercase tabular-nums text-neutral-500">{formatDate(h.at.slice(0, 10))}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium text-neutral-900">{h.year} membership</span>
                <span className="text-neutral-600">
                  {[h.method, h.reference && `ref ${h.reference}`].filter(Boolean).join(' · ')}
                  {h.reason && ` — ${h.reason}`}
                </span>
              </span>
              <span className={cn('whitespace-nowrap', h.kind === 'confirmed' ? 'font-medium text-success' : h.kind === 'rejected' ? 'font-medium text-danger' : 'text-neutral-600')}>{KIND[h.kind]}</span>
            </li>
          ))}
        </ol>
      )}
      {total > pageSize && <Pagination page={current} pageSize={pageSize} total={total} onPageChange={setPage} label="Payment history pagination" />}
    </AccountSection>
  )
}
