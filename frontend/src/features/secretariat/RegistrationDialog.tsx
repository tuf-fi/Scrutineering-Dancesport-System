import { PayMethod, type CompetitorRow } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, Skeleton, SkeletonList, toast } from '../../components/ui/index.ts'
import { useCompetitionEntries, useCompetitions, useEvents, useRegisterCompetitor, useRegistrationQuote } from '../../hooks/index.ts'
import { competitorName, eventCode, eventDances, eventGrade, EVENT_KIND_LABEL, PAY_METHOD_LABEL } from '../../lib/format.ts'

const FORM_ID = 'registration-form'
const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`

function RegistrationForm({ competitor, onDone }: { competitor: CompetitorRow; onDone: () => void }) {
  const competitions = useCompetitions()
  const register = useRegisterCompetitor()
  const [competitionId, setCompetitionId] = useState('')
  const events = useEvents(competitionId || undefined)
  const [chosen, setChosen] = useState<string[]>([])
  const [method, setMethod] = useState<PayMethod>(PayMethod.Unpaid)
  const [reference, setReference] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [coachMembership, setCoachMembership] = useState(false)
  const [coachSummit, setCoachSummit] = useState(false)
  const coachFees = { membership: coachMembership, summit: coachSummit }
  const quote = useRegistrationQuote(competitor.id, chosen, coachFees)
  const coach = quote.data?.coach

  const solo = competitor.names.length === 1
  const entries = useCompetitionEntries(competitionId)
  const entered = new Set((entries.data ?? []).filter((e) => e.competitorId === competitor.id && !e.scratched).map((e) => e.eventId))
  // Solo dancers take solo events and couples take couple events; the age group is a warning, not a filter
  const options = [...(events.data ?? [])].filter((e) => e.isSolo === solo).sort((a, b) => a.number - b.number)
  const pay = method !== PayMethod.Unpaid && method !== PayMethod.Cash

  const toggle = (id: string) => setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))

  function submit(e: FormEvent) {
    e.preventDefault()
    if (chosen.length === 0) return setFailure('Choose at least one event.')
    setFailure(null)
    register.mutate(
      { competitorId: competitor.id, eventIds: chosen, method, reference: pay ? reference : undefined, coachFees },
      {
        onSuccess: (r) => {
          toast.success(`Entered in ${chosen.length} event${chosen.length === 1 ? '' : 's'}, ${peso(r.total)}`)
          onDone()
        },
        onError: (err) => setFailure(err.message),
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
        <Select
          label="Competition"
          value={competitionId}
          onChange={(e) => {
            setCompetitionId(e.target.value)
            setChosen([])
          }}
        >
          <option value="">Choose a competition</option>
          {[...(competitions.data ?? [])]
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>

        {competitionId &&
          (events.isLoading ? (
            <SkeletonList rows={5} />
          ) : options.length === 0 ? (
            <p className="text-small text-neutral-600">This competition has no {solo ? 'solo' : 'couple'} events.</p>
          ) : (
            <fieldset className="flex flex-col">
              <legend className="mb-1 text-small font-medium text-neutral-600">Events</legend>
              <ul className="max-h-64 overflow-y-auto border-y border-neutral-200 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {options.map((ev) => (
                  <li key={ev.id} className="border-b border-neutral-100 last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-3 px-1 py-2 text-small text-neutral-900">
                      <input
                        type="checkbox"
                        checked={chosen.includes(ev.id)}
                        disabled={entered.has(ev.id)}
                        onChange={() => toggle(ev.id)}
                        className="size-5 accent-neutral-900"
                      />
                      <span className="w-10 font-mono tabular-nums text-neutral-500">{eventCode(ev)}</span>
                      <span className="flex-1 truncate font-medium">{eventDances(ev)}</span>
                      <span className="hidden text-neutral-500 sm:block">
                        {eventGrade(ev)}
                        {ev.kind && ev.kind !== 'standard' ? ` · ${EVENT_KIND_LABEL[ev.kind]}` : ''}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}

        {chosen.length > 0 && (
          <section aria-label="Fee" className="flex flex-col gap-1 text-small">
            {quote.isLoading || !quote.data ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <dl className="flex flex-col">
                  {quote.data.lines.map((l) => (
                    <div key={l.label} className="flex justify-between border-b border-neutral-100 py-1.5">
                      <dt className="text-neutral-600">{l.label}</dt>
                      <dd className="font-mono tabular-nums">{peso(l.amount)}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-semibold text-neutral-900">
                    <dt>Total</dt>
                    <dd className="font-mono tabular-nums">{peso(quote.data.total)}</dd>
                  </div>
                </dl>
                {quote.data.warnings.map((w) => (
                  <p key={w} role="status" className="text-danger">
                    {w}
                  </p>
                ))}
              </>
            )}
          </section>
        )}

        {coach && (coach.membershipDue || coach.summitDue) && (
          <fieldset className="flex flex-col gap-2 text-small text-neutral-900">
            <legend className="mb-1 font-medium text-neutral-600">{`Coach ${coach.name} has not paid this year`}</legend>
            {coach.membershipDue && (
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={coachMembership} onChange={(e) => setCoachMembership(e.target.checked)} className="size-5 accent-neutral-900" />
                Add the coach’s membership to this payment
              </label>
            )}
            {coach.summitDue && (
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={coachSummit} onChange={(e) => setCoachSummit(e.target.checked)} className="size-5 accent-neutral-900" />
                Add the Coaches Summit to this payment
              </label>
            )}
          </fieldset>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Payment" value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
            {Object.values(PayMethod).map((m) => (
              <option key={m} value={m}>
                {PAY_METHOD_LABEL[m]}
              </option>
            ))}
          </Select>
          {pay && <Input label="Reference no." value={reference} onChange={(e) => setReference(e.target.value)} className="font-mono" />}
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

// Enters one dancer or couple in several events at once, as the paper entry form does, with one payment
export function RegistrationDialog({ competitor, onClose }: { competitor: CompetitorRow | null; onClose: () => void }) {
  return (
    <Dialog
      open={competitor !== null}
      onClose={onClose}
      title={competitor ? `Enter ${competitorName(competitor.names)}` : 'Enter events'}
      description="Choose the events from the entry form and record what was paid."
      className="max-w-xl"
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            Enter
          </Button>
        </>
      }
    >
      {competitor && <RegistrationForm key={competitor.id} competitor={competitor} onDone={onClose} />}
    </Dialog>
  )
}
