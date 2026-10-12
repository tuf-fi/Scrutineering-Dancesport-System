import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

// The row above a list: a search box and filters on the left, the page's main actions on the right
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-end gap-3', className)}>{children}</div>
}

// Pushes its buttons to the far right of the toolbar, level with the inputs
export function ToolbarActions({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">{children}</div>
}
