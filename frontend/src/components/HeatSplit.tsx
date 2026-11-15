import { cn } from '../lib/cn.ts'

// How many couples dance in each heat: a label over each number, with a thin rule between heats. Nothing for one heat or none yet.
export function HeatSplit({ heats, className }: { heats: number[]; className?: string }) {
  if (heats.length < 2) return null
  return (
    <ul aria-label="Couples in each heat" className={cn('mt-1 flex flex-wrap justify-center', className)}>
      {heats.map((count, i) => (
        <li key={i} className="flex flex-col items-center border-l border-neutral-300 px-2 first:border-l-0">
          <span className="text-[0.65em] uppercase leading-tight tracking-wide text-neutral-500">Heat {i + 1}</span>
          <span className="font-mono tabular-nums leading-tight text-neutral-900">{count}</span>
        </li>
      ))}
    </ul>
  )
}
