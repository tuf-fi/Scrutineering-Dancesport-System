import { GripVertical, IdCard, type LucideIcon } from 'lucide-react'
import { useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import { usePagination } from '../../hooks/usePagination.ts'
import { cn } from '../../lib/cn.ts'
import { Drawer } from './Drawer.tsx'
import { EmptyState } from './EmptyState.tsx'
import { Pagination, Showing } from './Pagination.tsx'
import { Skeleton } from './Skeleton.tsx'

// A part of a row's detail panel: it gets its own place in the panel's side menu
export interface DetailSection {
  id: string
  label: string
  icon?: LucideIcon
  content: ReactNode
}

export interface Column<T> {
  key: string
  header: string
  // Shown in the header instead of the text, e.g. a select-all checkbox; the text still names the column elsewhere
  headerCell?: ReactNode
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  // Numbers (back numbers, counts, placings) use the mono face so columns line up
  mono?: boolean
  // Quieter secondary text, for supporting columns
  muted?: boolean
  // Bold header and values, for the column a table is read by
  bold?: boolean
  // Lets long text break onto more lines; cells otherwise stay on one line so names, numbers and dates never split
  wrap?: boolean
  // Hides the column on screens narrower than this breakpoint
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  // Fixed width class for narrow columns such as a rank
  widthClass?: string
  // In the row detail modal: leave out a column that repeats the title
  detail?: false
  // Only in the row detail modal: the table itself does not show it
  detailOnly?: true
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
  // Clicking a row opens a panel from the right edge listing every column, including the ones narrow screens hide
  detailTitle?: (row: T) => string
  // More for the Details part of the panel, under the columns: facts about the row that are not table columns
  detailExtra?: (row: T) => ReactNode
  // Further parts of the panel, each its own place in a side menu (Details first), like the fees page: entries, history and so on
  detailSections?: (row: T) => DetailSection[]
  // Adds a handle in front of each row: drag a row onto another (mouse or finger) to move it there, or press the arrow keys on the handle to move it one place
  onReorder?: (row: T, target: T) => void
  // Rows that stay where they are (their handle is dimmed)
  canReorder?: (row: T) => boolean
  // Names a row's handle for screen readers
  reorderLabel?: (row: T) => string
  // Below this width the table scrolls sideways inside its card instead of squeezing its columns
  minWidthClass?: string
  // Names the pager for screen readers when a page has more than one table
  paginationLabel?: string
  className?: string
}

const align = { left: 'text-left', right: 'text-right', center: 'text-center' } as const
const hide = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
} as const

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
  detailExtra,
  detailSections,
  onReorder,
  canReorder,
  reorderLabel,
  minWidthClass = 'min-w-[34rem]',
  paginationLabel,
  className,
}: TableProps<T>) {
  // Go back to the first page whenever the rows change because of a filter or a search
  const resetKey = `${rows.length}|${rows[0] ? rowKey(rows[0]) : ''}|${rows.length ? rowKey(rows[rows.length - 1]) : ''}`
  const { page, setPage, pageSize, total, pageItems } = usePagination(rows, resetKey)
  const [detail, setDetail] = useState<T | null>(null)
  const visible = columns.filter((c) => !c.detailOnly)
  const [section, setSection] = useState('details')
  // The row being dragged and the one it is over
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const open = onRowClick ?? (detailTitle ? (row: T) => (setSection('details'), setDetail(row)) : undefined)

  // Buttons, links and fields inside a row do their own thing
  const fromControl = (e: MouseEvent | KeyboardEvent) =>
    (e.target as HTMLElement).closest('a,button,input,select,textarea,label') !== null

  const indexOf = (key: string) => rows.findIndex((r) => rowKey(r) === key)
  // Dragging uses pointer events so a finger works like a mouse; the handle captures the pointer until it is released
  const startDrag = (e: PointerEvent<HTMLElement>, key: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setDragKey(key)
    setOverKey(null)
  }
  const moveDrag = (e: PointerEvent<HTMLElement>) => {
    if (dragKey === null) return
    const under = document.elementFromPoint?.(e.clientX, e.clientY)?.closest('tr[data-row-key]')
    const key = under?.getAttribute('data-row-key') ?? null
    setOverKey(key && key !== dragKey ? key : null)
    // Near the top or bottom of the screen the page follows the finger
    if (e.clientY < 90) window.scrollBy(0, -14)
    else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 14)
  }
  const endDrag = (drop: boolean) => {
    const dragged = drop ? rows.find((r) => rowKey(r) === dragKey) : undefined
    const target = drop && overKey !== null ? rows.find((r) => rowKey(r) === overKey) : undefined
    setDragKey(null)
    setOverKey(null)
    if (dragged && target && onReorder) onReorder(dragged, target)
  }
  const nudge = (e: KeyboardEvent<HTMLElement>, row: T) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const target = rows[rows.indexOf(row) + (e.key === 'ArrowUp' ? -1 : 1)]
    if (target && onReorder) onReorder(row, target)
  }

  if (!loading && rows.length === 0) {
    return <EmptyState {...empty} />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className={cn('no-scrollbar overflow-auto', className)}>
        <table className={cn('w-full border-collapse text-small', minWidthClass)}>
          <thead>
            <tr>
              {onReorder && (
                <th scope="col" className="sticky top-0 z-10 w-10 border-b border-neutral-200 bg-neutral-50 pl-4">
                  <span className="sr-only">Reorder</span>
                </th>
              )}
              {visible.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    'sticky top-0 z-10 whitespace-nowrap border-b border-neutral-200 bg-neutral-50 px-4 py-3.5',
                    'text-xs font-medium uppercase tracking-wider text-neutral-500 first:pl-6 last:pr-6',
                    c.bold && 'font-bold text-neutral-900',
                    align[c.align ?? 'left'],
                    c.hideBelow && hide[c.hideBelow],
                    c.widthClass,
                  )}
                >
                  {c.headerCell ?? (c.header || <span className="sr-only">Actions</span>)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100/80">
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {onReorder && <td />}
                    {visible.map((c) => (
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
                    data-row-key={rowKey(row)}
                    className={cn(
                      'transition-colors hover:bg-neutral-50 focus-visible:bg-neutral-50',
                      open && 'cursor-pointer',
                      dragKey === rowKey(row) && 'opacity-40',
                      // A gold line marks where the row will land: under the target when moving down, above it when moving up
                      overKey === rowKey(row) &&
                        dragKey !== null &&
                        (indexOf(dragKey) < indexOf(rowKey(row)) ? '[box-shadow:inset_0_-2px_0_0_var(--color-gold-400)]' : '[box-shadow:inset_0_2px_0_0_var(--color-gold-400)]'),
                      rowClassName?.(row),
                    )}
                  >
                    {onReorder && (
                      <td className="w-10 pl-4 pr-0">
                        <button
                          type="button"
                          disabled={canReorder?.(row) === false}
                          aria-label={reorderLabel ? reorderLabel(row) : 'Move row'}
                          onPointerDown={(e) => startDrag(e, rowKey(row))}
                          onPointerMove={moveDrag}
                          onPointerUp={() => endDrag(true)}
                          onPointerCancel={() => endDrag(false)}
                          onKeyDown={(e) => nudge(e, row)}
                          className="grid size-9 touch-none cursor-grab select-none place-items-center rounded-md text-neutral-400 hover:text-neutral-900 focus-visible:text-neutral-900 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <GripVertical aria-hidden className="size-4" />
                        </button>
                      </td>
                    )}
                    {visible.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-4 py-4 first:pl-6 last:pr-6',
                          !c.wrap && 'sm:whitespace-nowrap',
                          c.muted ? 'text-neutral-600' : 'text-neutral-900',
                          align[c.align ?? 'left'],
                          c.mono && 'font-mono tabular-nums',
                          c.bold && 'font-bold',
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
        <Drawer
          open={detail !== null}
          onClose={() => setDetail(null)}
          title={detail ? detailTitle(detail) : ''}
          flush={Boolean(detailSections && detail && detailSections(detail).length > 0)}
          className={detailSections ? 'sm:max-w-3xl' : undefined}
        >
          {detail && <DetailBody row={detail} columns={columns} more={detailExtra?.(detail)} extra={detailSections?.(detail)} section={section} onSection={setSection} />}
        </Drawer>
      )}
    </div>
  )
}

// What the columns say about one row, as the panel's first section: one row per item, the name on the left and the value on the right
function DetailColumns<T>({ row, columns }: { row: T; columns: Column<T>[] }) {
  const item = (c: Column<T>) => (
    <div key={c.key} className="grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-x-4 border-t border-neutral-100 py-3 first:border-t-0">
      <dt className="text-small text-neutral-500">{c.header}</dt>
      <dd className={cn('min-w-0 break-words text-small text-neutral-900', c.mono && 'font-mono tabular-nums', c.bold && 'font-bold')}>{c.cell(row)}</dd>
    </div>
  )
  return (
    <div className="flex flex-col gap-8">
      <dl className="flex flex-col">{columns.filter((c) => c.header && c.detail !== false && !c.group).map(item)}</dl>
      {[...new Set(columns.flatMap((c) => (c.group ? [c.group] : [])))].map((group) => (
        <section key={group} className="flex flex-col gap-2 border-t border-neutral-200 pt-6">
          <h3 className="font-mono text-xs uppercase text-neutral-500">{group}</h3>
          <dl className="flex flex-col">{columns.filter((c) => c.group === group).map(item)}</dl>
        </section>
      ))}
    </div>
  )
}

// The inside of the detail panel: just the columns, or a side menu with a part of the row's story in each of its sections
function DetailBody<T>({
  row,
  columns,
  more,
  extra,
  section,
  onSection,
}: {
  row: T
  columns: Column<T>[]
  more?: ReactNode
  extra?: DetailSection[]
  section: string
  onSection: (id: string) => void
}) {
  const details = (
    <div className="flex flex-col gap-8">
      <DetailColumns row={row} columns={columns} />
      {more && <div className="flex flex-col gap-6 border-t border-neutral-200 pt-6">{more}</div>}
    </div>
  )
  if (!extra || extra.length === 0) return details

  const all: DetailSection[] = [{ id: 'details', label: 'Details', icon: IdCard, content: details }, ...extra]
  const current = all.find((x) => x.id === section) ?? all[0]!

  return (
    <div className="flex h-full min-h-0 flex-col sm:flex-row">
      <nav
        aria-label="Sections"
        className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-neutral-200 bg-neutral-50 px-3 py-3 sm:w-48 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r sm:px-3 sm:py-5"
      >
        {all.map((x) => {
          const Icon = x.icon
          const active = x.id === current.id
          return (
            <button
              key={x.id}
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => onSection(x.id)}
              className={cn(
                'flex h-10 shrink-0 items-center gap-3 whitespace-nowrap rounded-md border px-3 text-left text-small font-medium transition-colors',
                active ? 'border-neutral-200 bg-white text-neutral-900' : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
              )}
            >
              {Icon && <Icon aria-hidden className={cn('size-[18px] shrink-0', active && 'text-gold-600')} strokeWidth={1.75} />}
              {x.label}
            </button>
          )
        })}
      </nav>
      <section aria-label={current.label} className="no-scrollbar flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
        <h3 className="text-body font-semibold text-neutral-900">{current.label}</h3>
        {current.content}
      </section>
    </div>
  )
}
