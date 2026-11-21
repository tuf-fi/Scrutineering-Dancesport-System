import { ListChecks, Medal, Trophy } from 'lucide-react'
import { CompetitorEntries, CompetitorRankings, CompetitorResults } from '../../components/CompetitorActivity.tsx'
import { EntryPayments } from './EntryPayments.tsx'

export const ACTIVITY = [
  {
    id: 'entries',
    label: 'Entries',
    icon: ListChecks,
    render: (id: string) => (
      <>
        <EntryPayments competitorId={id} />
        <CompetitorEntries competitorId={id} />
      </>
    ),
  },
  { id: 'results', label: 'Results', icon: Trophy, render: (id: string) => <CompetitorResults competitorId={id} /> },
  { id: 'rankings', label: 'Rankings', icon: Medal, render: (id: string) => <CompetitorRankings competitorId={id} /> },
]
