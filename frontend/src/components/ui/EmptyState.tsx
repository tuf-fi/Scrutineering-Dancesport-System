import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-neutral-300 rounded-lg px-6 py-10">
      <h3 className="text-title font-semibold text-neutral-900">{title}</h3>
      {description && <p className="max-w-prose text-body text-neutral-600">{description}</p>}
      {action}
    </div>
  )
}
