import { useState } from 'react'
import { Button, Dialog, toast } from './ui/index.ts'

interface Remove {
  mutateAsync: (vars: { id: string }) => Promise<unknown>
}

export interface BulkTarget {
  rows: { id: string; label: string }[]
  done: () => void
}

// One confirmation for deleting several rows at once. Rows with related data are kept and reported, never deleted behind the user's back
export function BulkDeleteDialog({ noun, target, remove, onClose }: { noun: string; target: BulkTarget | null; remove: Remove; onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const count = target?.rows.length ?? 0
  const plural = `${noun}${count === 1 ? '' : 's'}`

  async function confirm() {
    if (!target) return
    setBusy(true)
    const failed: string[] = []
    let first = ''
    for (const row of target.rows) {
      try {
        await remove.mutateAsync({ id: row.id })
      } catch (e) {
        failed.push(row.label)
        first ||= (e as Error).message
      }
    }
    setBusy(false)
    const deleted = target.rows.length - failed.length
    if (deleted > 0) toast.success(`Deleted ${deleted} ${noun}${deleted === 1 ? '' : 's'}`)
    if (failed.length > 0) toast.error(`${failed.length} not deleted (${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}): ${first}`)
    target.done()
    onClose()
  }

  return (
    <Dialog
      open={target !== null}
      onClose={busy ? () => undefined : onClose}
      title={`Delete ${count} ${plural}?`}
      description="This can't be undone. One that still has records connected to it is kept, and you are told which."
      actions={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'Deleting…' : `Delete ${count}`}
          </Button>
        </>
      }
    >
      <ul className="max-h-56 overflow-auto border-y border-neutral-200">
        {(target?.rows ?? []).map((r) => (
          <li key={r.id} className="border-t border-neutral-200 py-2 text-small text-neutral-900 first:border-t-0">
            {r.label}
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
