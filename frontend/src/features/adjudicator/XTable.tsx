import type { Dance, MarkingCompetitor } from '@bis/shared'
import { X } from 'lucide-react'
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

// The paper sheet: a row for each back number and a column for each dance. Tap a cell to put an X in it, tap again
// to take it out. One dance flows its rows into several columns so there is less to scroll. Grouped by heat when
// there are several.
export function XTable({ competitors, dances, answers, total, onToggle }: XTableProps) {
  const heats = [...new Set(competitors.map((c) => c.heat))]
  const grouped = heats.length > 1 && heats.every((h) => h !== null)
  const groups = grouped
    ? heats.map((heat) => ({ heat, rows: competitors.filter((c) => c.heat === heat) }))
    : [{ heat: null, rows: competitors }]
  const countOf = (d: Dance) => answers[d]?.length ?? 0
  const box = (on: boolean) =>
    cn(
      'grid size-9 place-items-center rounded-md border transition-[background-color,border-color,transform] duration-150 ease-out group-active:scale-95',
      on
        ? 'border-neutral-900 bg-neutral-900 text-gold-400'
        : 'border-neutral-200 bg-white text-neutral-300 group-hover:border-neutral-300',
    )

  if (dances.length === 1) {
    const d = dances[0]
    return (
      <div className="flex flex-col gap-6">
        {groups.map(({ heat, rows }) => (
          <section key={String(heat)} aria-label={heat === null ? undefined : `Heat ${heat}`}>
            {heat !== null && <h2 className="border-b border-neutral-200 pb-3 text-small font-semibold text-neutral-900">Heat {heat}</h2>}
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-x-8 md:grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] md:gap-x-12 lg:gap-x-20">
              {rows.map((c) => {
                const on = answers[d]?.includes(c.id) ?? false
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={!on && countOf(d) >= total}
                      aria-label={`X for ${c.backNumber ?? 'unnumbered'}, ${DANCE_LABEL[d]}`}
                      onClick={() => onToggle(d, c.id)}
                      className="group flex h-14 w-full items-center justify-between border-b border-neutral-100 px-1 transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <span className="font-mono text-2xl font-medium tabular-nums tracking-tight text-neutral-900">
                        {c.backNumber ?? '–'}
                      </span>
                      <span aria-hidden className={box(on)}>
                        <X className={cn('size-4 transition-opacity duration-150', on ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} />
                      </span>
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
              <span
                className={cn(
                  'mt-1 block font-mono text-xs font-medium tabular-nums',
                  countOf(d) > total ? 'text-danger' : countOf(d) === total ? 'text-success' : 'text-neutral-500',
                )}
              >
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
              <th
                scope="colgroup"
                colSpan={dances.length + 1}
                className="border-b border-neutral-200 pb-3 pl-1 pt-5 text-left text-small font-semibold text-neutral-900"
              >
                Heat {heat}
              </th>
            </tr>
          )}
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-neutral-100">
              <th scope="row" className="py-0 pl-1 text-left font-mono text-2xl font-medium tabular-nums tracking-tight text-neutral-900">
                {c.backNumber ?? '–'}
              </th>
              {dances.map((d) => {
                const on = answers[d]?.includes(c.id) ?? false
                return (
                  <td key={d} className="p-0 text-center">
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={!on && countOf(d) >= total}
                      aria-label={`X for ${c.backNumber ?? 'unnumbered'}, ${DANCE_LABEL[d]}`}
                      onClick={() => onToggle(d, c.id)}
                      className="group grid h-14 w-full place-items-center transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <span aria-hidden className={box(on)}>
                        <X className={cn('size-4 transition-opacity duration-150', on ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} />
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
