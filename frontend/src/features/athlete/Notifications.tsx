import type { AthletePage as AthleteData } from '@bis/shared'
import { Link } from 'react-router'
import { Button, EmptyState, Pagination, Skeleton } from '../../components/ui/index.ts'
import { useMarkNotificationsRead, useMyNotifications } from '../../hooks/index.ts'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import { timeAgo } from '../../lib/timeAgo.ts'
import { AccountSection } from './AccountSection.tsx'

export interface Todo {
  id: string
  title: string
  detail?: string
  to: string
}

// What the athlete still has to do, worked out from their own account
export function todosOf({ profile, year }: AthleteData): Todo[] {
  const todos: Todo[] = []
  if (!profile.request && profile.memberYear !== year) todos.push({ id: 'pay', title: `Pay your ${year} membership`, to: '/athlete/membership' })
  if (profile.request?.rejectedReason) todos.push({ id: 'resend', title: 'Send your membership payment again', detail: profile.request.rejectedReason, to: '/athlete/membership' })
  if (!profile.birthDate || !profile.phone) {
    todos.push({ id: 'details', title: 'Finish your details', detail: 'The secretariat needs your date of birth and contact number for entries.', to: '/athlete/edit' })
  }
  return todos
}

// What the system told the athlete, newest first, and what is still left for them to do
export function Notifications({ todos }: { todos: Todo[] }) {
  const notes = useMyNotifications()
  const mark = useMarkNotificationsRead()
  const list = notes.data ?? []
  const unread = list.filter((n) => n.readAt === null).length
  const { page: current, setPage, pageSize, total, pageItems } = usePagination(list, 'notifications')

  return (
    <div className="flex flex-col gap-12">
      {todos.length > 0 && (
        <AccountSection title="To do">
          <ul aria-label="To do" className="border-b border-neutral-200">
            {todos.map((t) => (
              <li key={t.id} className="border-t border-neutral-200">
                <Link to={t.to} className="group flex items-start gap-4 py-4 transition-colors hover:bg-gold-50 sm:px-3">
                  <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-gold-400" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-semibold text-neutral-900">{t.title}</span>
                    {t.detail && <span className="text-small text-neutral-600">{t.detail}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </AccountSection>
      )}

      <AccountSection title="Notifications" note="Decisions from the secretariat about your payments and changes. New ones appear here as they happen.">
        {unread > 0 && (
          <div>
            <Button variant="secondary" size="sm" disabled={mark.isPending} onClick={() => mark.mutate(undefined)}>
              Mark all as read
            </Button>
          </div>
        )}

        {notes.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : list.length === 0 ? (
          <EmptyState title="Nothing yet" description="When the secretariat confirms a payment or decides on a change, you will see it here and hear a chime." />
        ) : (
          <ul aria-label="Notifications" className="border-b border-neutral-200">
            {pageItems.map((n) => {
              const body = (
                <>
                  <span aria-hidden className={cn('mt-2 size-2 shrink-0 rounded-full', n.readAt === null ? 'bg-gold-400' : 'bg-neutral-200')} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn('text-neutral-900', n.readAt === null ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                    {n.detail && <span className="text-small text-neutral-600">{n.detail}</span>}
                  </span>
                  <span className="shrink-0 font-mono text-xs uppercase tabular-nums text-neutral-500">{timeAgo(n.createdAt)}</span>
                </>
              )
              const open = () => n.readAt === null && mark.mutate([n.id])
              return (
                <li key={n.id} className="border-t border-neutral-200">
                  {n.link ? (
                    <Link to={n.link} onClick={open} className="flex items-start gap-4 py-4 transition-colors hover:bg-gold-50 sm:px-3">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-4 py-4 sm:px-3">{body}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {!notes.isLoading && total > pageSize && <Pagination page={current} pageSize={pageSize} total={total} onPageChange={setPage} label="Notifications pagination" />}
      </AccountSection>
    </div>
  )
}
