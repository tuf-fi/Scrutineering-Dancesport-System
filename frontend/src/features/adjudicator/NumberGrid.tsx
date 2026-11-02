import type { MarkingCompetitor } from '@bis/shared'
import { cn } from '../../lib/cn.ts'

interface NumberGridProps {
  competitors: MarkingCompetitor[]
  // The competitors chosen so far, for the dance on screen
  selected: string[]
  // Everything that is still free is locked: the number needed has been chosen. A chosen one can still be taken out.
  locked: boolean
  onToggle: (id: string) => void
}

// The back numbers as a grid of cells, four to a row. Tap a number to choose it, tap again to take it out. Grouped by
// heat when there are several.
export function NumberGrid({ competitors, selected, locked, onToggle }: NumberGridProps) {
  const heats = [...new Set(competitors.map((c) => c.heat))]
  const grouped = heats.length > 1 && heats.every((h) => h !== null)
  const groups = grouped ? heats.map((heat) => ({ heat, rows: competitors.filter((c) => c.heat === heat) })) : [{ heat: null, rows: competitors }]

  return (
    <div className="flex flex-col gap-6">
      {groups.map(({ heat, rows }) => (
        <section key={String(heat)} aria-label={heat === null ? undefined : `Heat ${heat}`} className="flex flex-col gap-3">
          {heat !== null && (
            <div className="flex items-baseline justify-between gap-4 border-b border-neutral-200 pb-2">
              <h2 className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-neutral-900">Heat {heat}</h2>
              <span aria-hidden className="font-mono text-xs tabular-nums text-neutral-500">
                {rows.filter((c) => selected.includes(c.id)).length} chosen
              </span>
            </div>
          )}
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {rows.map((c) => {
              const on = selected.includes(c.id)
              return (
                <li key={c.id} className="contents">
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={!on && locked}
                    aria-label={`Select ${c.backNumber ?? 'unnumbered'}`}
                    onClick={() => onToggle(c.id)}
                    className={cn(
                      'grid h-16 place-items-center border font-mono text-2xl font-semibold tabular-nums transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97]',
                      on
                        ? 'border-gold-400 bg-gold-400 text-black'
                        : locked
                          ? 'cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-300'
                          : 'border-neutral-200 bg-white text-neutral-900 active:bg-neutral-50',
                    )}
                  >
                    {c.backNumber === null ? '–' : String(c.backNumber).padStart(3, '0')}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
