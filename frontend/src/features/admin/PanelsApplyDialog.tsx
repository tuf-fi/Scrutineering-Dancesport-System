import type { Adjudicator } from '@bis/shared'
import { useState } from 'react'
import { Button, Dialog } from '../../components/ui/index.ts'

type Mode = 'replace' | 'add'

const MODES: Array<{ value: Mode; label: string; note: string }> = [
  { value: 'replace', label: 'Replace each panel', note: 'Every event gets exactly this list.' },
  { value: 'add', label: 'Add to each panel', note: 'Keeps who is already on a panel.' },
]

// One list of adjudicators for every event of the competition at once
export function PanelsApplyDialog({
  open,
  adjudicators,
  eventCount,
  pending,
  onApply,
  onClose,
}: {
  open: boolean
  adjudicators: Adjudicator[]
  eventCount: number
  pending: boolean
  onApply: (adjudicatorIds: string[], mode: Mode) => void
  onClose: () => void
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [mode, setMode] = useState<Mode>('replace')
  const all = adjudicators.length > 0 && picked.length === adjudicators.length
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-lg"
      title="Set the panel for all events"
      description={`Applies to the ${eventCount} event${eventCount === 1 ? '' : 's'} of this competition. An event that has started keeps its panel.`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={picked.length === 0 || pending} onClick={() => onApply(picked, mode)}>
            {pending ? 'Applying…' : 'Apply to all events'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 flex w-full items-center justify-between text-small font-medium text-neutral-600">
            Adjudicators
            <button
              type="button"
              onClick={() => setPicked(all ? [] : adjudicators.map((a) => a.id))}
              className="font-semibold text-neutral-900 underline underline-offset-4"
            >
              {all ? 'Clear' : 'Select all'}
            </button>
          </legend>
          {adjudicators.map((a) => (
            <label key={a.id} className="flex cursor-pointer items-center gap-3 text-small text-neutral-900">
              <input type="checkbox" checked={picked.includes(a.id)} onChange={() => toggle(a.id)} className="size-5 accent-neutral-900" />
              <span className="font-mono font-semibold text-gold-700">{a.letter}</span>
              {a.name}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-small font-medium text-neutral-600">What to do with the panels now</legend>
          {MODES.map((m) => (
            <label key={m.value} className="flex cursor-pointer items-start gap-3 text-small text-neutral-900">
              <input type="radio" name="panels-mode" checked={mode === m.value} onChange={() => setMode(m.value)} className="mt-0.5 size-5 shrink-0 accent-neutral-900" />
              <span className="flex flex-col">
                {m.label}
                <span className="text-neutral-600">{m.note}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
    </Dialog>
  )
}
