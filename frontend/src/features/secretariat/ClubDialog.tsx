import type { Club } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useSaveClub } from '../../hooks/index.ts'

const FORM_ID = 'club-form'

function ClubForm({ club, onDone }: { club: Club | null; onDone: () => void }) {
  const save = useSaveClub()
  const [name, setName] = useState(club?.name ?? '')
  const [contactName, setContactName] = useState(club?.contactName ?? '')
  const [contactPhone, setContactPhone] = useState(club?.contactPhone ?? '')
  const [contactEmail, setContactEmail] = useState(club?.contactEmail ?? '')
  const [error, setError] = useState<string | undefined>()
  const [failure, setFailure] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Enter the club name.')
    setError(undefined)
    setFailure(null)
    save.mutate(
      { id: club?.id, input: { name, contactName, contactEmail, contactPhone } },
      {
        onSuccess: (c) => {
          toast.success(`${club ? 'Saved' : 'Added'} ${c.name}`)
          onDone()
        },
        onError: (err) => setFailure(err.message),
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Input label="Club" value={name} onChange={(e) => setName(e.target.value)} error={error} autoFocus />
        </div>
        <Input label="Contact person" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        <Input label="Contact no." inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        <div className="sm:col-span-2">
          <Input label="Email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </div>
      </form>
      {failure && (
        <p role="alert" className="mt-4 text-small text-danger">
          {failure}
        </p>
      )}
    </>
  )
}

// Adds a club (a team on the entry forms), or edits the one given
export function ClubDialog({ open, club, onClose }: { open: boolean; club: Club | null; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={club ? 'Edit club' : 'Add club'}
      description="Teams have no sign-in. The secretariat enters their dancers from the entry forms."
      className="max-w-lg"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {club ? 'Save changes' : 'Add club'}
          </Button>
        </>
      }
    >
      {open && <ClubForm key={club?.id ?? 'new'} club={club} onDone={onClose} />}
    </Dialog>
  )
}
