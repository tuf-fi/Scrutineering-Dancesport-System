import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

// The row above a list: a search box and filters on the left, the page's main actions on the right
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-end gap-3 max-sm:[&>*:not([data-actions])]:min-w-0 max-sm:[&>*:not([data-actions])]:flex-1 max-sm:[&>*:not([data-actions])]:basis-36 max-sm:[&_select]:w-full', className)}>{children}</div>
}

// Pushes its buttons to the far right of the toolbar, level with the inputs
export function ToolbarActions({ children }: { children: ReactNode }) {
  return <div data-actions className="flex flex-wrap items-center gap-2 max-sm:order-last max-sm:basis-full sm:ml-auto">{children}</div>
}
