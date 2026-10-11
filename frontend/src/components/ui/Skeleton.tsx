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
