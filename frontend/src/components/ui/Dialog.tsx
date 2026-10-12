import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'
import { IconButton } from './IconButton.tsx'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  // Buttons, right-aligned in a footer bar
  actions?: ReactNode
  className?: string
}

// Built on Radix Dialog, which provides the focus trap, scroll lock, Esc and portal
export function Dialog({ open, onClose, title, description, children, actions, className }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[60] grid animate-fade-in place-items-center bg-black/50 p-4">
          <RadixDialog.Content
            {...(description ? {} : { 'aria-describedby': undefined })}
            className={cn(
              'flex max-h-[90dvh] w-full max-w-md animate-dialog-in flex-col overflow-hidden rounded-xl bg-white text-neutral-900 shadow-overlay',
              className,
            )}
          >
            <div className={cn('relative flex flex-col gap-1 px-6 pt-6 pr-14', children ? 'pb-4' : 'pb-6')}>
              <RadixDialog.Title className="text-title font-semibold">{title}</RadixDialog.Title>
              {description && (
                <RadixDialog.Description className="text-small text-neutral-600">
                  {description}
                </RadixDialog.Description>
              )}
              <RadixDialog.Close asChild>
                <IconButton icon={X} label="Close" className="absolute right-4 top-4" />
              </RadixDialog.Close>
            </div>

            {children && <div className="no-scrollbar flex-1 overflow-y-auto px-6 pb-6">{children}</div>}

            {actions && (
              <div className="flex justify-end gap-2 border-t border-neutral-200 bg-neutral-50 px-6 py-3.5">
                {actions}
              </div>
            )}
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
