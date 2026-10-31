import { Check } from 'lucide-react'
import { Navigate } from 'react-router'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'
import { useConnection } from '../../stores/connection.ts'
import { DemoControls } from './DemoControls.tsx'
import { useFloor } from './useFloor.ts'

// The confirmation after submitting. While the phone is offline the marks are only saved here, so it says so.
export function SubmittedPage() {
  const { state, pending } = useFloor()
  const online = useConnection((s) => s.online)

  if (state.isError) return <ErrorState onRetry={() => void state.refetch()} />
  if (!state.data) return <Skeleton className="mx-auto h-48 w-full max-w-sm" />
  if (!pending && state.data.status === 'waiting') return <Navigate to="/adjudicator/waiting" replace />
  if (!pending && state.data.status === 'marking') return <Navigate to="/adjudicator/mark" replace />

  const task = state.data.status === 'waiting' ? null : state.data.task

  return (
    <div className="flex flex-1 flex-col gap-10">
      <div className="flex flex-1 flex-col items-center justify-center pb-10 text-center">
        <span
          aria-hidden
          className={`grid size-16 animate-pop-in place-items-center rounded-full ring-8 ${pending ? 'bg-warning-soft text-warning ring-warning-soft/50' : 'bg-success-soft text-success ring-success-soft/50'}`}
        >
          <Check className="size-7" strokeWidth={2.5} />
        </span>
        <h1 className="mt-8 animate-rise-in text-display font-semibold text-neutral-900 [animation-delay:80ms]">
          {pending ? 'Saved, sending…' : 'Submitted'}
        </h1>
        {task && (
          <p className="mt-2 animate-rise-in text-small text-neutral-500 [animation-delay:140ms]">
            <span className="font-mono text-neutral-900">{eventCode(task.event)}</span>
            <span className="mx-2 text-neutral-300">/</span>
            {eventDances(task.event)}
            <span className="mx-2 text-neutral-300">/</span>
            {ROUND_TYPE_LABEL[task.round.type]}
          </p>
        )}
        <p role="status" className="mt-6 max-w-xs animate-rise-in text-body text-neutral-500 [animation-delay:200ms]">
          {pending
            ? online
              ? 'Sending your marks to the scrutineer.'
              : 'No connection. Your marks are saved on this phone and go out when your connection is back.'
            : 'Your marks are with the scrutineer. This screen changes when the next round starts.'}
        </p>
      </div>
      <DemoControls />
    </div>
  )
}
