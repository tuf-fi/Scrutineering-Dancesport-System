import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import { Dialog } from './Dialog.tsx'
import { EmptyState } from './EmptyState.tsx'
import { Pagination, Showing } from './Pagination.tsx'
import { Skeleton } from './Skeleton.tsx'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  // Numbers (back numbers, counts, placings) use the mono face so columns line up
  mono?: boolean
  // Quieter secondary text, for supporting columns
  muted?: boolean
  // Hides the column on screens narrower than this breakpoint
  hideBelow?: 'sm' | 'md'
  // Fixed width class for narrow columns such as a rank
  widthClass?: string
  // In the row detail modal: leave out a column that repeats the title
  detail?: false
  // In the row detail modal: columns with the same group share one compact section
  group?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  empty?: { title: string; description?: string; action?: ReactNode }
  // Highlights a row, e.g. ties at the recall cutoff
  rowClassName?: (row: T) => string | undefined
  // Makes whole rows clickable; keep a real link in the row for keyboard and screen readers
  onRowClick?: (row: T) => void
  // Clicking a row opens a modal listing every column, including the ones narrow screens hide
  detailTitle?: (row: T) => string
  // Below this width the table scrolls sideways inside its card instead of squeezing its columns
  minWidthClass?: string
  // Names the pager for screen readers when a page has more than one table
  paginationLabel?: string
  className?: string
}

const align = { left: 'text-left', right: 'text-right', center: 'text-center' } as const
const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell' } as const

// Shows 10 rows at a time with a pager underneath
export function Table<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty = { title: 'Nothing here yet' },
  rowClassName,
  onRowClick,
  detailTitle,
  minWidthClass = 'min-w-[34rem]',
  paginationLabel,
  className,
}: TableProps<T>) {
  // Go back to the first page whenever the rows change because of a filter or a search
  const resetKey = `${rows.length}|${rows[0] ? rowKey(rows[0]) : ''}|${rows.length ? rowKey(rows[rows.length - 1]) : ''}`
  const { page, setPage, pageSize, total, pageItems } = usePagination(rows, resetKey)
  const [detail, setDetail] = useState<T | null>(null)
  const open = onRowClick ?? (detailTitle ? setDetail : undefined)

  // Buttons, links and fields inside a row do their own thing
  const fromControl = (e: MouseEvent | KeyboardEvent) =>
    (e.target as HTMLElement).closest('a,button,input,select,textarea,label') !== null

  if (!loading && rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 px-6">
        <EmptyState {...empty} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className={cn('no-scrollbar overflow-auto', className)}>
        <table className={cn('w-full border-collapse text-small', minWidthClass)}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'sticky top-0 z-10 whitespace-nowrap border-b border-neutral-200 bg-neutral-50 px-5 py-3.5',
                    'text-xs font-medium uppercase tracking-wider text-neutral-500 first:pl-6 last:pr-6',
                    align[c.align ?? 'left'],
                    c.hideBelow && hide[c.hideBelow],
                    c.widthClass,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/80">
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-5 py-4 first:pl-6 last:pr-6',
                          c.hideBelow && hide[c.hideBelow],
                        )}
                      >
                        <Skeleton className="h-3.5 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : pageItems.map((row) => (
                  <tr
                    key={rowKey(row)}
                    onClick={open && ((e) => !fromControl(e) && open(row))}
                    onKeyDown={
                      open &&
                      ((e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !fromControl(e)) {
                          e.preventDefault()
                          open(row)
                        }
                      })
                    }
                    tabIndex={open ? 0 : undefined}
                    className={cn(
                      'transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50',
                      open && 'cursor-pointer',
                      rowClassName?.(row),
                    )}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-5 py-4 first:pl-6 last:pr-6',
                          c.muted ? 'text-neutral-600' : 'text-neutral-900',
                          align[c.align ?? 'left'],
                          c.mono && 'font-mono tabular-nums',
                          c.hideBelow && hide[c.hideBelow],
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!loading && <Showing page={page} pageSize={pageSize} total={total} />}
      </div>
      {!loading && (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} label={paginationLabel} showSummary={false} />
      )}
      {detailTitle && (
        <Dialog
          open={detail !== null}
          onClose={() => setDetail(null)}
          title={detail ? detailTitle(detail) : ''}
          className="max-w-lg"
        >
          {detail && (
            <div className="flex flex-col gap-6">
              <dl className="grid grid-cols-2 gap-x-8 gap-y-5">
                {columns
                  .filter((c) => c.header && c.detail !== false && !c.group)
                  .map((c) => (
                    <div key={c.key} className="flex min-w-0 flex-col gap-1">
                      <dt className="text-xs text-neutral-500">{c.header}</dt>
                      <dd className={cn('min-w-0 break-words text-small text-neutral-900', c.mono && 'font-mono tabular-nums')}>
                        {c.cell(detail)}
                      </dd>
                    </div>
                  ))}
              </dl>
              {[...new Set(columns.flatMap((c) => (c.group ? [c.group] : [])))].map((group) => (
                <section key={group} className="flex flex-col gap-3 border-t border-neutral-100 pt-5">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-neutral-500">{group}</h3>
                  <dl className="grid grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))] gap-2">
                    {columns
                      .filter((c) => c.group === group)
                      .map((c) => (
                        <div key={c.key} className="flex flex-col items-center gap-1 rounded-lg bg-neutral-50 px-2 py-2.5">
                          <dt className="text-xs text-neutral-500">{c.header}</dt>
                          <dd className="font-mono text-small font-medium tabular-nums text-neutral-900">{c.cell(detail)}</dd>
                        </div>
                      ))}
                  </dl>
                </section>
              ))}
            </div>
          )}
        </Dialog>
      )}
    </div>
  )
}
