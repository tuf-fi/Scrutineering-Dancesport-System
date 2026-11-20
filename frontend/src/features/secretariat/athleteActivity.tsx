import { ListChecks, Medal, Trophy } from 'lucide-react'
import { CompetitorEntries, CompetitorRankings, CompetitorResults } from '../../components/CompetitorActivity.tsx'

export const ACTIVITY = [
  { id: 'entries', label: 'Entries', icon: ListChecks, render: (id: string) => <CompetitorEntries competitorId={id} /> },
  { id: 'results', label: 'Results', icon: Trophy, render: (id: string) => <CompetitorResults competitorId={id} /> },
  { id: 'rankings', label: 'Rankings', icon: Medal, render: (id: string) => <CompetitorRankings competitorId={id} /> },
]
