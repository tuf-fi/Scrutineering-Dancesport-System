import type { Event, FeeItem, FeeItemInput } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, toast } from '../../components/ui/index.ts'
import { useSaveFee } from '../../hooks/index.ts'
import { eventCode, eventDances } from '../../lib/format.ts'

const FORM_ID = 'fee-form'
const isPesos = (v: string) => /^\d{1,6}$/.test(v.trim())
const check = 'size-5 shrink-0 accent-neutral-900'

// A second price that applies only when its box is ticked
function OptionalPrice({
  label,
  note,
  inputLabel,
  value,
  onChange,
  error,
}: {
  label: string
  note: string
  inputLabel: string
  value: string | null
  onChange: (value: string | null) => void
  error?: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-start gap-3 text-small text-neutral-900">
        <input type="checkbox" checked={value !== null} onChange={(e) => onChange(e.target.checked ? '' : null)} className={check} />
        <span className="flex flex-col gap-0.5">
          {label}
          <span className="text-neutral-600">{note}</span>
        </span>
      </label>
      {value !== null && (
        <div className="pl-8">
          <Input label={inputLabel} required inputMode="numeric" className="font-mono tabular-nums" value={value} onChange={(e) => onChange(e.target.value)} error={error} />
        </div>
      )}
    </div>
  )
}

function FeeForm({
  fee,
  fees,
  events,
  onSubmit,
}: {
  fee: FeeItem | null
  fees: FeeItem[]
  events: Event[]
  onSubmit: (input: FeeItemInput) => void
}) {
  const [name, setName] = useState(fee?.name ?? '')
  const [amount, setAmount] = useState(fee ? String(fee.amount) : '')
  const [extra, setExtra] = useState(fee?.extra == null ? null : String(fee.extra))
  const [late, setLate] = useState(fee?.late == null ? null : String(fee.late))
  const [chosen, setChosen] = useState(() => new Set(fee ? events.filter((e) => e.feeId === fee.id).map((e) => e.id) : []))
  const [errors, setErrors] = useState<Partial<Record<'name' | 'amount' | 'extra' | 'late', string>>>({})

  function submit(event: FormEvent) {
    event.preventDefault()
    const found: typeof errors = {}
    if (!name.trim()) found.name = 'Enter a name.'
    if (!isPesos(amount)) found.amount = 'Enter whole pesos.'
    if (extra !== null && !isPesos(extra)) found.extra = 'Enter whole pesos.'
    if (late !== null && !isPesos(late)) found.late = 'Enter whole pesos.'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSubmit({
      name: name.trim(),
      amount: Number(amount),
      extra: extra === null ? null : Number(extra),
      late: late === null ? null : Number(late),
      eventIds: [...chosen],
    })
  }

  const toggle = (id: string) =>
    setChosen((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  const all = events.length > 0 && chosen.size === events.length

  return (
    <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
      <Input label="Name" required hint="For example, Solo juvenile or Open couple." value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
      <Input label="Price per entry (₱)" required inputMode="numeric" className="font-mono tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amount} />
      <OptionalPrice
        label="Charge a different price for extra entries"
        note="A dancer or couple pays the full price once, then this price for each further entry."
        inputLabel="Each extra entry (₱)"
        value={extra}
        onChange={setExtra}
        error={errors.extra}
      />
      <OptionalPrice
        label="Charge a different price for late entries"
        note="Unticked, a late entry costs the same as any other."
        inputLabel="Late entry (₱)"
        value={late}
        onChange={setLate}
        error={errors.late}
      />
      <fieldset className="flex flex-col gap-2 border-t border-neutral-200 pt-4">
        <legend className="sr-only">Events this fee applies to</legend>
        <div className="flex items-center justify-between gap-3">
          <span aria-hidden className="text-small font-medium text-neutral-900">
            Events this fee applies to <span className="font-mono tabular-nums text-neutral-500">{chosen.size}</span>
          </span>
          {events.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setChosen(new Set(all ? [] : events.map((e) => e.id)))}>
              {all ? 'Clear all' : 'Select all'}
            </Button>
          )}
        </div>
        {events.length === 0 ? (
          <p className="text-small text-neutral-600">This competition has no events yet. You can choose this fee when you add one.</p>
        ) : (
          <ul className="max-h-60 overflow-y-auto border-y border-neutral-200">
            {events.map((e) => {
              const other = e.feeId && e.feeId !== fee?.id ? fees.find((f) => f.id === e.feeId) : undefined
              return (
                <li key={e.id} className="border-t border-neutral-200 first:border-t-0">
                  <label className="flex cursor-pointer items-center gap-3 py-2 text-small text-neutral-900">
                    <input type="checkbox" checked={chosen.has(e.id)} onChange={() => toggle(e.id)} className={check} />
                    <span className="w-10 shrink-0 font-mono tabular-nums text-neutral-500">{eventCode(e)}</span>
                    <span className="flex min-w-0 flex-col">
                      <span>{`${eventDances(e)} · ${e.isSolo ? 'Solo' : 'Couple'}`}</span>
                      {other && <span className="text-neutral-500">Now on {other.name}</span>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </fieldset>
    </form>
  )
}

// Adds a fee to a competition, or edits the one given
export function FeeDialog({
  open,
  competitionId,
  fee,
  fees,
  events,
  onClose,
}: {
  open: boolean
  competitionId: string
  fee: FeeItem | null
  fees: FeeItem[]
  events: Event[]
  onClose: () => void
}) {
  const save = useSaveFee()
  const [failure, setFailure] = useState<string | null>(null)

  function close() {
    setFailure(null)
    onClose()
  }

  function submit(input: FeeItemInput) {
    setFailure(null)
    save.mutate(
      { competitionId, input, id: fee?.id },
      {
        onSuccess: () => {
          toast.success(fee ? 'Fee saved' : 'Fee added')
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
      title={fee ? 'Edit fee' : 'Add fee'}
      description={fee ? 'New prices apply to entries made from now on.' : 'Set the price, then choose the events it applies to.'}
      actions={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : fee ? 'Save changes' : 'Add fee'}
          </Button>
        </>
      }
    >
      {open && <FeeForm key={fee?.id ?? 'new'} fee={fee} fees={fees} events={events} onSubmit={submit} />}
      {failure && (
        <p role="alert" className="mt-4 text-small text-danger">
          {failure}
        </p>
      )}
    </Dialog>
  )
}
