import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

const tones = {
  neutral: 'bg-neutral-100 text-neutral-700',
  gold: 'bg-gold-100 text-gold-700',
  brown: 'bg-brown-900 text-white',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
} as const

export type BadgeTone = keyof typeof tones

export function Badge({
  tone = 'neutral',
  dot = false,
  children,
}: {
  tone?: BadgeTone
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-2 py-1 font-mono text-label font-medium uppercase',
        tones[tone],
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
