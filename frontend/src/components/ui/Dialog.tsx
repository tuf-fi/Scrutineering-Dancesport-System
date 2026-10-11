import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
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
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 grid animate-fade-in place-items-center bg-black/60 p-4">
          <RadixDialog.Content
            {...(description ? {} : { 'aria-describedby': undefined })}
            className={cn(
              'w-full max-w-lg animate-dialog-in rounded-lg bg-white text-neutral-900 shadow-overlay',
              className,
            )}
          >
            <div className="no-scrollbar flex max-h-[85dvh] flex-col gap-4 overflow-y-auto p-6">
              <div className="flex flex-col gap-1.5">
                <RadixDialog.Title className="text-title font-semibold">{title}</RadixDialog.Title>
                {description && (
                  <RadixDialog.Description className="text-body text-neutral-600">
                    {description}
                  </RadixDialog.Description>
                )}
              </div>
              {children}
              {actions && <div className="flex justify-end gap-2 pt-2">{actions}</div>}
            </div>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
