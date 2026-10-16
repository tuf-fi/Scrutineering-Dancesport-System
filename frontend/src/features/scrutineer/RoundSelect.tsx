import type { RoundRow } from '@bis/shared'
import { ChevronDown } from 'lucide-react'
import { Select } from '../../components/ui/index.ts'
import { ROUND_TYPE_LABEL, eventCode, eventDances } from '../../lib/format.ts'

// Picks which round a screen shows
export function RoundSelect({
  rounds,
  value,
  onChange,
  inline = false,
}: {
  rounds: RoundRow[]
  value: string
  onChange: (roundId: string) => void
  // Borderless and light-on-dark, for the header of a dark panel
  inline?: boolean
}) {
  const options = [...rounds]
    .sort((a, b) => a.eventNumber - b.eventNumber)
    .map((r) => (
      <option key={r.roundId} value={r.roundId} className="text-neutral-900">
        {eventCode({ number: r.eventNumber })} {eventDances(r)} · {ROUND_TYPE_LABEL[r.type]}
      </option>
    ))
  if (inline) {
    return (
      <div className="relative min-w-0 max-w-full">
        <select
          aria-label="Round"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={rounds.length === 0}
          className="h-9 w-full max-w-full cursor-pointer appearance-none truncate rounded-lg border border-white/25 bg-white/5 py-0 pl-3 pr-9 text-small text-white transition-colors hover:border-white/50 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400"
        >
          {options}
        </select>
        <ChevronDown aria-hidden size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brown-100" />
      </div>
    )
  }
  return (
    <div className="w-full sm:w-80">
      <Select label="Round" value={value} onChange={(e) => onChange(e.target.value)} disabled={rounds.length === 0}>
        {options}
      </Select>
    </div>
  )
}
