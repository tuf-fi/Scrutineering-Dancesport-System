import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/http.ts'
import { Button } from './Button.tsx'
import { EmptyState } from './EmptyState.tsx'

// The server answered that there is nothing to show (not found, not published yet, not started): the connection is fine,
// so this is an empty page, not a failure
const NOTHING_TO_SHOW = [403, 404, 409]

// Shown when a query fails; offers a retry. When every failed query on the page only means there is no data, it says
// so instead.
export function ErrorState({ onRetry, title = "Couldn't load this" }: { onRetry: () => void; title?: string }) {
  const client = useQueryClient()
  const failed = client.getQueryCache().findAll({ predicate: (q) => q.state.status === 'error' && q.getObserversCount() > 0 })
  if (failed.length > 0 && failed.every((q) => q.state.error instanceof ApiError && NOTHING_TO_SHOW.includes(q.state.error.status))) {
    return <EmptyState title="No data available" description="There is nothing to show here yet." />
  }
  return (
    <EmptyState
      title={title}
      description="Check the connection and try again."
      action={
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  )
}
