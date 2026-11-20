import { Check } from 'lucide-react'

// The count of marks at this place or better, ticked where the place was decided
export function MajorityCell({ counts, tick, column }: { counts: number[]; tick: number | null; column: number }) {
  const ticked = tick === column
  // The tick hangs beside the number so every count stays centred under its header
  return (
    <span className={ticked ? 'relative inline-block font-semibold text-neutral-900' : undefined}>
      {counts[column - 1] ?? ''}
      {ticked && <Check aria-label="Place decided here" className="absolute left-full top-1/2 ml-1 size-4 -translate-y-1/2 text-success" strokeWidth={2.5} />}
    </span>
  )
}
