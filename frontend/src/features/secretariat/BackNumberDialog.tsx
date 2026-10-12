import type { CompetitorRow } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useSetBackNumber } from '../../hooks/index.ts'
import { competitorName } from '../../lib/format.ts'

const FORM_ID = 'back-number-form'

function BackNumberForm({ competitor, onDone }: { competitor: CompetitorRow; onDone: () => void }) {
  const save = useSetBackNumber()
  const [value, setValue] = useState(competitor.backNumber?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const text = value.trim()
    if (text !== '' && !/^\d+$/.test(text)) return setError('Use a whole number, or leave empty to clear it.')
    setError(null)
    save.mutate(
      { id: competitor.id, backNumber: text === '' ? null : Number(text) },
      {
        onSuccess: () => {
          toast.success('Back number saved')
          onDone()
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate>
      <Input
        label="Back number"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        error={error ?? undefined}
        className="font-mono tabular-nums"
        autoFocus
      />
    </form>
  )
}

export function BackNumberDialog({ competitor, onClose }: { competitor: CompetitorRow | null; onClose: () => void }) {
  return (
    <Dialog
      open={competitor !== null}
      onClose={onClose}
      title="Back number"
      description={competitor ? competitorName(competitor.names) : undefined}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            Save
          </Button>
        </>
      }
    >
      {competitor && <BackNumberForm key={competitor.id} competitor={competitor} onDone={onClose} />}
    </Dialog>
  )
}
