import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn.ts'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  // Names this pager for screen readers when a page has more than one
  label?: string
  // Hide the "Showing" line when it is rendered by <Showing> inside the table
  showSummary?: boolean
  className?: string
}

// 1 2 3 … 9 10, always including the first and last page and the pages around the current one
function pageList(page: number, pages: number): Array<number | 'gap-start' | 'gap-end'> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const start = Math.max(2, page - 1)
  const end = Math.min(pages - 1, page + 1)
  const out: Array<number | 'gap-start' | 'gap-end'> = [1]
  if (start > 2) out.push('gap-start')
  for (let p = start; p <= end; p++) out.push(p)
  if (end < pages - 1) out.push('gap-end')
  out.push(pages)
  return out
}

const circle = 'grid size-8 place-items-center rounded-full text-small tabular-nums transition-colors'

const arrow = cn(
  circle,
  'border border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900',
  'disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-neutral-200 disabled:hover:bg-transparent disabled:hover:text-neutral-600',
)

// Which rows are showing, centred in a footer row inside the table box
export function Showing({ page, pageSize, total }: Pick<PaginationProps, 'page' | 'pageSize' | 'total'>) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <p className="border-t border-neutral-200 bg-neutral-50/60 px-4 py-3 text-center text-xs text-neutral-500">
      Showing <span className="font-medium tabular-nums text-neutral-900">{from}–{to}</span> of{' '}
      <span className="font-medium tabular-nums text-neutral-900">{total}</span>
    </p>
  )
}

// The pager, centred under the table; it also says which rows are showing unless <Showing> already does
export function Pagination({ page, pageSize, total, onPageChange, label = 'Pagination', showSummary = true, className }: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <nav
      aria-label={label}
      className={cn(
        'flex flex-col items-center gap-3',
        className,
      )}
    >
      {showSummary && (
        <p className="text-small text-neutral-500">
          Showing <span className="font-medium tabular-nums text-neutral-900">{total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)}</span> of{' '}
          <span className="font-medium tabular-nums text-neutral-900">{total}</span>
        </p>
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={arrow}
        >
          <ChevronLeft aria-hidden className="size-4" strokeWidth={1.75} />
        </button>

        <span className="px-3 text-small text-neutral-500 sm:hidden">
          Page <span className="font-medium tabular-nums text-neutral-900">{page}</span> of{' '}
          <span className="font-medium tabular-nums text-neutral-900">{pages}</span>
        </span>

        <ol className="mx-1.5 hidden items-center gap-1 sm:flex">
          {pageList(page, pages).map((item) =>
            typeof item === 'number' ? (
              <li key={item}>
                <button
                  type="button"
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => onPageChange(item)}
                  className={cn(
                    circle,
                    item === page
                      ? 'bg-neutral-900 font-medium text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  )}
                >
                  {item}
                </button>
              </li>
            ) : (
              <li key={item} aria-hidden className="grid size-8 place-items-center text-small text-neutral-400">
                …
              </li>
            ),
          )}
        </ol>

        <button
          type="button"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className={arrow}
        >
          <ChevronRight aria-hidden className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  )
}
