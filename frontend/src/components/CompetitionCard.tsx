import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

interface CompetitionCardProps {
  title: string
  // The small line under the title, like the date and a count
  meta: ReactNode
  // Shown before the chevron: points, a status
  aside?: ReactNode
  // Smaller text and tighter rows, for a side panel
  compact?: boolean
  // The accessible name of the opened list
  label: string
  children: ReactNode
}

// A competition as a card: its name opens what belongs under it, with the same smooth animation as the account lists
export function CompetitionCard({ title, meta, aside, compact, label, children }: CompetitionCardProps) {
  const [open, setOpen] = useState(false)
  const panel = useId()

  return (
    <li className={cn('overflow-hidden rounded-xl border transition-colors duration-300', open ? 'border-neutral-300' : 'border-neutral-200 hover:border-neutral-300')}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-x-4 text-left transition-colors duration-300 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold-500',
          compact ? 'px-4 py-3' : 'px-5 py-4',
          open && 'bg-gold-50',
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={cn('font-semibold tracking-[-0.01em] text-neutral-900', compact ? 'text-small' : 'text-body')}>{title}</span>
          <span className="font-mono text-xs uppercase tabular-nums text-neutral-500">{meta}</span>
        </span>
        {aside}
        <span aria-hidden className={cn('grid size-7 shrink-0 place-items-center rounded-full border transition-colors duration-300', open ? 'border-gold-400 bg-gold-400 text-black' : 'border-neutral-300 text-neutral-500')}>
          <ChevronDown className={cn('size-4 transition-transform duration-300', open && 'rotate-180')} strokeWidth={1.75} />
        </span>
      </button>

      {/* The panel stays mounted and grows from zero height, so it opens and closes smoothly */}
      <div
        className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="overflow-hidden">
          <ol id={panel} aria-label={label} className="border-t border-neutral-200">
            {children}
          </ol>
        </div>
      </div>
    </li>
  )
}
