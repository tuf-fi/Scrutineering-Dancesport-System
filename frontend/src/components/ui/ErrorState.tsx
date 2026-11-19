import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/http.ts'
import { Button } from './Button.tsx'
import { EmptyState } from './EmptyState.tsx'

// The server answered that there is nothing to show (not found, not published yet, not started): the connection is fine,
// so this is an empty page, not a failure
const NOTHING_TO_SHOW = [403, 404, 409]

// Shown when a query fails; offers a retry. When every failed query on the page only means there is no data, it says
// so instead.
export function ErrorState({ onRetry, title = "Couldn't load this", tone = 'light' }: { onRetry: () => void; title?: string; tone?: 'light' | 'dark' }) {
  const client = useQueryClient()
  const failed = client.getQueryCache().findAll({ predicate: (q) => q.state.status === 'error' && q.getObserversCount() > 0 })
  if (failed.length > 0 && failed.every((q) => q.state.error instanceof ApiError && NOTHING_TO_SHOW.includes(q.state.error.status))) {
    return <EmptyState tone={tone} title="No data available" description="There is nothing to show here yet." />
  }
  return (
    <EmptyState
      tone={tone}
      title={title}
      description="Check the connection and try again."
      action={
        tone === 'dark' ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-[1vmin] border border-white/30 px-[3.2vmin] py-[1.4vmin] text-[2.2vmin] font-medium text-white transition-colors hover:border-white/60 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
          >
            Try again
          </button>
        ) : (
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        )
      }
    />
  )
}
