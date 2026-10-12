import type { Adjudicator } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useCreateAdjudicator, useUpdateAdjudicator } from '../../hooks/index.ts'
import { LETTERS } from './constants.ts'

const FORM_ID = 'adjudicator-form'

function AdjudicatorForm({
  adjudicator,
  freeLetters,
  onSubmit,
}: {
  adjudicator: Adjudicator | null
  freeLetters: string[]
  onSubmit: (values: { name: string; letter: string }) => void
}) {
  const [name, setName] = useState(adjudicator?.name ?? '')
  const [picked, setPicked] = useState('')
  const [error, setError] = useState<string | undefined>()
  // The letter shown is always one that is free right now, even if the list changed while the form was open
  const letter = freeLetters.includes(picked) ? picked : (freeLetters[0] ?? '')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Enter a name.')
    setError(undefined)
    onSubmit({ name, letter: adjudicator?.letter ?? letter })
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={error} autoFocus />
      {adjudicator ? (
        <Input label="Letter" value={adjudicator.letter} disabled hint="A letter can't be changed." readOnly />
      ) : (
        <Select label="Letter" value={letter} onChange={(e) => setPicked(e.target.value)}>
          {freeLetters.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      )}
    </form>
  )
}

// Adds an adjudicator with a free letter, or edits the one given
export function AdjudicatorDialog({
  open,
  adjudicator,
  takenLetters,
  onClose,
}: {
  open: boolean
  adjudicator: Adjudicator | null
  takenLetters: string[]
  onClose: () => void
}) {
  const create = useCreateAdjudicator()
  const update = useUpdateAdjudicator()
  const editing = adjudicator !== null
  const [failure, setFailure] = useState<string | null>(null)
  const pending = create.isPending || update.isPending

  function close() {
    setFailure(null)
    onClose()
  }

  function submit(values: { name: string; letter: string }) {
    setFailure(null)
    if (adjudicator) {
      update.mutate(
        { id: adjudicator.id, name: values.name },
        {
          onSuccess: () => {
            toast.success(`${adjudicator.letter} updated`)
            close()
          },
          onError: (e) => setFailure(e.message),
        },
      )
    } else {
      create.mutate(values, {
        onSuccess: (a) => {
          toast.success(`Added adjudicator ${a.letter}`)
          close()
        },
        onError: (e) => setFailure(e.message),
      })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={editing ? 'Edit adjudicator' : 'Add an adjudicator'}
      description={editing ? 'Change the name.' : 'Pick the letter they will mark under.'}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Add adjudicator'}
          </Button>
        </>
      }
    >
      <AdjudicatorForm
        key={adjudicator?.id ?? 'new'}
        adjudicator={adjudicator}
        freeLetters={LETTERS.filter((l) => !takenLetters.includes(l))}
        onSubmit={submit}
      />
      {failure && (
        <p role="alert" className="mt-4 text-small text-danger">
          {failure}
        </p>
      )}
    </Dialog>
  )
}
