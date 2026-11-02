import type { StaffUser } from '@bis/shared'
import { EmptyState, Skeleton } from '../../components/ui/index.ts'
import { useAuditLog } from '../../hooks/index.ts'
import { timeAgo } from '../../lib/timeAgo.ts'

const SHOWN = 10

// The latest things a staff account did, from the audit log
export function StaffActivity({ user }: { user: StaffUser }) {
  const log = useAuditLog()
  const mine = [...(log.data ?? [])].filter((e) => e.actorId === user.id).sort((a, b) => b.at.localeCompare(a.at))

  return (
    <section aria-label="Recent activity" className="flex flex-col gap-3">
      <h3 className="font-mono text-xs uppercase text-neutral-500">Recent activity</h3>
      {log.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : mine.length === 0 ? (
        <EmptyState title="Nothing yet" description="Actions this account takes are listed here." />
      ) : (
        <ol className="border-y border-neutral-200">
          {mine.slice(0, SHOWN).map((e) => (
            <li key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 border-t border-neutral-200 py-3 first:border-t-0">
              <span className="flex min-w-0 flex-col">
                <span className="text-small font-medium text-neutral-900">{e.action}</span>
                <span className="truncate text-small text-neutral-500">{e.target}</span>
              </span>
              <span className="font-mono text-xs uppercase tabular-nums text-neutral-500">{timeAgo(e.at)}</span>
            </li>
          ))}
        </ol>
      )}
      {mine.length > SHOWN && <p className="text-small text-neutral-500">and {mine.length - SHOWN} earlier</p>}
    </section>
  )
}
