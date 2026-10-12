import type { MarkingCompetitor } from '@bis/shared'
import { cn } from '../../lib/cn.ts'
import { tileOff, tileOn } from './tile.ts'

interface XBoardProps {
  competitors: MarkingCompetitor[]
  selected: string[]
  onToggle: (id: string) => void
}

// Back numbers to tap: a tap marks an X, a second tap takes it off. Grouped by heat when there are several.
export function XBoard({ competitors, selected, onToggle }: XBoardProps) {
  const heats = [...new Set(competitors.map((c) => c.heat))]
  const grouped = heats.length > 1 && heats.every((h) => h !== null)

  const grid = (list: MarkingCompetitor[]) => (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
      {list.map((c) => {
        const on = selected.includes(c.id)
        return (
          <li key={c.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(c.id)}
              className={cn(
                'flex h-16 w-full items-center justify-between rounded-xl border pl-3.5 pr-2.5 transition-colors',
                on ? tileOn : tileOff,
              )}
            >
              <span className="font-mono text-xl font-medium tabular-nums">{c.backNumber ?? '–'}</span>
              {/* The X box, like the column on a paper sheet: empty until marked */}
              <span
                aria-hidden
                className={cn(
                  'grid size-9 place-items-center rounded-lg border text-xl font-bold leading-none transition-colors',
                  on ? 'border-gold-400 bg-gold-400 text-black' : 'border-neutral-300 text-transparent',
                )}
              >
                X
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  if (!grouped) return grid(competitors)
  return (
    <div className="flex flex-col gap-6">
      {heats.map((heat) => (
        <section key={heat} className="flex flex-col gap-3">
          <h3 className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
            Heat {heat}
            <span aria-hidden className="h-px flex-1 bg-neutral-200" />
          </h3>
          {grid(competitors.filter((c) => c.heat === heat))}
        </section>
      ))}
    </div>
  )
}
