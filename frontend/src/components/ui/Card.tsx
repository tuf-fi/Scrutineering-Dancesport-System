import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn.ts'

// Flat surface with a hairline border; no shadow
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-lg border border-neutral-200 bg-white p-5', className)}
      {...props}
    />
  )
}
