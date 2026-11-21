import { useState } from 'react'
import { Button, Dialog, Select, toast } from '../../components/ui/index.ts'
import { mergeHeats, moveHeat, swapCouples, type HeatMap } from './heatEdits.ts'

export type HeatTool = 'merge' | 'swap' | 'order'

const TITLE: Record<HeatTool, string> = { merge: 'Merge heats', swap: 'Swap couples', order: 'Move a heat' }
const DONE: Record<HeatTool, string> = {
  merge: 'Heats merged. Save heats to keep it.',
  swap: 'Couples swapped. Save heats to keep it.',
  order: 'Heat moved. Save heats to keep it.',
}
const HELP: Record<HeatTool, string> = {
  merge: 'Everyone in the first heat joins the second.',
  swap: 'The two couples trade heats.',
  order: 'The heat is danced at the new position; the others shift.',
}

interface Couple {
  id: string
  label: string
}

// Larger heat edits, applied to the unsaved arrangement; nothing is sent until Save heats
export function HeatToolsDialog({ tool, heats, couples, map, onApply, onClose }: {
  tool: HeatTool | null
  heats: number[]
  couples: Couple[]
  map: HeatMap
  onApply: (next: HeatMap) => void
  onClose: () => void
}) {
  const [one, setOne] = useState('')
  const [two, setTwo] = useState('')
  const open = tool !== null
  const swap = tool === 'swap'
  const withHeat = (list: Couple[]) => list.map((c) => ({ value: c.id, label: `Heat ${map.get(c.id)} · ${c.label}` }))
  const options = swap ? withHeat(couples) : heats.map((n) => ({ value: String(n), label: `Heat ${n}` }))
  const first = one && options.some((o) => o.value === one) ? one : options[0]?.value
  // The second choice never repeats the first: a swap needs a couple from another heat, a merge or a move needs another heat
  const others = swap ? withHeat(couples.filter((c) => map.get(c.id) !== map.get(first ?? ''))) : options.filter((o) => o.value !== first)
  const second = others.some((o) => o.value === two) ? two : others[0]?.value
  const invalid = !first || !second

  function apply() {
    if (!tool) return
    if (invalid) return void toast.error(swap ? 'Every couple is in the same heat, so there is nobody to swap with.' : 'There is only one heat, so there is nothing to change.')
    if (tool === 'merge') onApply(mergeHeats(map, Number(first), Number(second)))
    if (tool === 'order') onApply(moveHeat(map, Number(first), Number(second)))
    if (tool === 'swap') onApply(swapCouples(map, first!, second!))
    toast.success(DONE[tool])
    onClose()
  }

  const labels = { merge: ['Merge', 'Into'], swap: ['First couple', 'Second couple'], order: ['Move heat', 'To position'] }[tool ?? 'merge']

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-md"
      title={tool ? TITLE[tool] : ''}
      description={tool ? HELP[tool] : ''}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply}>
            Apply
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select label={labels[0]} value={first} onChange={(e) => setOne(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select label={labels[1]} value={second} onChange={(e) => setTwo(e.target.value)}>
          {others.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
    </Dialog>
  )
}
