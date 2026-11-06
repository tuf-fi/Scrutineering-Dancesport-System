import { FeeMode, KIND_FIELD_LABEL, KindField, type EventKindDef, type EventKindInput } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useSaveEventKind } from '../../hooks/index.ts'
import { FEE_MODE_LABEL } from '../../lib/format.ts'

const FORM_ID = 'event-kind-form'

const empty: EventKindInput = { name: '', feeMode: FeeMode.Standard, beginnersOnly: false, closedToProvince: false, requires: [] }

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (checked: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-small text-neutral-900">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-neutral-900" />
      <span className="flex flex-col">
        {label}
        {hint && <span className="text-neutral-600">{hint}</span>}
      </span>
    </label>
  )
}

function KindForm({ initial, onSubmit }: { initial: EventKindInput; onSubmit: (values: EventKindInput) => void }) {
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<string>()
  const set = <K extends keyof EventKindInput>(key: K, value: EventKindInput[K]) => setValues((v) => ({ ...v, [key]: value }))
  const toggleField = (field: KindField, on: boolean) => set('requires', on ? [...values.requires, field] : values.requires.filter((f) => f !== field))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!values.name.trim()) return setError('Enter the name of the kind.')
    setError(undefined)
    onSubmit(values)
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Input label="Name" required value={values.name} onChange={(e) => set('name', e.target.value)} error={error} autoFocus />
      <Select label="Price" required hint="Which price in the fee schedule an entry pays." value={values.feeMode} onChange={(e) => set('feeMode', e.target.value as FeeMode)}>
        {Object.values(FeeMode).map((mode) => (
          <option key={mode} value={mode}>
            {FEE_MODE_LABEL[mode]}
          </option>
        ))}
      </Select>
      <div className="flex flex-col gap-3">
        <Check checked={values.beginnersOnly} onChange={(on) => set('beginnersOnly', on)} label="Beginners only" hint="Beginner (BGB) athletes enter it and nothing else." />
        <Check checked={values.closedToProvince} onChange={(on) => set('closedToProvince', on)} label="Closed to one province" hint="Each event of this kind names its province." />
      </div>
      <fieldset className="flex flex-col gap-3 border-t border-neutral-200 pt-5">
        <legend className="float-left mb-3 text-small font-medium text-neutral-700">Every dancer entering must have</legend>
        {Object.values(KindField).map((field) => (
          <Check key={field} checked={values.requires.includes(field)} onChange={(on) => toggleField(field, on)} label={KIND_FIELD_LABEL[field].replace(/^./, (c) => c.toUpperCase())} />
        ))}
        <p className="text-small text-neutral-600">A missing one shows the secretariat a warning. It does not stop the entry.</p>
      </fieldset>
    </form>
  )
}

// Creates a kind of event, or edits the one given
export function EventKindDialog({ open, kind, onClose }: { open: boolean; kind: EventKindDef | null; onClose: () => void }) {
  const save = useSaveEventKind()
  const editing = kind !== null
  const [failure, setFailure] = useState<string | null>(null)

  function close() {
    setFailure(null)
    onClose()
  }

  function submit(input: EventKindInput) {
    setFailure(null)
    save.mutate(
      { input, id: kind?.id },
      {
        onSuccess: () => {
          toast.success(editing ? 'Kind updated' : 'Kind added')
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
      title={editing ? 'Edit kind' : 'New kind'}
      description={editing ? 'Change the name or the rules. Events keep this kind.' : 'Set how events of this kind are priced and who may enter.'}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add kind'}
          </Button>
        </>
      }
    >
      <KindForm
        key={kind?.id ?? 'new'}
        initial={kind ? { name: kind.name, feeMode: kind.feeMode, beginnersOnly: kind.beginnersOnly, closedToProvince: kind.closedToProvince, requires: kind.requires } : empty}
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
