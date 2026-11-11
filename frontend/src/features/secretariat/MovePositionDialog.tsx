import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input } from '../../components/ui/index.ts'

function PositionForm({ current, total, onMove, onDone }: { current: number; total: number; onMove: (to: number) => void; onDone: () => void }) {
  const [value, setValue] = useState(String(current))
  const [error, setError] = useState<string>()

  function submit(event: FormEvent) {
    event.preventDefault()
    const to = Number(value)
    if (!/^\d+$/.test(value.trim()) || to < 1 || to > total) return setError(`Enter a whole number from 1 to ${total}.`)
    if (to !== current) onMove(to)
    onDone()
  }

  return (
    <form id="move-position-form" onSubmit={submit} noValidate>
      <Input
        label="Position"
        required
        hint={`It is now at ${current}. The others move to make room.`}
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error}
        autoFocus
        className="font-mono tabular-nums"
      />
    </form>
  )
}

// Moves one line to a place in the order by number, for the long moves dragging cannot make across pages
export function MovePositionDialog({
  title,
  current,
  total,
  onMove,
  onClose,
}: {
  // What is being moved; null while the dialog is closed
  title: string | null
  current: number
  total: number
  onMove: (to: number) => void
  onClose: () => void
}) {
  return (
    <Dialog
      open={title !== null}
      onClose={onClose}
      className="max-w-sm"
      title={`Move ${title ?? ''}`}
      description="Type the place it should take in the order."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="move-position-form">
            Move
          </Button>
        </>
      }
    >
      {title !== null && <PositionForm key={`${title}:${current}`} current={current} total={total} onMove={onMove} onDone={onClose} />}
    </Dialog>
  )
}
