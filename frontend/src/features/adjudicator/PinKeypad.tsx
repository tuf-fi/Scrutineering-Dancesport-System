import { useEffect } from 'react'
import { cn } from '../../lib/cn.ts'

interface PinKeypadProps {
  value: string
  length: number
  onChange: (next: string) => void
  disabled?: boolean
  error?: string | null
}

const digit =
  'grid h-16 place-items-center rounded-2xl bg-neutral-100 text-3xl font-medium tabular-nums text-neutral-900 ' +
  'transition-colors hover:bg-neutral-200/70 active:bg-neutral-200 disabled:opacity-40 sm:h-20'
const action =
  'h-16 rounded-2xl text-small font-medium text-neutral-600 transition-colors hover:text-neutral-900 ' +
  'active:bg-neutral-100 disabled:opacity-40 sm:h-20'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// Large keypad for one-handed use on a phone; every key is at least 64px tall
export function PinKeypad({ value, length, onChange, disabled = false, error }: PinKeypadProps) {
  const press = (digit: string) => {
    if (!disabled && value.length < length) onChange(value + digit)
  }
  const remove = () => !disabled && onChange(value.slice(0, -1))
  const clear = () => !disabled && onChange('')

  // Physical keyboards work too, for laptops and testing
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') remove()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-3">
        <div role="img" aria-label={`${value.length} of ${length} digits entered`} className="flex gap-5">
          {Array.from({ length }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-3.5 rounded-full border-2 transition-colors',
                i < value.length ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-300',
              )}
            />
          ))}
        </div>
        <p role="alert" className="min-h-5 text-center text-small text-danger">
          {error}
        </p>
      </div>

      <div className="grid w-full max-w-xs grid-cols-3 gap-3 sm:max-w-sm sm:gap-4">
        {DIGITS.map((d) => (
          <button key={d} type="button" disabled={disabled} onClick={() => press(d)} className={digit}>
            {d}
          </button>
        ))}
        <button type="button" disabled={disabled} onClick={clear} className={action}>
          Clear
        </button>
        <button type="button" disabled={disabled} onClick={() => press('0')} className={digit}>
          0
        </button>
        <button type="button" disabled={disabled} onClick={remove} className={action}>
          Delete
        </button>
      </div>
    </div>
  )
}
