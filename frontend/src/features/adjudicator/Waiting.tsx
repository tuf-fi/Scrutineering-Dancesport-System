import { Navigate } from 'react-router'
import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { DemoControls } from './DemoControls.tsx'
import { useFloor } from './useFloor.ts'

// Sits here until the scrutineer puts a round on the floor, then moves to the marking screen by itself
export function Waiting() {
  const { state, pending } = useFloor()

  if (state.isError) return <ErrorState onRetry={() => void state.refetch()} />
  if (!state.data) return <Skeleton className="h-24 w-full max-w-xl" />
  if (pending || state.data.status === 'submitted') return <Navigate to="/adjudicator/submitted" replace />
  if (state.data.status === 'marking') return <Navigate to="/adjudicator/mark" replace />

  return (
    <div className="flex flex-1 flex-col gap-10">
      <div className="flex flex-1 flex-col justify-center gap-5">
        <span className="inline-flex w-fit items-center gap-2 text-small text-neutral-600">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-gold-400" />
          Standing by
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="max-w-2xl text-display font-semibold text-neutral-900">Waiting for the next round</h1>
          <p className="max-w-prose text-body text-neutral-600">
            The scrutineer will start it. This screen changes by itself when your marks are needed.
          </p>
        </div>
      </div>
      <DemoControls />
    </div>
  )
}
