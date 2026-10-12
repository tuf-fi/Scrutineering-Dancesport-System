import { AgeGroup, Class, DISCIPLINE_DANCES, Discipline, type Event } from '@bis/shared'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, Input, Select, toast } from '../../components/ui/index.ts'
import { useSaveEvent } from '../../hooks/index.ts'
import { cn } from '../../lib/cn.ts'
import { AGE_GROUP_LABEL, DANCE_LABEL, DISCIPLINE_LABEL, eventCode } from '../../lib/format.ts'

const FORM_ID = 'event-form'

function EventForm({
  competitionId,
  event,
  nextNumber,
  onDone,
}: {
  competitionId: string
  event: Event | null
  nextNumber: number
  onDone: () => void
}) {
  const save = useSaveEvent()
  const [number, setNumber] = useState(String(event?.number ?? nextNumber))
  const [ageGroup, setAgeGroup] = useState(event?.ageGroup ?? AgeGroup.Juvenile)
  const [cls, setCls] = useState(event?.class ?? Class.E1)
  const [discipline, setDiscipline] = useState(event?.discipline ?? Discipline.Latin)
  const [dances, setDances] = useState(event?.dances ?? [])
  const [type, setType] = useState(event?.isSolo === false ? 'couple' : 'solo')
  const [error, setError] = useState<string | null>(null)

  function pickDiscipline(next: Discipline) {
    setDiscipline(next)
    // Dances belong to one discipline, so a switch clears the old picks
    setDances([])
  }

  const toggle = (dance: (typeof dances)[number]) =>
    setDances((d) => (d.includes(dance) ? d.filter((x) => x !== dance) : [...d, dance]))

  function submit(e: FormEvent) {
    e.preventDefault()
    const n = number.trim()
    if (!/^\d+$/.test(n)) return setError('The event number is a whole number.')
    if (dances.length === 0) return setError('Choose at least one dance.')
    setError(null)
    save.mutate(
      {
        competitionId,
        id: event?.id,
        input: { number: Number(n), ageGroup, class: cls, discipline, dances, isSolo: type === 'solo' },
      },
      {
        onSuccess: (saved) => {
          toast.success(`${event ? 'Saved' : 'Added'} ${eventCode(saved)}`)
          onDone()
        },
        onError: (err) => setError(err.message),
      },
    )
  }

  return (
    <>
      <form id={FORM_ID} onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Event number"
          inputMode="numeric"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          className="font-mono tabular-nums"
        />
        <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="solo">Solo</option>
          <option value="couple">Couple</option>
        </Select>
        <Select label="Age group" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}>
          {Object.values(AgeGroup).map((a) => (
            <option key={a} value={a}>
              {AGE_GROUP_LABEL[a]}
            </option>
          ))}
        </Select>
        <Select label="Class" value={cls} onChange={(e) => setCls(e.target.value as Class)}>
          {Object.values(Class).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <div className="sm:col-span-2">
          <Select label="Discipline" value={discipline} onChange={(e) => pickDiscipline(e.target.value as Discipline)}>
            {Object.values(Discipline).map((d) => (
              <option key={d} value={d}>
                {DISCIPLINE_LABEL[d]}
              </option>
            ))}
          </Select>
        </div>
        <fieldset className="flex flex-col gap-2 sm:col-span-2">
          <legend className="mb-1.5 text-small font-medium text-neutral-600">Dances</legend>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINE_DANCES[discipline].map((dance) => (
              <button
                key={dance}
                type="button"
                aria-pressed={dances.includes(dance)}
                onClick={() => toggle(dance)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-small transition-colors',
                  dances.includes(dance)
                    ? 'border-neutral-900 bg-neutral-50 font-medium text-neutral-900'
                    : 'border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50',
                )}
              >
                {DANCE_LABEL[dance]}
              </button>
            ))}
          </div>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="mt-4 text-small text-danger">
          {error}
        </p>
      )}
    </>
  )
}

// Adds an event to the competition, or edits the one given
export function EventDialog({
  open,
  competitionId,
  event,
  nextNumber,
  onClose,
}: {
  open: boolean
  competitionId: string
  event: Event | null
  nextNumber: number
  onClose: () => void
}) {
  const editing = event !== null
  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="max-w-lg"
      title={editing ? `Edit ${eventCode(event)}` : 'Add event'}
      description={editing ? 'Correct the event details.' : 'The event is added to the end of the schedule.'}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            {editing ? 'Save changes' : 'Add event'}
          </Button>
        </>
      }
    >
      {open && (
        <EventForm
          key={event?.id ?? 'new'}
          competitionId={competitionId}
          event={event}
          nextNumber={nextNumber}
          onDone={onClose}
        />
      )}
    </Dialog>
  )
}
