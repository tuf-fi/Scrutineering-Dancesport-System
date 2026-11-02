import type { ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

// A section with its title and a short note on the left, the content on the right
export function ProfileSection({ id, title, note, wide, children }: { id: string; title: string; note: string; wide?: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-6 border-t border-neutral-200 pt-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
      <div className="flex flex-col gap-1.5">
        <h2 id={id} className="text-title font-semibold text-neutral-900">
          {title}
        </h2>
        <p className="text-small text-neutral-600">{note}</p>
      </div>
      <div className={cn('flex flex-col gap-5', !wide && 'max-w-xl')}>{children}</div>
    </section>
  )
}

// The facts at the top of a profile: a label over a large value, split by hairlines
export function ProfileSummary({ items }: { items: { label: string; value?: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 divide-y divide-neutral-200 border-y border-neutral-200 sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-y-0">
      {items.map((i) => (
        <div key={i.label} className="flex flex-col gap-1 py-5 sm:px-6 sm:first:pl-0">
          <dt className="text-small text-neutral-600">{i.label}</dt>
          <dd className={i.value != null ? 'text-title font-semibold tabular-nums text-neutral-900' : 'text-title text-neutral-400'}>{i.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
