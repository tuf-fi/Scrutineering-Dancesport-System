import { Button } from './Button.tsx'
import { EmptyState } from './EmptyState.tsx'

// Shown when a query fails; offers a retry
export function ErrorState({ onRetry, title = "Couldn't load this" }: { onRetry: () => void; title?: string }) {
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
