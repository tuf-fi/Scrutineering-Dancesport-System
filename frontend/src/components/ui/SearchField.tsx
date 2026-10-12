import { useId } from 'react'
import { cn } from '../../lib/cn.ts'

interface SearchFieldProps {
  label?: string
  value: string
  onChange: (value: string) => void
  className?: string
}

// A search box with a magnifier; the label stays visible above it
export function SearchField({ label = 'Search', value, onChange, className }: SearchFieldProps) {
  const id = useId()
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-small font-medium text-neutral-600">
        {label}
      </label>
      <div className="relative">
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="m13.5 13.5 3.5 3.5" />
        </svg>
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-full rounded-md border border-neutral-300 bg-neutral-50 pl-9 pr-3 text-body text-neutral-900 transition-colors hover:border-neutral-400 focus-visible:border-neutral-900 focus-visible:bg-white focus-visible:outline-gold-500"
        />
      </div>
    </div>
  )
}
