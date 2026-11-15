import type { CompetitorRow } from '@bis/shared'
import { ListChecks, Medal, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { CompetitorEntries, CompetitorRankings, CompetitorResults } from '../../components/CompetitorActivity.tsx'
import { Button } from '../../components/ui/index.ts'
import { competitorName } from '../../lib/format.ts'
import { CompetitorFacts } from './CompetitorFacts.tsx'

// Who an entry is for, besides the athlete: alone, or with their partner
export const entryLabel = (entry: CompetitorRow, athlete: string, plain: (name: string) => string) => {
  const partner = entry.names.find((n) => plain(n) !== plain(athlete))
  return partner ? `With ${partner}` : 'Solo'
}

export interface EntryActions {
  onEnter: (entry: CompetitorRow) => void
  onNumber: (entry: CompetitorRow) => void
  onEdit: (entry: CompetitorRow) => void
  onDelete: (entry: CompetitorRow) => void
  onAddDetails: () => void
}

// In the athlete's side panel: each entry the athlete dances in, with what can be done to it
export function AthleteEntries({ athlete, entries, plain, actions }: { athlete: string; entries: CompetitorRow[]; plain: (name: string) => string; actions: EntryActions }) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-small text-neutral-600">No entry details yet. They are needed before this athlete can be entered in events.</p>
        <Button variant="secondary" size="sm" onClick={actions.onAddDetails}>
          Add entry details
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6">
      {entries.map((entry) => (
        <section key={entry.id} aria-label={`Entry: ${competitorName(entry.names)}`} className="flex flex-col gap-3 border-t border-neutral-200 pt-4 first:border-t-0 first:pt-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-small font-semibold text-neutral-900">{entryLabel(entry, athlete, plain)}</h3>
            <span className="font-mono text-small tabular-nums text-neutral-600">{entry.backNumber === null ? 'No back number' : `No. ${entry.backNumber}`}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => actions.onEnter(entry)}>
              Enter in events
            </Button>
            <Button variant="secondary" size="sm" onClick={() => actions.onNumber(entry)}>
              Set back number
            </Button>
            <Button variant="secondary" size="sm" onClick={() => actions.onEdit(entry)}>
              Edit entry
            </Button>
            <Button variant="ghost" size="sm" onClick={() => actions.onDelete(entry)}>
              Delete entry
            </Button>
          </div>
          <CompetitorFacts competitor={entry} />
        </section>
      ))}
    </div>
  )
}

// One part of the panel (Entries, Results or Rankings) for every entry of the athlete
export function ActivityOf({ athlete, entries, plain, render }: { athlete: string; entries: CompetitorRow[]; plain: (name: string) => string; render: (competitorId: string) => ReactNode }) {
  if (entries.length === 0) return <p className="text-small text-neutral-600">Nothing yet.</p>
  return (
    <div className="flex flex-col gap-6">
      {entries.map((entry) => (
        <div key={entry.id} className="flex flex-col gap-2">
          {entries.length > 1 && <h3 className="text-small font-semibold text-neutral-900">{entryLabel(entry, athlete, plain)}</h3>}
          {render(entry.id)}
        </div>
      ))}
    </div>
  )
}

export const ACTIVITY = [
  { id: 'entries', label: 'Entries', icon: ListChecks, render: (id: string) => <CompetitorEntries competitorId={id} /> },
  { id: 'results', label: 'Results', icon: Trophy, render: (id: string) => <CompetitorResults competitorId={id} /> },
  { id: 'rankings', label: 'Rankings', icon: Medal, render: (id: string) => <CompetitorRankings competitorId={id} /> },
]
