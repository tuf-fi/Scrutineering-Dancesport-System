import { useNavigate } from 'react-router'
import { Button, EmptyState } from '../components/ui/index.ts'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <main className="mx-auto max-w-xl px-4 py-24">
      <EmptyState
        title="Page not found"
        description="That address doesn't match a screen."
        action={
          <Button variant="secondary" onClick={() => navigate('/')}>
            Go to the home page
          </Button>
        }
      />
    </main>
  )
}
