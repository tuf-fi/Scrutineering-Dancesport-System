import type { Team } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useSaveTeam } from '../../hooks/index.ts'

const FORM_ID = 'team-form'

function TeamForm({ team, onDone }: { team: Team | null; onDone: () => void }) {
  const save = useSaveTeam()
  const [name, setName] = useState(team?.name ?? '')
  const [contactName, setContactName] = useState(team?.contactName ?? '')
  const [contactPhone, setContactPhone] = useState(team?.contactPhone ?? '')
  const [contactEmail, setContactEmail] = useState(team?.contactEmail ?? '')
  const [error, setError] = useState<string | undefined>()
  const [failure, setFailure] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Enter the team name.')
    setError(undefined)
    setFailure(null)
    save.mutate(
      { id: team?.id, input: { name, contactName, contactEmail, contactPhone } },
      {
        onSuccess: (c) => {
          toast.success(`${team ? 'Saved' : 'Added'} ${c.name}`)
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
          <Input label="Team" value={name} onChange={(e) => setName(e.target.value)} error={error} autoFocus />
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

// Adds a team, or edits the one given
export function TeamDialog({ open, team, onClose }: { open: boolean; team: Team | null; onClose: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={team ? 'Edit team' : 'Add team'}
      description="Teams have no sign-in. The secretariat enters their dancers from the entry forms."
      className="max-w-lg"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {team ? 'Save changes' : 'Add team'}
          </Button>
        </>
      }
    >
      {open && <TeamForm key={team?.id ?? 'new'} team={team} onDone={onClose} />}
    </Dialog>
  )
}
