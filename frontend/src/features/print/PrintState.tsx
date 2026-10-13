import { ErrorState, Skeleton } from '../../components/ui/index.ts'
import { usePrintContext } from './usePrintContext.ts'

type Context = ReturnType<typeof usePrintContext>
export type ReadyContext = Context & { event: NonNullable<Context['event']>; competition: NonNullable<Context['competition']> }

// Shows a skeleton or an error until the sheet's data is there, then hands the ready data to its children
export function PrintState({
  ctx,
  failed,
  onRetry,
  children,
}: {
  ctx: Context
  // A query the sheet needs beyond the event itself failed
  failed?: boolean
  onRetry?: () => void
  children: (ready: ReadyContext) => React.ReactNode
}) {
  if (ctx.isError || failed) {
    return (
      <ErrorState
        onRetry={() => {
          ctx.retry()
          onRetry?.()
        }}
      />
    )
  }
  if (ctx.isLoading || !ctx.event || !ctx.competition) return <Skeleton className="h-96 w-full" />
  return <>{children(ctx as ReadyContext)}</>
}
