import type { Competition } from '@bis/shared'
import { useRef, useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useSaveCompetition } from '../../hooks/index.ts'
import { todayIso } from '../../lib/format.ts'
import { coverPhoto } from '../../lib/image.ts'

interface Values {
  name: string
  date: string
  venue: string
  organizer: string
  executor: string
  entryDeadline: string
  feeDeadline: string
  image: string
  usesPoints: boolean
  paymentRequired: boolean
}

type Errors = Partial<Record<keyof Values, string>>

const FORM_ID = 'competition-form'

function CompetitionForm({ initial, onSubmit }: { initial: Values; onSubmit: (values: Values) => void }) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})
  const picker = useRef<HTMLInputElement>(null)

  const set = (key: Exclude<keyof Values, 'usesPoints' | 'paymentRequired'>) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [key]: e.target.value }))

  async function choose(file: File | undefined) {
    if (!file) return
    try {
      const image = await coverPhoto(file)
      setValues((v) => ({ ...v, image }))
      setErrors((e) => ({ ...e, image: undefined }))
    } catch (e) {
      setErrors((found) => ({ ...found, image: e instanceof Error ? e.message : 'Could not read that picture.' }))
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const found: Errors = {}
    if (!values.name.trim()) found.name = 'Enter the competition name.'
    if (!values.date) found.date = 'Pick the date.'
    else if (values.date < todayIso() && values.date !== initial.date) found.date = 'Pick today or a later date. A finished competition cannot be added.'
    if (!values.venue.trim()) found.venue = 'Enter the venue.'
    if (!values.organizer.trim()) found.organizer = 'Enter the organizer.'
    if (!values.image) found.image = 'Add the photo for its card.'
    setErrors(found)
    if (Object.keys(found).length === 0) onSubmit(values)
  }

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Input label="Name" required value={values.name} onChange={set('name')} error={errors.name} autoFocus />
      </div>
      <Input label="Date" required type="date" value={values.date} onChange={set('date')} error={errors.date} />
      <Input label="Organizer" required value={values.organizer} onChange={set('organizer')} error={errors.organizer} />
      <div className="sm:col-span-2">
        <Input label="Executor" hint="Who runs the scoring. Printed on result sheets. Leave empty to use the organizer." value={values.executor} onChange={set('executor')} />
      </div>
      <div className="sm:col-span-2">
        <Input label="Venue" required value={values.venue} onChange={set('venue')} error={errors.venue} />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-small font-medium text-neutral-600">
          Card photo
          <span aria-hidden className="ml-0.5 text-danger">
            *
          </span>
        </span>
        <div className="flex items-center gap-4">
          <div className="grid aspect-[4/5] w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
            {values.image && <img src={values.image} alt="" className="size-full object-cover" />}
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={() => picker.current?.click()}>
              {values.image ? 'Change photo' : 'Choose photo'}
            </Button>
            <p className={errors.image ? 'text-small text-danger' : 'text-small text-neutral-500'}>
              {errors.image ?? 'Shows on its card on the home page. Cropped to a portrait.'}
            </p>
          </div>
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Card photo" className="sr-only" onChange={(e) => void choose(e.target.files?.[0])} />
        </div>
      </div>
      <fieldset className="flex flex-col gap-2 sm:col-span-2">
        <legend className="mb-1 text-small font-medium text-neutral-600">Payment</legend>
        {[
          { value: true, label: 'Payment and membership fee required', note: 'Entries are priced, and each one is paid before it counts.' },
          { value: false, label: 'Payment not required', note: 'Free to enter: no fee, membership, payment method or screenshot.' },
        ].map((o) => (
          <label key={o.label} className="flex cursor-pointer items-start gap-3 text-small text-neutral-900">
            <input
              type="radio"
              name="payment-required"
              checked={values.paymentRequired === o.value}
              onChange={() => setValues((v) => ({ ...v, paymentRequired: o.value, ...(o.value ? {} : { feeDeadline: '' }) }))}
              className="mt-0.5 size-5 shrink-0 accent-neutral-900"
            />
            <span className="flex flex-col">
              {o.label}
              <span className="text-neutral-600">{o.note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <Input label="Entries close" hint="Optional. Later entries are flagged." type="date" value={values.entryDeadline} onChange={set('entryDeadline')} />
      {values.paymentRequired && <Input label="Fees due" hint="Optional. Later unpaid entries are flagged." type="date" value={values.feeDeadline} onChange={set('feeDeadline')} />}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label className="flex cursor-pointer items-center gap-3 text-small text-neutral-900">
          <input
            type="checkbox"
            checked={values.usesPoints}
            onChange={(e) => setValues((v) => ({ ...v, usesPoints: e.target.checked }))}
            className="size-5 accent-neutral-900"
          />
          Results earn ranking points
        </label>
        <p className="text-small text-neutral-600">Turn off for a competition that does not count towards the rankings.</p>
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
            ? {
                name: competition.name,
                date: competition.date,
                venue: competition.venue,
                organizer: competition.organizer,
                executor: competition.executor ?? '',
                entryDeadline: competition.entryDeadline ?? '',
                feeDeadline: competition.feeDeadline ?? '',
                image: competition.image ?? '',
                usesPoints: competition.usesPoints,
                paymentRequired: competition.paymentRequired,
              }
            : { name: '', date: '', venue: '', organizer: '', executor: '', entryDeadline: '', feeDeadline: '', image: '', usesPoints: true, paymentRequired: true }
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
