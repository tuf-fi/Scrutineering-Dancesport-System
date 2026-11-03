import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '../../lib/cn.ts'

// Smoked glass blocks that sit on the dark panel, with a light edge along the top
export const glass = 'rounded-xl border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] backdrop-blur-xl'

type Props<T extends ElementType> = { as?: T } & Omit<ComponentPropsWithoutRef<T>, 'as'>

// The dark panel at the top of a scrutineer or adjudicator screen: silver orbs behind a sheet of smoked glass
export function DarkPanel<T extends ElementType = 'section'>({ as, className, children, ...rest }: Props<T>) {
  const Tag: ElementType = as ?? 'section'
  return (
    <Tag className={cn('relative isolate overflow-hidden rounded-xl border border-white/10 bg-brown-950 text-white', className)} {...rest}>
      <span aria-hidden className="pointer-events-none absolute -right-10 top-1/4 -z-20 size-56 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgb(255_255_255/0.4),rgb(150_150_155/0.2)_45%,transparent_72%)] sm:size-72" />
      <span aria-hidden className="pointer-events-none absolute -bottom-24 left-1/4 -z-20 size-64 rounded-full bg-[radial-gradient(circle_at_40%_35%,rgb(255_255_255/0.25),rgb(120_120_125/0.15)_50%,transparent_75%)] sm:size-96" />
      <span aria-hidden className="pointer-events-none absolute -left-8 -top-10 -z-20 size-32 rounded-full bg-[radial-gradient(circle_at_40%_35%,rgb(255_255_255/0.2),transparent_70%)]" />
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-black/40 backdrop-blur-2xl" />
      {children}
    </Tag>
  )
}
