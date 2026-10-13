import { AgeGroup, type ClubDancer } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useSaveDancer } from '../../hooks/index.ts'
import { AGE_GROUP_LABEL } from '../../lib/format.ts'

const FORM_ID = 'dancer-form'

function DancerForm({ dancer, onDone }: { dancer: ClubDancer | null; onDone: () => void }) {
  const save = useSaveDancer()
  const [first, setFirst] = useState(dancer?.names[0] ?? '')
  const [second, setSecond] = useState(dancer?.names[1] ?? '')
  const [ageGroup, setAgeGroup] = useState<AgeGroup | ''>(dancer?.ageGroup ?? '')
  const [errors, setErrors] = useState<{ first?: string; age?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const found = {
      first: first.trim() ? undefined : 'Enter the dancer’s name.',
      age: ageGroup ? undefined : 'Choose the age group.',
    }
    setErrors(found)
    if (found.first || found.age || !ageGroup) return
    setFailure(null)
    save.mutate(
      { names: [first, second], ageGroup, id: dancer?.id },
      {
        onSuccess: () => {
          toast.success(dancer ? 'Dancer updated' : 'Dancer added')
          onDone()
        },
        onError: (e) => setFailure(e.message),
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
        <Input label="Dancer" value={first} onChange={(e) => setFirst(e.target.value)} error={errors.first} autoFocus />
        <Input label="Partner" hint="Leave empty for a solo dancer." value={second} onChange={(e) => setSecond(e.target.value)} />
        <Select
          label="Age group"
          hint="We do not ask for birth dates. The organizer may check ages at registration."
          value={ageGroup}
          onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
          error={errors.age}
        >
          <option value="">Choose an age group</option>
          {Object.values(AgeGroup).map((a) => (
            <option key={a} value={a}>
              {AGE_GROUP_LABEL[a]}
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

// Adds a dancer or edits the one given. Only a name and an age group are kept (Data Privacy Act).
export function DancerDialog({ open, dancer, onClose }: { open: boolean; dancer: ClubDancer | null; onClose: () => void }) {
  const editing = dancer !== null
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit dancer' : 'Add dancer'}
      description="Only a name and an age group are kept."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {editing ? 'Save changes' : 'Add dancer'}
          </Button>
        </>
      }
    >
      {open && <DancerForm key={dancer?.id ?? 'new'} dancer={dancer} onDone={onClose} />}
    </Dialog>
  )
}
