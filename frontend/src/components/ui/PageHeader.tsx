import type { ReactNode } from 'react'

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string
  eyebrow?: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200 pb-5">
      <div className="flex flex-col gap-1.5">
        {eyebrow && (
          <p className="font-mono text-label font-medium uppercase text-gold-700">{eyebrow}</p>
        )}
        <h1 className="text-display font-bold text-neutral-900">{title}</h1>
        {description && <p className="max-w-prose text-body text-neutral-600">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}
