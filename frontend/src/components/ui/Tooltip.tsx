import { useId, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn.ts'

interface TooltipProps {
  // Empty or missing: no tooltip, the children render as they are
  label?: string
  children: ReactNode
  className?: string
}

// Focus a script gives (a dialog opening on its first button) is not keyboard focus, so it shows no tooltip
const keyboardFocus = (el: EventTarget) => {
  try {
    return (el as Element).matches(':focus-visible')
  } catch {
    return true
  }
}

// Our hover and focus tooltip, in place of the browser's `title`. It sits in a portal so a table's scroll box never clips it
export function Tooltip({ label, children, className }: TooltipProps) {
  const id = useId()
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null)

  if (!label) return <>{children}</>

  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    const below = r.top < 48
    setAt({ x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below })
  }
  const hide = () => setAt(null)

  return (
    <span
      className={cn('inline-flex', className)}
      aria-describedby={at ? id : undefined}
      onMouseEnter={(e) => show(e.currentTarget)}
      onMouseLeave={hide}
      onFocus={(e) => keyboardFocus(e.target) && show(e.currentTarget)}
      onBlur={hide}
      onKeyDown={(e) => e.key === 'Escape' && hide()}
      onClick={hide}
    >
      {children}
      {at &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            style={{ left: at.x, top: at.y }}
            className={cn(
              'pointer-events-none fixed z-[100] max-w-64 -translate-x-1/2 rounded-md bg-brown-950 px-2.5 py-1.5 text-center text-xs font-medium text-white shadow-overlay',
              !at.below && '-translate-y-full',
            )}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  )
}
