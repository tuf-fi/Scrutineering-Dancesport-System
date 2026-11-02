import { EntriesByCompetition } from '../../components/EntriesByCompetition.tsx'
import { useMyActivity } from '../../hooks/index.ts'
import { AccountSection } from './AccountSection.tsx'

// The events the athlete is entered in, as the secretariat has them
export function MyEntries({ title = 'My entries', note = 'Every event you are entered in, found by your name. Open a competition to see them.', empty = { title: 'No entries yet', description: 'Entries appear here once your club or the secretariat enters you in an event.' } }: { title?: string; note?: string; empty?: { title: string; description: string } }) {
  const activity = useMyActivity()

  return (
    <AccountSection title={title} note={note}>
      <EntriesByCompetition
        entries={activity.data?.entries ?? []}
        loading={activity.isLoading}
        label={title}
        empty={empty}
      />
    </AccountSection>
  )
}
