import { useState } from 'react'
import { Button, Dialog, Select, Textarea, toast } from '../../components/ui/index.ts'
import { useStartRedance } from '../../hooks/index.ts'

// Orders a heat to be danced again. Adjudicators who already sent their marks mark that heat once more.
export function RedanceDialog({ open, roundId, heats, final, onClose }: { open: boolean; roundId: string; heats: number[]; final: boolean; onClose: () => void }) {
  const start = useStartRedance()
  const [heat, setHeat] = useState(heats[0] ?? 1)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (reason.trim().length < 3) return setError('Give the reason in a few words.')
    setError(null)
    start.mutate(
      { roundId, heat, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success(final ? 'The final will be danced again' : `Heat ${heat} will be danced again`)
          onClose()
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-md"
      title={final ? 'Redance the final' : 'Redance a heat'}
      description={
        final
          ? 'The final is danced again. Adjudicators who already sent their placings place every finalist once more.'
          : 'The heat is danced again. Adjudicators who already sent their marks mark that heat once more; the other heats keep their marks.'
      }
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={start.isPending} onClick={submit}>
            {start.isPending ? 'Starting…' : 'Redance'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {heats.length > 1 && (
          <Select label="Heat" value={heat} onChange={(e) => setHeat(Number(e.target.value))}>
            {heats.map((n) => (
              <option key={n} value={n}>
                Heat {n}
              </option>
            ))}
          </Select>
        )}
        <Textarea label="Reason" rows={3} hint="Who asked, and why. It is kept with the cleared marks." value={reason} onChange={(e) => setReason(e.target.value)} error={error ?? undefined} required />
      </div>
    </Dialog>
  )
}
