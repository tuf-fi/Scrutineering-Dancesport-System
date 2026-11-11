import type { ClassDef } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useSaveClass } from '../../hooks/index.ts'

const FORM_ID = 'class-form'

function ClassForm({ cls, onSaved, onPending }: { cls: ClassDef | null; onSaved: () => void; onPending: (pending: boolean) => void }) {
  const save = useSaveClass()
  const [name, setName] = useState(cls?.name ?? '')
  const [error, setError] = useState<string>()

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Enter the name of the class.')
    setError(undefined)
    onPending(true)
    save.mutate(
      { input: { name }, id: cls?.name },
      {
        onSuccess: () => {
          toast.success(cls ? 'Class updated' : 'Class added')
          onSaved()
        },
        onError: (e) => setError(e.message),
        onSettled: () => onPending(false),
      },
    )
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate>
      <Input label="Name" required hint="As it shows on events and result sheets, such as E1 or A." value={name} onChange={(e) => setName(e.target.value)} error={error} autoFocus />
    </form>
  )
}

// Creates a class, or renames the one given
export function ClassDialog({ open, cls, onClose }: { open: boolean; cls: ClassDef | null; onClose: () => void }) {
  const editing = cls !== null
  const [pending, setPending] = useState(false)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-sm"
      title={editing ? 'Rename class' : 'New class'}
      description={editing ? 'Its events and ranking points take the new name.' : 'Added after the highest class.'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Add class'}
          </Button>
        </>
      }
    >
      {open && <ClassForm key={cls?.name ?? 'new'} cls={cls} onSaved={onClose} onPending={setPending} />}
    </Dialog>
  )
}
