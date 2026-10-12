import { PaymentStatus, type LateEntryRow } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, SearchField, Select, toast } from '../../components/ui/index.ts'
import { useCompetitorRows, useCreateLateEntry, useEvents, useUpdateLateEntry } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { competitorName, eventCode, eventDances, eventGrade } from '../../lib/format.ts'

const FORM_ID = 'late-entry-form'
const MAX_RESULTS = 6

function LateEntryForm({
  competitionId,
  entry,
  onDone,
}: {
  competitionId: string
  entry: LateEntryRow | null
  onDone: () => void
}) {
  const events = useEvents(competitionId)
  const competitors = useCompetitorRows()
  const create = useCreateLateEntry()
  const update = useUpdateLateEntry()
  const [eventId, setEventId] = useState(entry?.eventId ?? '')
  const [query, setQuery] = useState('')
  const [competitorId, setCompetitorId] = useState(entry?.competitorId ?? '')
  const [paidInCash, setPaidInCash] = useState(entry && entry.paymentStatus !== PaymentStatus.PaidAtVenue ? 'later' : 'cash')
  const [errors, setErrors] = useState<{ event?: string; competitor?: string }>({})
  const [failure, setFailure] = useState<string | null>(null)

  const event = events.data?.find((e) => e.id === eventId)
  const needle = query.trim().toLowerCase()
  // Solo events take one dancer, couple events take two
  const matches = needle
    ? (competitors.data ?? [])
        .filter((c) => !event || (c.names.length === 1) === event.isSolo)
        .filter((c) => competitorName(c.names).toLowerCase().includes(needle) || String(c.backNumber) === needle)
        .slice(0, MAX_RESULTS)
    : []

  function submit(e: FormEvent) {
    e.preventDefault()
    const found = {
      event: eventId ? undefined : 'Choose the event.',
      competitor: competitorId ? undefined : 'Pick a competitor from the results.',
    }
    setErrors(found)
    if (found.event || found.competitor) return
    setFailure(null)
    const handlers = {
      onSuccess: (row: LateEntryRow) => {
        toast.success(`Late entry ${entry ? 'saved' : 'added'} for ${competitorName(row.names)}`)
        onDone()
      },
      onError: (err: Error) => setFailure(err.message),
    }
    if (entry) update.mutate({ entryId: entry.entryId, eventId, paidInCash: paidInCash === 'cash' }, handlers)
    else create.mutate({ competitorId, eventId, paidInCash: paidInCash === 'cash' }, handlers)
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4">
        <Select
          label="Event"
          value={eventId}
          error={errors.event}
          onChange={(e) => {
            setEventId(e.target.value)
            if (!entry) setCompetitorId('')
          }}
        >
          <option value="">Choose an event</option>
          {[...(events.data ?? [])]
            .sort((a, b) => a.number - b.number)
            .map((ev) => (
              <option key={ev.id} value={ev.id}>
                {eventCode(ev)} {eventDances(ev)} · {eventGrade(ev)}
              </option>
            ))}
        </Select>

        {entry ? (
          <div className="flex flex-col gap-1">
            <span className="text-small font-medium text-neutral-600">Competitor</span>
            <span className="text-body text-neutral-900">{competitorName(entry.names)}</span>
          </div>
        ) : (
        <div className="flex flex-col gap-2">
          <SearchField label="Competitor" value={query} onChange={(v) => { setQuery(v); setCompetitorId('') }} />
          {matches.length > 0 && (
            <ul aria-label="Matching competitors" className="overflow-hidden rounded-md border border-neutral-200">
              {matches.map((c) => (
                <li key={c.id} className="border-b border-neutral-100 last:border-b-0">
                  <button
                    type="button"
                    aria-pressed={c.id === competitorId}
                    onClick={() => setCompetitorId(c.id)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3.5 py-2 text-left text-small transition-colors',
                      c.id === competitorId ? 'bg-neutral-100' : 'hover:bg-neutral-50',
                    )}
                  >
                    <span className="w-10 font-mono tabular-nums text-neutral-500">{c.backNumber ?? '–'}</span>
                    <span className="flex-1 truncate font-medium text-neutral-900">{competitorName(c.names)}</span>
                    <span className="hidden truncate text-neutral-500 sm:block">{c.clubName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {errors.competitor && (
            <p role="alert" className="text-small text-danger">
              {errors.competitor}
            </p>
          )}
        </div>
        )}

        <Select
          label="Payment"
          value={paidInCash}
          onChange={(e) => setPaidInCash(e.target.value)}
        >
          <option value="cash">Paid in cash at the venue</option>
          <option value="later">Not paid yet</option>
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

// Adds a late entry, or fixes the event and payment of the one given
export function LateEntryDialog({
  open,
  competitionId,
  entry,
  onClose,
}: {
  open: boolean
  competitionId: string
  entry: LateEntryRow | null
  onClose: () => void
}) {
  const editing = entry !== null
  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-lg"
      title={editing ? 'Edit late entry' : 'Add late entry'}
      description={
        editing ? 'Change the event or how it was paid.' : 'For dancers who register at the venue after entries closed.'
      }
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {editing ? 'Save changes' : 'Add entry'}
          </Button>
        </>
      }
    >
      {open && <LateEntryForm key={entry?.entryId ?? 'new'} competitionId={competitionId} entry={entry} onDone={onClose} />}
    </Dialog>
  )
}
