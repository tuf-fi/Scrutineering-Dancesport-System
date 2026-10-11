import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  // Buttons, right-aligned
  actions?: ReactNode
  className?: string
}

export function Dialog({ open, onClose, title, description, children, actions, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        'm-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg bg-white p-0 text-neutral-900',
        'shadow-overlay backdrop:bg-black/60 open:animate-dialog-in',
        className,
      )}
    >
      <div className="no-scrollbar flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-6">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-title font-bold">{title}</h2>
          {description && <p className="text-body text-neutral-600">{description}</p>}
        </div>
        {children}
        {actions && <div className="flex justify-end gap-2 pt-2">{actions}</div>}
      </div>
    </dialog>
  )
}
