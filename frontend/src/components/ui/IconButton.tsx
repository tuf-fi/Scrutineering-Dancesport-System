import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn.ts'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon
  // Names the action for screen readers and shows as the hover tooltip
  label: string
  tone?: 'default' | 'danger'
}

// A small icon-only action, such as edit or delete on a table row
export function IconButton({ icon: Icon, label, tone = 'default', className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'grid size-8 place-items-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger'
          ? 'text-neutral-500 hover:bg-danger-soft hover:text-danger'
          : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900',
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className="size-4" strokeWidth={1.75} />
    </button>
  )
}
