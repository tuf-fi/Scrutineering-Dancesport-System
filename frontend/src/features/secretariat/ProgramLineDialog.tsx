import { ProgramKind, type ProgramRow } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useAddProgramBreak, useUpdateProgramSlot } from '../../hooks/index.ts'
import { programLineName } from '../../lib/format.ts'

const FORM_ID = 'program-line-form'

function LineForm({
  competitionId,
  row,
  lastSequence,
  onDone,
}: {
  competitionId: string
  row: ProgramRow | null
  lastSequence: number
  onDone: () => void
}) {
  const add = useAddProgramBreak(competitionId)
  const update = useUpdateProgramSlot(competitionId)
  const [kind, setKind] = useState<ProgramKind>(ProgramKind.Break)
  const [label, setLabel] = useState(row?.label ?? '')
  const [minutes, setMinutes] = useState(String(row?.minutes ?? 15))
  const [after, setAfter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isRound = row?.kind === ProgramKind.Round

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!/^\d+$/.test(minutes.trim())) return setError('Minutes is a whole number.')
    const afterText = after.trim()
    if (afterText && (!/^\d+$/.test(afterText) || Number(afterText) > lastSequence)) {
      return setError(`Put it after a line from 0 to ${lastSequence}, or leave that empty for the end.`)
    }
    setError(null)
    const onError = (err: Error) => setError(err.message)
    if (row) {
      update.mutate(
        { slotId: row.slotId, input: isRound ? { minutes: Number(minutes) } : { minutes: Number(minutes), label } },
        {
          onError,
          onSuccess: () => {
            toast.success('Saved')
            onDone()
          },
        },
      )
      return
    }
    add.mutate(
      { kind, label, minutes: Number(minutes), ...(afterText ? { afterSequence: Number(afterText) } : {}) },
      {
        onError,
        onSuccess: () => {
          toast.success(`Added ${label.trim()}`)
          onDone()
        },
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        {!row && (
          <Select label="Type" value={kind} onChange={(e) => setKind(e.target.value as ProgramKind)}>
            <option value={ProgramKind.Break}>Break</option>
            <option value={ProgramKind.Awarding}>Awarding</option>
          </Select>
        )}
        {!isRound && <Input label="Name" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Lunch" />}
        <Input
          label="Minutes"
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="font-mono tabular-nums"
        />
        {!row && (
          <Input
            label="After line"
            inputMode="numeric"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            hint="Empty puts it at the end."
            className="font-mono tabular-nums"
          />
        )}
      </form>
      {error && (
        <p role="alert" className="mt-4 text-small text-danger">
          {error}
        </p>
      )}
    </>
  )
}

// Adds a break or the awarding, or edits the minutes (and name) of the line given
export function ProgramLineDialog({
  open,
  competitionId,
  row,
  lastSequence,
  onClose,
}: {
  open: boolean
  competitionId: string
  row: ProgramRow | null
  lastSequence: number
  onClose: () => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={row ? programLineName(row) : 'Add a break'}
      description={row ? 'Every time after this line moves with its length.' : 'A break or the awarding between rounds.'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {row ? 'Save' : 'Add'}
          </Button>
        </>
      }
    >
      {open && (
        <LineForm key={row?.slotId ?? 'new'} competitionId={competitionId} row={row} lastSequence={lastSequence} onDone={onClose} />
      )}
    </Dialog>
  )
}
