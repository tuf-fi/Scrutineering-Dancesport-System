import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

export function EmptyState({
  title,
  description,
  action,
  tone = 'light',
}: {
  title: string
  description?: string
  action?: ReactNode
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        dark ? 'flex-1 justify-center gap-[1.6vmin] px-[4vmin]' : 'gap-1.5 rounded-lg border border-dashed border-neutral-300 px-6 py-14',
      )}
    >
      <h3 className={dark ? 'text-[4.4vmin] font-semibold leading-tight tracking-[-0.02em] text-white' : 'text-body font-semibold text-neutral-900'}>{title}</h3>
      {description && <p className={cn('max-w-prose text-balance', dark ? 'text-[2.4vmin] font-medium text-brown-100' : 'text-small text-neutral-600')}>{description}</p>}
      {action && <div className={dark ? 'pt-[1.6vmin]' : 'pt-3'}>{action}</div>}
    </div>
  )
}
