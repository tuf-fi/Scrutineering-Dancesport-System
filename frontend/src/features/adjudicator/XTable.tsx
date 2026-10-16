import type { Dance, MarkingCompetitor } from '@bis/shared'
import { cn } from '../../lib/cn.ts'
import { DANCE_LABEL } from '../../lib/format.ts'

interface XTableProps {
  competitors: MarkingCompetitor[]
  dances: Dance[]
  // The back numbers marked so far, per dance
  answers: Partial<Record<Dance, string[]>>
  // How many X a dance needs
  total: number
  onToggle: (dance: Dance, id: string) => void
}

// The paper sheet on a phone: a row for each back number and a column for each dance. Tap a cell to put an X in it,
// tap again to take it out. Grouped by heat when there are several.
export function XTable({ competitors, dances, answers, total, onToggle }: XTableProps) {
  const heats = [...new Set(competitors.map((c) => c.heat))]
  const grouped = heats.length > 1 && heats.every((h) => h !== null)
  const groups = grouped ? heats.map((heat) => ({ heat, rows: competitors.filter((c) => c.heat === heat) })) : [{ heat: null, rows: competitors }]
  const countOf = (d: Dance) => answers[d]?.length ?? 0

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b border-neutral-200">
          <th scope="col" className="w-20 py-3 pl-1 text-left text-small font-medium text-neutral-500">
            No.
          </th>
          {dances.map((d) => (
            <th key={d} scope="col" className="px-1 py-3 text-center align-bottom">
              <span className="block text-small font-semibold leading-tight text-neutral-900">{DANCE_LABEL[d]}</span>
              <span className={cn('mt-1 block font-mono text-xs font-medium tabular-nums', countOf(d) > total ? 'text-danger' : countOf(d) === total ? 'text-success' : 'text-neutral-500')}>
                {countOf(d)}/{total}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      {groups.map(({ heat, rows }) => (
        <tbody key={String(heat)}>
          {heat !== null && (
            <tr>
              <th scope="colgroup" colSpan={dances.length + 1} className="pb-1 pl-1 pt-6 text-left text-small font-semibold text-neutral-900">
                Heat {heat}
              </th>
            </tr>
          )}
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-neutral-100">
              <th scope="row" className="py-1 pl-1 text-left font-mono text-2xl font-medium tabular-nums text-neutral-900">
                {c.backNumber ?? '–'}
              </th>
              {dances.map((d) => {
                const on = answers[d]?.includes(c.id) ?? false
                return (
                  <td key={d} className="p-1 text-center">
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={`X for ${c.backNumber ?? 'unnumbered'}, ${DANCE_LABEL[d]}`}
                      onClick={() => onToggle(d, c.id)}
                      className="group grid h-14 w-full place-items-center rounded-xl transition-colors active:bg-neutral-100"
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'grid size-11 place-items-center rounded-xl border text-xl font-bold leading-none transition-colors',
                          on ? 'border-neutral-900 bg-neutral-900 text-gold-400' : 'border-neutral-200 text-transparent group-hover:border-neutral-300',
                        )}
                      >
                        X
                      </span>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}
