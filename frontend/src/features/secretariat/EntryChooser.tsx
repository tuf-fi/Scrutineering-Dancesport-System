import type { CompetitorRow } from '@bis/shared'
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
      <ul className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200">
        {entries.map((entry) => (
          <li key={entry.id}>
            <button type="button" onClick={() => onChoose(entry)} className="flex w-full items-baseline justify-between gap-4 py-3 text-left text-small hover:bg-neutral-50">
              <span className="font-medium text-neutral-900">{athlete ? entryLabel(entry, athlete, plain) : competitorName(entry.names)}</span>
              <span className="font-mono tabular-nums text-neutral-600">{entry.backNumber === null ? 'No number' : `No. ${entry.backNumber}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
