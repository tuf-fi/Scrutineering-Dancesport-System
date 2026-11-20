import { useState } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useRotateRoundSets } from '../../hooks/index.ts'

// Gives every round not yet started a set of adjudicators, moving who sits out from round to round
export function RotateSetsDialog({ open, competitionId, onClose }: { open: boolean; competitionId: string; onClose: () => void }) {
  const rotate = useRotateRoundSets(competitionId)
  const [size, setSize] = useState('5')
  const [failure, setFailure] = useState<string | null>(null)

  function submit() {
    const n = Number(size)
    if (!Number.isInteger(n) || n < 1) return setFailure('Enter how many adjudicators mark each round.')
    setFailure(null)
    rotate.mutate(n, {
      onSuccess: (done) => {
        toast.success(`Adjudicators set for ${String(done)} round${done === 1 ? '' : 's'}`)
        onClose()
      },
      onError: (e) => setFailure(e.message),
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-md"
      title="Rotate the adjudicators"
      description="Each round that has not started gets this many adjudicators from its event's panel, and who sits out moves on by one place every round. You can still change any round afterwards."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={rotate.isPending} onClick={submit}>
            {rotate.isPending ? 'Rotating…' : 'Rotate'}
          </Button>
        </>
      }
    >
      {open && <Input label="Adjudicators per round" inputMode="numeric" value={size} onChange={(e) => setSize(e.target.value)} error={failure ?? undefined} className="font-mono tabular-nums" />}
    </Dialog>
  )
}
