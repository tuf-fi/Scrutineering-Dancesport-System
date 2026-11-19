import { ProgramStatus } from '@bis/shared'
import type { CSSProperties } from 'react'
import { cn } from '../lib/cn.ts'

const LOOK: Record<ProgramStatus, { color: string; label: string; state: string }> = {
  [ProgramStatus.Completed]: { color: 'var(--color-status-done)', label: 'Finished', state: 'done' },
  [ProgramStatus.Current]: { color: 'var(--color-status-live)', label: 'On the floor', state: 'live' },
  [ProgramStatus.Next]: { color: 'var(--color-status-next)', label: 'Up next', state: 'next' },
  [ProgramStatus.Upcoming]: { color: 'var(--color-status-idle)', label: 'Not started', state: 'idle' },
}

export function StatusDot({ status, className }: { status: ProgramStatus; className?: string }) {
  const look = LOOK[status]
  return (
    <span
      role="img"
      aria-label={look.label}
      title={look.label}
      data-state={look.state}
      style={{ '--dot': look.color } as CSSProperties}
      className={cn('status-dot inline-block shrink-0 rounded-full', className ?? 'size-[7px]')}
    />
  )
}

const ORDER = [ProgramStatus.Completed, ProgramStatus.Current, ProgramStatus.Next, ProgramStatus.Upcoming]

export function StatusLegend({ className }: { className?: string }) {
  return (
    <ul aria-label="What the dots mean" className={cn('flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-neutral-600', className)}>
      {ORDER.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <StatusDot status={status} />
          {LOOK[status].label}
        </li>
      ))}
    </ul>
  )
}
