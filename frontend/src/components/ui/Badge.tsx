import type { ReactNode } from 'react'
import { cn } from '../../lib/cn.ts'

const tones = {
  neutral: 'text-neutral-600',
  gold: 'text-gold-700',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
} as const

export type BadgeTone = keyof typeof tones

// A status is a dot and a word in the status color: no fill, no capsule
export function Badge({
  tone = 'neutral',
  dot = true,
  children,
}: {
  tone?: BadgeTone
  dot?: boolean
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap font-medium',
        'text-small',
        tones[tone],
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
