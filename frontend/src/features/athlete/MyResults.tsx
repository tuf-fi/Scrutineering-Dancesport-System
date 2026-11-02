import { ResultsByCompetition } from '../../components/ResultsByCompetition.tsx'
import { useMyActivity } from '../../hooks/index.ts'
import { AccountSection } from './AccountSection.tsx'

// Every placing of the competitors that carry the athlete's name, straight from the results
export function MyResults({ title = 'My results', note = 'Your placings from approved results, found by your name. Open a competition to see them.', empty = { title: 'No results yet', description: 'Your placings appear here after a competition where you danced is published.' } }: { title?: string; note?: string; empty?: { title: string; description: string } }) {
  const activity = useMyActivity()

  return (
    <AccountSection title={title} note={note}>
      <ResultsByCompetition
        lines={activity.data?.results ?? []}
        loading={activity.isLoading}
        label={title}
        empty={empty}
      />
    </AccountSection>
  )
}
