import type { ReactNode } from 'react'

// The title of a block on an admin settings page: a name, one line saying what it is, and optionally an action on the right
export function SectionHead({ title, note, action }: { title: string; note: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-semibold tracking-[-0.01em] text-neutral-900">{title}</h2>
        <p className="text-small text-neutral-600">{note}</p>
      </div>
      {action}
    </div>
  )
}
