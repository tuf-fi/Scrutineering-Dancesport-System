import type { RoundRow } from '@bis/shared'
import { Select } from '../../components/ui/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'

// Picks which round a screen shows
export function RoundSelect({
  rounds,
  value,
  onChange,
}: {
  rounds: RoundRow[]
  value: string
  onChange: (roundId: string) => void
}) {
  return (
    <div className="w-full sm:w-80">
      <Select label="Round" value={value} onChange={(e) => onChange(e.target.value)} disabled={rounds.length === 0}>
        {[...rounds]
          .sort((a, b) => a.eventNumber - b.eventNumber)
          .map((r) => (
            <option key={r.roundId} value={r.roundId}>
              {eventCode({ number: r.eventNumber })} {eventDances(r)} · {ROUND_TYPE_LABEL[r.type]}
            </option>
          ))}
      </Select>
    </div>
  )
}
