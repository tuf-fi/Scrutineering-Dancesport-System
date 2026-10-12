import { cn } from '../lib/cn.ts'
import { initials } from '../lib/format.ts'

const TINTS = ['bg-brown-100/70 text-brown-800', 'bg-neutral-200/70 text-neutral-700']

const SIZES = {
  md: 'size-9 text-xs',
  lg: 'size-10 text-small',
  // Profile headers
  xl: 'size-14 text-body',
} as const

// Initials in a circle for a person, a club or a competition; overlapping for a couple. There are no photos yet.
export function Avatars({ names, size = 'md' }: { names: string[]; size?: keyof typeof SIZES }) {
  const overlapping = names.length > 1
  return (
    <span aria-hidden className={cn('flex shrink-0', overlapping && '-space-x-2')}>
      {names.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className={cn(
            'grid place-items-center rounded-full font-semibold',
            // A ring only separates the circles of a couple
            overlapping && 'ring-2 ring-white',
            SIZES[size],
            TINTS[i % TINTS.length],
          )}
        >
          {initials(name)}
        </span>
      ))}
    </span>
  )
}
