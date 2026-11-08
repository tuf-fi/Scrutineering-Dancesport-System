import type { AgeGroupDef, AgeGroupInput } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useSaveAgeGroup } from '../../hooks/index.ts'

const FORM_ID = 'age-group-form'

interface Values {
  name: string
  short: string
  bornFrom: string
  bornTo: string
  juvenileFee: boolean
}

type Errors = Partial<Record<'name' | 'short' | 'bornFrom' | 'bornTo', string>>

function GroupForm({ initial, onSubmit }: { initial: Values; onSubmit: (values: AgeGroupInput) => void }) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})
  const set = (key: 'name' | 'short' | 'bornFrom' | 'bornTo') => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }))

  function submit(event: FormEvent) {
    event.preventDefault()
    const found: Errors = {}
    const from = values.bornFrom.trim()
    const to = values.bornTo.trim()
    const isYear = (v: string) => /^\d{4}$/.test(v)
    if (!values.name.trim()) found.name = 'Enter the name of the age group.'
    if (!values.short.trim()) found.short = 'Enter how it is printed.'
    if (from && !isYear(from)) found.bornFrom = 'Enter a year, like 2012.'
    if (to && !isYear(to)) found.bornTo = 'Enter a year, like 2014.'
    if (!from && !to) found.bornFrom = 'Enter the first or the last year of birth.'
    if (isYear(from) && isYear(to) && Number(from) > Number(to)) found.bornFrom = 'This year comes before the last year.'
    setErrors(found)
    if (Object.keys(found).length === 0) {
      onSubmit({ name: values.name, short: values.short, bornFrom: from ? Number(from) : null, bornTo: to ? Number(to) : null, juvenileFee: values.juvenileFee })
    }
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Input label="Name" required value={values.name} onChange={set('name')} error={errors.name} autoFocus />
      </div>
      <div className="sm:col-span-2">
        <Input label="Printed as" required hint="On result sheets, e.g. JUN 1." value={values.short} onChange={set('short')} error={errors.short} />
      </div>
      <Input
        label="Born from"
        hint="The first year of birth. Leave empty for the oldest dancers."
        inputMode="numeric"
        value={values.bornFrom}
        onChange={set('bornFrom')}
        error={errors.bornFrom}
        className="font-mono tabular-nums"
      />
      <Input
        label="Born up to"
        hint="The last year of birth. Leave empty for the youngest dancers."
        inputMode="numeric"
        value={values.bornTo}
        onChange={set('bornTo')}
        error={errors.bornTo}
        className="font-mono tabular-nums"
      />
      <label className="flex cursor-pointer items-start gap-3 text-small text-neutral-900 sm:col-span-2">
        <input type="checkbox" checked={values.juvenileFee} onChange={(e) => setValues((v) => ({ ...v, juvenileFee: e.target.checked }))} className="mt-0.5 size-5 shrink-0 accent-neutral-900" />
        <span className="flex flex-col">
          Pays the juvenile price
          <span className="text-neutral-600">In events priced by age group, this group pays the juvenile tier.</span>
        </span>
      </label>
    </form>
  )
}

// Creates an age group, or edits the one given
export function AgeGroupDialog({ open, group, onClose }: { open: boolean; group: AgeGroupDef | null; onClose: () => void }) {
  const save = useSaveAgeGroup()
  const editing = group !== null
  const [failure, setFailure] = useState<string | null>(null)

  function close() {
    setFailure(null)
    onClose()
  }

  function submit(input: AgeGroupInput) {
    setFailure(null)
    save.mutate(
      { input, id: group?.id },
      {
        onSuccess: () => {
          toast.success(editing ? 'Age group updated' : 'Age group added')
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
      title={editing ? 'Edit age group' : 'New age group'}
      description={editing ? 'Change the name or the years. Events keep this age group.' : 'Add an age group and the years of birth it covers.'}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add age group'}
          </Button>
        </>
      }
    >
      <GroupForm
        key={group?.id ?? 'new'}
        initial={
          group
            ? { name: group.name, short: group.short, bornFrom: group.bornFrom === null ? '' : String(group.bornFrom), bornTo: group.bornTo === null ? '' : String(group.bornTo), juvenileFee: group.juvenileFee }
            : { name: '', short: '', bornFrom: '', bornTo: '', juvenileFee: false }
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
