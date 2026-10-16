import type { PaymentMethod } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input } from '../../components/ui/index.ts'

const FORM_ID = 'payment-method-form'

function MethodForm({ initial, onSubmit }: { initial: PaymentMethod; onSubmit: (method: PaymentMethod) => void }) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Partial<Record<'name' | 'accountName' | 'number', string>>>({})
  const set = (key: keyof PaymentMethod) => (e: { target: { value: string } }) => setValues({ ...values, [key]: e.target.value })

  function submit(event: FormEvent) {
    event.preventDefault()
    const found: typeof errors = {}
    if (!values.name.trim()) found.name = 'Enter a name.'
    if (!values.accountName.trim()) found.accountName = 'Enter the account name.'
    if (!values.number.trim()) found.number = 'Enter the number.'
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit(values)
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
      <Input label="Name" hint="GCash, Maya, a bank" value={values.name} onChange={set('name')} error={errors.name} autoFocus />
      <Input label="Account name" value={values.accountName} onChange={set('accountName')} error={errors.accountName} />
      <Input label="Number" className="font-mono tabular-nums" value={values.number} onChange={set('number')} error={errors.number} />
      <Input label="Note (optional)" value={values.note ?? ''} onChange={set('note')} />
    </form>
  )
}

// Adds a way to pay, or edits the one given
export function PaymentMethodDialog({
  open,
  method,
  onClose,
  onSave,
}: {
  open: boolean
  method: PaymentMethod | null
  onClose: () => void
  onSave: (method: PaymentMethod) => void
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={method ? 'Edit way to pay' : 'Add a way to pay'}
      description="Clubs see this when they pay for their entries."
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {method ? 'Save changes' : 'Add'}
          </Button>
        </>
      }
    >
      <MethodForm
        key={open ? (method?.name ?? 'new') : 'closed'}
        initial={method ?? { name: '', accountName: '', number: '', note: '' }}
        onSubmit={onSave}
      />
    </Dialog>
  )
}
