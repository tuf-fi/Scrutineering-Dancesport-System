import { useId, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn.ts'

export interface TabItem {
  id: string
  label: string
  // Shown after the label in a quieter mono style, e.g. how many items are in the tab
  count?: number
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  label: string
  // Larger targets for adjudicator phones
  large?: boolean
  className?: string
}

// Renders the tab list; the caller renders the active panel and may use tabId/panelId from the id prefix
export function Tabs({ items, value, onChange, label, large = false, className }: TabsProps) {
  const base = useId()

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = items.findIndex((t) => t.id === value)
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = items[(i + step + items.length) % items.length]
    onChange(next.id)
    document.getElementById(`${base}-${next.id}`)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('no-scrollbar flex overflow-x-auto border-b border-neutral-200', className)}
    >
      {items.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            id={`${base}-${t.id}`}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              '-mb-px mr-6 shrink-0 whitespace-nowrap border-b-2 font-semibold transition-colors last:mr-0',
              large ? 'h-14 text-body' : 'h-10 text-small',
              active
                ? 'border-gold-500 text-neutral-900'
                : 'border-transparent text-neutral-600 hover:text-neutral-900',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="ml-2 font-mono text-xs font-medium tabular-nums text-neutral-500">
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
