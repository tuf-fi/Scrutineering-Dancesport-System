import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn.ts'

// Size it with className to match the content it stands in for
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-skeleton rounded-md bg-neutral-200', className)}
      {...props}
    />
  )
}

const WIDTHS = ['w-2/5', 'w-1/3', 'w-1/2', 'w-1/4']

// Stands in for a list or a form while it loads: a title bar and a short line on each row, split by hairlines
export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden className={cn('flex w-full flex-col', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-6 border-b border-neutral-100 py-4 first:pt-0">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className={cn('h-3.5', WIDTHS[i % WIDTHS.length])} />
            <Skeleton className="h-3 w-3/4 max-w-sm bg-neutral-100" />
          </div>
          <Skeleton className="h-3.5 w-16 shrink-0" />
        </div>
      ))}
    </div>
  )
}
