import type { Competition } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useSaveCompetition } from '../../hooks/index.ts'

interface Values {
  name: string
  date: string
  venue: string
  organizer: string
}

type Errors = Partial<Record<keyof Values, string>>

const FORM_ID = 'competition-form'

function CompetitionForm({ initial, onSubmit }: { initial: Values; onSubmit: (values: Values) => void }) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})

  const set = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  function submit(event: FormEvent) {
    event.preventDefault()
    const found: Errors = {}
    if (!values.name.trim()) found.name = 'Enter the competition name.'
    if (!values.date) found.date = 'Pick the date.'
    if (!values.venue.trim()) found.venue = 'Enter the venue.'
    if (!values.organizer.trim()) found.organizer = 'Enter the organizer.'
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit(values)
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Input label="Name" value={values.name} onChange={set('name')} error={errors.name} autoFocus />
      </div>
      <Input label="Date" type="date" value={values.date} onChange={set('date')} error={errors.date} />
      <Input label="Organizer" value={values.organizer} onChange={set('organizer')} error={errors.organizer} />
      <div className="sm:col-span-2">
        <Input label="Venue" value={values.venue} onChange={set('venue')} error={errors.venue} />
      </div>
    </form>
  )
}

// Creates a competition, or edits the one given
export function CompetitionDialog({
  open,
  competition,
  onClose,
}: {
  open: boolean
  competition: Competition | null
  onClose: () => void
}) {
  const save = useSaveCompetition()
  const editing = competition !== null
  const [failure, setFailure] = useState<string | null>(null)

  function close() {
    setFailure(null)
    onClose()
  }

  function submit(values: Values) {
    setFailure(null)
    save.mutate(
      { input: values, id: competition?.id },
      {
        onSuccess: () => {
          toast.success(editing ? 'Competition updated' : 'Competition created')
          close()
        },
        onError: (e) => setFailure(e.message),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      className="max-w-lg"
      title={editing ? 'Edit competition' : 'New competition'}
      description={editing ? 'Change the details and save.' : 'Add the details of the competition.'}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create competition'}
          </Button>
        </>
      }
    >
      <CompetitionForm
        key={competition?.id ?? 'new'}
        initial={
          competition
            ? { name: competition.name, date: competition.date, venue: competition.venue, organizer: competition.organizer }
            : { name: '', date: '', venue: '', organizer: '' }
        }
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
