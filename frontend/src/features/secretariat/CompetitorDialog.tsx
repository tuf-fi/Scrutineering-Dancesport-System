import type { CompetitorRow } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useClubs, useCreateCompetitor, useUpdateCompetitor } from '../../hooks/index.ts'

const FORM_ID = 'competitor-form'

function CompetitorForm({ competitor, onDone }: { competitor: CompetitorRow | null; onDone: () => void }) {
  const clubs = useClubs()
  const create = useCreateCompetitor()
  const update = useUpdateCompetitor()
  const [first, setFirst] = useState(competitor?.names[0] ?? '')
  const [second, setSecond] = useState(competitor?.names[1] ?? '')
  const [clubId, setClubId] = useState(competitor?.clubId ?? '')
  const [errors, setErrors] = useState<{ first?: string; club?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const found = {
      first: first.trim() ? undefined : 'Enter the dancer’s name.',
      club: clubId ? undefined : 'Choose a club.',
    }
    setErrors(found)
    if (found.first || found.club) return
    setFailure(null)
    const handlers = {
      onSuccess: (c: CompetitorRow) => {
        toast.success(`${competitor ? 'Saved' : 'Added'} ${c.names.join(' & ')}`)
        onDone()
      },
      onError: (e: Error) => setFailure(e.message),
    }
    if (competitor) update.mutate({ id: competitor.id, names: [first, second], clubId }, handlers)
    else create.mutate({ names: [first, second], clubId }, handlers)
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
        <Input label="Dancer" value={first} onChange={(e) => setFirst(e.target.value)} error={errors.first} autoFocus />
        <Input
          label="Partner"
          hint="Leave empty for a solo dancer."
          value={second}
          onChange={(e) => setSecond(e.target.value)}
        />
        <Select label="Club" value={clubId} onChange={(e) => setClubId(e.target.value)} error={errors.club}>
          <option value="">Choose a club</option>
          {(clubs.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </form>
      {failure && (
        <p role="alert" className="mt-4 text-small text-danger">
          {failure}
        </p>
      )}
    </>
  )
}

// Adds a competitor, or edits the one given
export function CompetitorDialog({
  open,
  competitor,
  onClose,
}: {
  open: boolean
  competitor: CompetitorRow | null
  onClose: () => void
}) {
  const editing = competitor !== null
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit competitor' : 'Add competitor'}
      description={editing ? 'Correct the name or the club.' : 'Back numbers are assigned afterwards.'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {editing ? 'Save changes' : 'Add competitor'}
          </Button>
        </>
      }
    >
      {open && <CompetitorForm key={competitor?.id ?? 'new'} competitor={competitor} onDone={onClose} />}
    </Dialog>
  )
}
