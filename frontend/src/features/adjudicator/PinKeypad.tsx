import { useEffect } from 'react'
import { Button } from '../../components/ui/index.ts'
import { cn } from '../../lib/cn.ts'

interface PinKeypadProps {
  value: string
  length: number
  onChange: (next: string) => void
  disabled?: boolean
  error?: string | null
}

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
        <div
          role="img"
          aria-label={`${value.length} of ${length} digits entered`}
          className="flex gap-4"
        >
          {Array.from({ length }, (_, i) => (
            <span
              key={i}
              className={cn(
                'size-4 rounded-full border-2 border-neutral-900 transition-colors',
                i < value.length && 'bg-neutral-900',
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
          <Button
            key={d}
            variant="secondary"
            size="xl"
            disabled={disabled}
            onClick={() => press(d)}
            className="font-mono tabular-nums sm:h-20"
          >
            {d}
          </Button>
        ))}
        <Button variant="ghost" size="xl" disabled={disabled} onClick={clear} className="px-0 text-body! sm:h-20">
          Clear
        </Button>
        <Button
          variant="secondary"
          size="xl"
          disabled={disabled}
          onClick={() => press('0')}
          className="font-mono tabular-nums sm:h-20"
        >
          0
        </Button>
        <Button variant="ghost" size="xl" disabled={disabled} onClick={remove} className="px-0 text-body! sm:h-20">
          Delete
        </Button>
      </div>
    </div>
  )
}
