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
    <div className="flex flex-col items-start gap-1.5 py-8">
      <h3 className="text-body font-semibold text-neutral-900">{title}</h3>
      {description && <p className="max-w-prose text-small text-neutral-600">{description}</p>}
      {action && <div className="pt-3">{action}</div>}
    </div>
  )
}
