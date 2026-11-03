import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

// A conditional group of controls is a fragment: look inside it
const flat = (nodes: ReactNode): ReactNode[] =>
  Children.toArray(nodes).flatMap((n) => (isValidElement<{ children?: ReactNode }>(n) && n.type === Fragment ? flat(n.props.children) : [n]))

// The row above a list: a search box and filters, and the page's buttons. The buttons sit at the far right of the same
// row when they fit; when they do not, they drop under the filters and line up with their left edge.
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  const items = flat(children)
  const actions = items.filter((c) => isValidElement(c) && c.type === ToolbarActions)
  const filters = items.filter((c) => !actions.includes(c))
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-3 gap-y-4', className)}>
      {filters.length > 0 && (
        <div className="flex flex-wrap items-end gap-3 max-sm:w-full max-sm:[&>*]:min-w-0 max-sm:[&>*]:flex-1 max-sm:[&>*]:basis-36 max-sm:[&_select]:w-full">{filters}</div>
      )}
      {actions}
    </div>
  )
}

// The page's buttons, kept together at their natural width and always at the right edge (on phones, under the filters at the left)
export function ToolbarActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{children}</div>
}
