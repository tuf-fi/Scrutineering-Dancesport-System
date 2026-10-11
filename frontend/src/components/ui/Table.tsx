import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { EmptyState } from './EmptyState.tsx'
import { Skeleton } from './Skeleton.tsx'

export interface Column<T> {
  key: string
  header: string
  cell: (row: T) => ReactNode
  align?: 'left' | 'right' | 'center'
  // Numbers (back numbers, counts, placings) use the mono face so columns line up
  mono?: boolean
}

interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  empty?: { title: string; description?: string; action?: ReactNode }
  // Highlights a row, e.g. ties at the recall cutoff
  rowClassName?: (row: T) => string | undefined
  className?: string
}

const align = { left: 'text-left', right: 'text-right', center: 'text-center' } as const

export function Table<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  empty = { title: 'Nothing here yet' },
  rowClassName,
  className,
}: TableProps<T>) {
  if (!loading && rows.length === 0) return <EmptyState {...empty} />

  return (
    <div className={cn('no-scrollbar overflow-auto', className)}>
      <table className="w-full border-collapse text-small">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'sticky top-0 border-b border-neutral-900 bg-white py-3 pr-4 font-medium text-neutral-600 first:pl-0 last:pr-0',
                  align[c.align ?? 'left'],
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={i} className="border-b border-neutral-200">
                  {columns.map((c) => (
                    <td key={c.key} className="py-3.5 pr-4 first:pl-0 last:pr-0">
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn(
                    'border-b border-neutral-200 transition-colors hover:bg-neutral-50',
                    rowClassName?.(row),
                  )}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        'py-3.5 pr-4 text-neutral-900 first:pl-0 last:pr-0',
                        align[c.align ?? 'left'],
                        c.mono && 'font-mono tabular-nums',
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
  )
}
