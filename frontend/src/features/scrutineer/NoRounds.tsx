import { Link } from 'react-router'
import { EmptyState, PageHeader } from '../../components/ui/index.ts'

// Shown on a round screen while the competition has no rounds to show, so it never waits on a round that cannot come
export function NoRounds({ title, description, canPlan }: { title: string; description: string; canPlan: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        title="No rounds to show yet"
        description={
          canPlan
            ? 'The rounds of this competition have not been planned. On Rounds, press Plan rounds, and they will appear here.'
            : 'The scrutineer has not planned the rounds of this competition yet. They will appear here once they have.'
        }
        action={
          canPlan ? (
            <Link to="/scrutineer" className="text-small font-semibold text-neutral-900 underline decoration-gold-500 decoration-2 underline-offset-4">
              Go to Rounds
            </Link>
          ) : undefined
        }
      />
    </div>
  )
}
