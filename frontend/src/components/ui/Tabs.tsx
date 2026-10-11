import { useId, type KeyboardEvent } from 'react'
import { cn } from '../../lib/cn.ts'

export interface TabItem {
  id: string
  label: string
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
              'shrink-0 whitespace-nowrap border-b-2 px-4 font-semibold transition-colors',
              large ? 'h-14 text-body' : 'h-11 text-small',
              active
                ? 'border-gold-500 text-neutral-900'
                : 'border-transparent text-neutral-600 hover:text-neutral-900',
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
