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
  if (!state.data) return <Skeleton className="h-40 w-full" />
  if (!pending && state.data.status === 'waiting') return <Navigate to="/adjudicator/waiting" replace />
  if (!pending && state.data.status === 'marking') return <Navigate to="/adjudicator/mark" replace />

  const task = state.data.status === 'waiting' ? null : state.data.task

  return (
    <div className="flex flex-1 flex-col gap-10">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <span
          aria-hidden
          className={`grid size-20 place-items-center rounded-full ${pending ? 'bg-warning/10 text-warning' : 'bg-success-soft text-success'}`}
        >
          <Check className="size-10" strokeWidth={2.25} />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-display font-semibold text-neutral-900">{pending ? 'Saved, sending…' : 'Submitted'}</h1>
          {task && (
            <p className="text-small text-neutral-500">
              <span className="font-mono">{eventCode(task.event)}</span> {eventDances(task.event)} · {ROUND_TYPE_LABEL[task.round.type]}
            </p>
          )}
        </div>
        <p role="status" className="max-w-xs text-body text-neutral-600">
          {pending
            ? online
              ? 'Sending your marks to the scrutineer.'
              : 'No connection. Your marks are saved on this phone and go out when the Wi-Fi is back.'
            : 'Your marks are with the scrutineer. This screen changes when the next round starts.'}
        </p>
      </div>
      <DemoControls />
    </div>
  )
}
