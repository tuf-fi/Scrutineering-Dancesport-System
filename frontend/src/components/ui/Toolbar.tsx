import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

// A conditional group of controls is a fragment: look inside it
const flat = (nodes: ReactNode): ReactNode[] =>
  Children.toArray(nodes).flatMap((n) => (isValidElement<{ children?: ReactNode }>(n) && n.type === Fragment ? flat(n.props.children) : [n]))

// The row above a list: the search box and filters fill the full width as a grid, two to a row on phones and as many as fit
// on larger screens (one filter on its own is full width), and the page's buttons sit below them, at their natural width.
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  const items = flat(children)
  const actions = items.filter((c) => isValidElement(c) && c.type === ToolbarActions)
  const filters = items.filter((c) => !actions.includes(c))
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {filters.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] max-md:[&>:last-child:nth-child(odd)]:col-span-2 [&>*]:min-w-0! [&>*]:w-full! [&_select]:w-full">
          {filters}
        </div>
      )}
      {actions}
    </div>
  )
}

// The page's buttons, kept together at their natural width, left-aligned under the filters
export function ToolbarActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}
