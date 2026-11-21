import type { CompetitorRow } from '@bis/shared'
import { ArrowRight } from 'lucide-react'
import { Dialog } from '../../components/ui/index.ts'
import { competitorName } from '../../lib/format.ts'
import { entryLabel } from './entryLabel.ts'

// An athlete who dances in more than one entry is asked which one before something is done to it
export function EntryChooser({
  athlete,
  entries,
  plain,
  onChoose,
  onClose,
}: {
  athlete: string | null
  entries: CompetitorRow[]
  plain: (name: string) => string
  onChoose: (entry: CompetitorRow) => void
  onClose: () => void
}) {
  return (
    <Dialog open={athlete !== null} onClose={onClose} title="Which entry?" description={athlete ? `${athlete} dances in more than one entry.` : undefined} className="max-w-md">
      <ul className="flex flex-col divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onChoose(entry)}
              className="group flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-500"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body font-semibold text-neutral-900">{athlete ? entryLabel(entry, athlete, plain) : competitorName(entry.names)}</span>
                <span className="truncate text-small text-neutral-600">{entry.teamName}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-small tabular-nums text-gold-700">{entry.backNumber === null ? 'No number' : `No. ${entry.backNumber}`}</span>
                <ArrowRight aria-hidden className="size-4 text-neutral-400 transition-all group-hover:-rotate-45 group-hover:text-gold-600" />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
