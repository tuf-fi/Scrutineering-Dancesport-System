import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { IconButton } from './IconButton.tsx'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  // Shown under the title, e.g. a status
  meta?: ReactNode
  children?: ReactNode
  // Pinned to the bottom while the body scrolls
  footer?: ReactNode
  className?: string
}

// Off-canvas panel from the right edge, built on Radix Dialog like Dialog
export function Drawer({ open, onClose, title, meta, children, footer, className }: DrawerProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-black/50" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full max-w-xl animate-drawer-in flex-col bg-white text-neutral-900 border-l border-neutral-200 shadow-overlay',
            className,
          )}
        >
          <div className="relative flex flex-col items-start gap-1.5 border-b border-neutral-200 px-6 py-4 pr-14">
            <RadixDialog.Title className="text-title font-semibold">{title}</RadixDialog.Title>
            {meta}
            <RadixDialog.Close asChild>
              <IconButton icon={X} label="Close" className="absolute right-4 top-4" />
            </RadixDialog.Close>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto px-6 py-5">{children}</div>

          {footer && (
            <div className="flex flex-col gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-4">{footer}</div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
