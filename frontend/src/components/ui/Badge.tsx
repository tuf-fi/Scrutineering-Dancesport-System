import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

const tones = {
  neutral: 'text-neutral-600',
  gold: 'text-gold-700',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const

const pillFills = {
  neutral: 'bg-neutral-100',
  gold: 'bg-gold-100',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
} as const

export type BadgeTone = keyof typeof tones

// A status is a dot and a word; `pill` puts it on a tinted capsule
export function Badge({
  tone = 'neutral',
  dot = true,
  pill = false,
  children,
}: {
  tone?: BadgeTone
  dot?: boolean
  pill?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        pill ? cn('rounded-full px-2.5 py-1 text-xs', pillFills[tone]) : 'text-small',
        tones[tone],
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
