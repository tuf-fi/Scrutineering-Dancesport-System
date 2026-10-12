import { Role, type StaffUser } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useCreateStaff, useUpdateStaff } from '../../hooks/index.ts'
import { ROLE_LABEL } from '../../lib/format.ts'
import { STAFF_ROLES } from './constants.ts'

const FORM_ID = 'staff-form'

interface Values {
  name: string
  username: string
  role: Role
}

function StaffForm({
  initial,
  editing,
  usernameError,
  onSubmit,
}: {
  initial: Values
  editing: boolean
  usernameError?: string
  onSubmit: (values: Values) => void
}) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<{ name?: string; username?: string }>({})

  function submit(event: FormEvent) {
    event.preventDefault()
    const found: typeof errors = {}
    if (!values.name.trim()) found.name = 'Enter a name.'
    if (!editing && !values.username.trim()) found.username = 'Enter a username.'
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit(values)
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
      <Input
        label="Name"
        value={values.name}
        onChange={(e) => setValues({ ...values, name: e.target.value })}
        error={errors.name}
        autoFocus
      />
      <Input
        label="Username"
        value={values.username}
        onChange={(e) => setValues({ ...values, username: e.target.value })}
        error={errors.username ?? usernameError}
        hint={editing ? "A username can't be changed." : undefined}
        disabled={editing}
        autoCapitalize="none"
      />
      <Select label="Role" value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value as Role })}>
        {STAFF_ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABEL[r]}
          </option>
        ))}
      </Select>
    </form>
  )
}

// Adds a staff account, or edits the one given
export function StaffDialog({
  open,
  user,
  onClose,
  onCreated,
}: {
  open: boolean
  user: StaffUser | null
  onClose: () => void
  onCreated: (name: string, password: string) => void
}) {
  const create = useCreateStaff()
  const update = useUpdateStaff()
  const editing = user !== null
  const [failure, setFailure] = useState<{ field: 'username' | 'other'; message: string } | null>(null)
  const pending = create.isPending || update.isPending

  function close() {
    setFailure(null)
    onClose()
  }

  function submit(values: Values) {
    setFailure(null)
    if (user) {
      update.mutate(
        { id: user.id, name: values.name, role: values.role },
        {
          onSuccess: () => {
            toast.success(`${values.name} updated`)
            close()
          },
          onError: (e) => setFailure({ field: 'other', message: e.message }),
        },
      )
    } else {
      create.mutate(values, {
        onSuccess: (result) => {
          close()
          onCreated(result.user.name, result.tempPassword)
        },
        onError: (e) =>
          setFailure({ field: /username/i.test(e.message) ? 'username' : 'other', message: e.message }),
      })
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={editing ? 'Edit account' : 'Add an account'}
      description={editing ? 'Change the name or role.' : 'They get a temporary password to sign in with.'}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={pending}>
            {pending ? 'Saving…' : editing ? 'Save changes' : 'Add account'}
          </Button>
        </>
      }
    >
      <StaffForm
        key={user?.id ?? 'new'}
        editing={editing}
        initial={{ name: user?.name ?? '', username: user?.username ?? '', role: user?.role ?? Role.Secretariat }}
        usernameError={failure?.field === 'username' ? failure.message : undefined}
        onSubmit={submit}
      />
      {failure?.field === 'other' && (
        <p role="alert" className="mt-4 text-small text-danger">
          {failure.message}
        </p>
      )}
    </Dialog>
  )
}
